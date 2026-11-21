"""
PlantCare — Python Flask & SQLite Backend
Implements:
  - GET    /                          -> Renders templates/index.html
  - POST   /api/auth/register         -> Registers user with scrypt/PBKDF2 password hash
  - POST   /api/auth/login            -> Verifies credentials and issues Bearer session token
  - POST   /api/auth/logout           -> Revokes current Bearer session token
  - GET    /api/auth/me               -> Returns authenticated user profile
  - PATCH  /api/auth/profile          -> Updates signed-in user's name and farm location
  - GET    /api/auth/bootstrap-status -> Checks whether an active administrator exists
  - POST   /api/auth/claim-admin      -> One-time first-admin claim or ADMIN_PASSCODE verification
  - POST   /api/predict               -> Validates leaf image, runs MobileNetV2 model, saves scan to SQLite
  - GET    /api/history               -> Returns saved scan history from database/plantcare.db
  - DELETE /api/history/<id>          -> Deletes scan record (owner or admin only)
  - GET    /api/stats                 -> Returns live scan statistics from database/plantcare.db
  - GET    /api/analytics             -> Returns aggregated analytics across recorded scans
  - GET    /api/weather               -> Server-side Open-Meteo weather proxy + foliar risk metrics
  - GET    /api/admin/overview        -> Admin system overview KPIs
  - GET    /api/admin/users           -> Admin user directory
  - PATCH  /api/admin/users/<id>      -> Admin role & account status management
  - GET    /api/admin/scans           -> Admin global scan moderation list
  - PATCH  /api/admin/scans/<id>      -> Flag/unflag scan and save agronomy review notes
  - DELETE /api/admin/scans/<id>      -> Admin scan removal + upload cleanup
  - GET    /api/admin/audit-logs      -> Security & operational audit log feed
  - GET    /uploads/<filename>        -> Serves uploaded leaf thumbnails safely
"""

from datetime import datetime, timedelta
from functools import wraps
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import urllib.error
import urllib.parse
import urllib.request
import uuid

from flask import Flask, g, jsonify, render_template, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from ml.predict import (
    LowConfidencePredictionError,
    ModelUnavailableError,
    PlantDiseasePredictor,
)
from ml.preprocessing import ImageValidationError, verify_image_bytes

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
DATABASE_DIR = os.path.join(BASE_DIR, "database")
DATABASE_PATH = os.path.join(DATABASE_DIR, "plantcare.db")
MODEL_PATH = os.path.join(BASE_DIR, "models", "plant_disease_model.keras")
CLASS_NAMES_PATH = os.path.join(BASE_DIR, "models", "class_names.json")

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}
ALLOWED_ROLES = {"user", "agronomist", "admin"}
ALLOWED_STATUSES = {"active", "suspended"}
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB
SESSION_TTL_DAYS = 7

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DATABASE_DIR, exist_ok=True)

app = Flask(__name__, template_folder="templates", static_folder="static")
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                status TEXT NOT NULL DEFAULT 'active',
                farm_location TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                last_login_at TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                actor_email TEXT NOT NULL,
                actor_role TEXT NOT NULL,
                target TEXT NOT NULL,
                details TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_filename TEXT NOT NULL,
                plant_name TEXT NOT NULL,
                disease_name TEXT NOT NULL,
                confidence REAL NOT NULL,
                created_at TEXT NOT NULL,
                user_id INTEGER,
                user_name TEXT DEFAULT 'Field Grower',
                flagged INTEGER NOT NULL DEFAULT 0,
                review_note TEXT NOT NULL DEFAULT ''
            )
            """
        )

        # Safe incremental column migration for pre-existing scans tables
        existing_cols = {
            row[1] for row in conn.execute("PRAGMA table_info(scans)").fetchall()
        }
        migrations = [
            ("user_id", "ALTER TABLE scans ADD COLUMN user_id INTEGER"),
            ("user_name", "ALTER TABLE scans ADD COLUMN user_name TEXT DEFAULT 'Field Grower'"),
            ("flagged", "ALTER TABLE scans ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0"),
            ("review_note", "ALTER TABLE scans ADD COLUMN review_note TEXT NOT NULL DEFAULT ''"),
        ]
        for col_name, ddl in migrations:
            if col_name not in existing_cols:
                conn.execute(ddl)

        conn.commit()


def is_allowed_extension(filename: str) -> bool:
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS


def is_healthy_label(disease_name: str) -> bool:
    normalized = str(disease_name or "").lower()
    return "healthy" in normalized or "स्वस्थ" in normalized


def now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def sanitize_user_row(row: sqlite3.Row | dict) -> dict:
    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "role": row["role"],
        "status": row["status"],
        "farm_location": row["farm_location"] or "",
        "created_at": row["created_at"],
        "last_login_at": row["last_login_at"],
    }


def record_audit_event(
    conn: sqlite3.Connection,
    action: str,
    actor_email: str,
    actor_role: str,
    target: str,
    details: str,
) -> None:
    conn.execute(
        """
        INSERT INTO audit_logs (action, actor_email, actor_role, target, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (action, actor_email, actor_role, target, details, now_str()),
    )


def create_session(conn: sqlite3.Connection, user_id: int) -> str:
    raw_token = secrets.token_hex(32)
    expires_at = (datetime.now() + timedelta(days=SESSION_TTL_DAYS)).strftime("%Y-%m-%d %H:%M:%S")
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (hash_token(raw_token), user_id, now_str(), expires_at),
    )
    return raw_token


def resolve_authenticated_user():
    auth_header = request.headers.get("Authorization", "")
    match = re.match(r"^Bearer\s+([A-Za-z0-9._-]+)$", auth_header.strip(), re.IGNORECASE)
    if not match:
        return None, None

    token_hash = hash_token(match.group(1))
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT u.*, s.expires_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ?
            """,
            (token_hash,),
        ).fetchone()
        if not row:
            return None, None
        if row["expires_at"] <= now_str() or row["status"] != "active":
            return None, None
        return dict(row), token_hash


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user, token_hash = resolve_authenticated_user()
        if not user:
            return jsonify({"success": False, "error": "Authentication required. Please sign in."}), 401
        g.auth_user = user
        g.auth_token_hash = token_hash
        return fn(*args, **kwargs)

    return wrapper


def require_admin(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user, token_hash = resolve_authenticated_user()
        if not user:
            return jsonify({"success": False, "error": "Administrator sign-in is required."}), 401
        if user["role"] != "admin":
            return jsonify({"success": False, "error": "Administrator permissions are required."}), 403
        g.auth_user = user
        g.auth_token_hash = token_hash
        return fn(*args, **kwargs)

    return wrapper


def map_weather_code_label(code: int, lang: str) -> str:
    en_map = {
        0: "Clear Sky",
        1: "Mainly Clear",
        2: "Partly Cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing Rime Fog",
        51: "Light Drizzle",
        53: "Moderate Drizzle",
        55: "Dense Drizzle",
        61: "Light Rain",
        63: "Moderate Rain",
        65: "Heavy Rain",
        71: "Light Snow",
        80: "Rain Showers",
        81: "Moderate Showers",
        82: "Violent Showers",
        95: "Thunderstorm",
    }
    hi_map = {
        0: "साफ आकाश",
        1: "मुख्यतः साफ",
        2: "आंशिक बादल",
        3: "घने बादल",
        45: "कोहरा",
        48: "घना कोहरा",
        51: "हल्की बूंदाबांदी",
        53: "मध्यम बूंदाबांदी",
        55: "तेज बूंदाबांदी",
        61: "हल्की बारिश",
        63: "मध्यम बारिश",
        65: "भारी बारिश",
        71: "हल्की बर्फबारी",
        80: "बारिश की बौछारें",
        81: "मध्यम बौछारें",
        82: "तेज बौछारें",
        95: "आंधी-तूफान",
    }
    table = hi_map if lang == "hi" else en_map
    return table.get(code, "परिवर्तनशील मौसम" if lang == "hi" else "Variable Conditions")


def compute_crop_weather_risk(
    temp_c: float,
    humidity: float,
    dew_point_c: float,
    precip_mm: float,
    wind_kmh: float,
    lang: str,
) -> dict:
    dew_spread = max(0.0, temp_c - dew_point_c)

    late_blight_score = (
        (45 if humidity >= 80 else 25 if humidity >= 65 else 5)
        + (30 if 12 <= temp_c <= 24 else 15 if 8 <= temp_c <= 28 else 0)
        + (25 if (precip_mm > 0.2 or dew_spread <= 3) else 0)
    )
    powdery_mildew_score = (
        (40 if 20 <= temp_c <= 30 else 20 if 15 <= temp_c <= 34 else 5)
        + (35 if 50 <= humidity <= 80 else 20 if humidity > 80 else 10)
        + (25 if precip_mm < 0.5 else 0)
    )
    bacterial_spot_score = (
        (35 if 22 <= temp_c <= 33 else 10)
        + (35 if humidity >= 75 else 15)
        + (30 if (precip_mm > 0 or wind_kmh >= 15) else 10)
    )

    def level(score: int) -> str:
        return "high" if score >= 70 else "moderate" if score >= 40 else "low"

    overall_score = max(late_blight_score, powdery_mildew_score, bacterial_spot_score)
    spray_window = "optimal"
    if precip_mm >= 0.5 or wind_kmh >= 20:
        spray_window = "avoid"
    elif wind_kmh >= 12 or humidity >= 88 or temp_c >= 33:
        spray_window = "caution"

    advisories = []
    if lang == "hi":
        if late_blight_score >= 70:
            advisories.append("अधिक नमी और कम ओस-अंतराल के कारण आलू और टमाटर में लेट ब्लाइट का उच्च जोखिम है।")
        if powdery_mildew_score >= 70:
            advisories.append("गर्म और शुष्क-नम मौसम में चूर्णिल आसिता के लिए पत्तियों की जांच बढ़ाएं।")
        if bacterial_spot_score >= 70:
            advisories.append("हवा और बारिश के छींटों से जीवाणु धब्बा रोग फैलने की संभावना अधिक है।")
        if spray_window == "avoid":
            advisories.append("तेज हवा या वर्षा के कारण अभी पत्तियों पर छिड़काव से बचें।")
        elif spray_window == "optimal":
            advisories.append("निचली हवा और बिना वर्षा के कारण सुबह या शाम का समय छिड़काव के लिए अनुकूल है।")
        else:
            advisories.append("मध्यम हवा/नमी है — छिड़काव से पहले स्थानीय हवा की गति जांचें।")
    else:
        if late_blight_score >= 70:
            advisories.append(
                "High humidity and narrow dew-point spread elevate Late Blight risk on tomato and potato foliage."
            )
        if powdery_mildew_score >= 70:
            advisories.append(
                "Warm canopy temperatures with dry-to-moderate humidity favor Powdery Mildew spore germination."
            )
        if bacterial_spot_score >= 70:
            advisories.append(
                "Warm moisture and leaf surface wetness increase Bacterial Spot spread on pepper and tomato crops."
            )
        if spray_window == "avoid":
            advisories.append(
                "Avoid foliar application during active rain or brisk wind to prevent wash-off and drift."
            )
        elif spray_window == "optimal":
            advisories.append(
                "Calm wind and dry foliage provide a favorable window for morning or late-afternoon foliar care."
            )
        else:
            advisories.append(
                "Marginal field window — check local breeze and leaf dryness before applying foliar treatments."
            )

    return {
        "overall_risk": level(overall_score),
        "overall_score": overall_score,
        "spray_window": spray_window,
        "dew_spread_c": round(dew_spread, 1),
        "diseases": [
            {"key": "late_blight", "score": late_blight_score, "level": level(late_blight_score)},
            {"key": "powdery_mildew", "score": powdery_mildew_score, "level": level(powdery_mildew_score)},
            {"key": "bacterial_spot", "score": bacterial_spot_score, "level": level(bacterial_spot_score)},
        ],
        "advisories": advisories,
    }


# Initialize database schema and load ML model once at application startup
init_db()
predictor = PlantDiseasePredictor(model_path=MODEL_PATH, class_names_path=CLASS_NAMES_PATH)


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/uploads/<path:filename>", methods=["GET"])
def serve_upload(filename: str):
    safe_name = secure_filename(os.path.basename(filename))
    if not safe_name:
        return jsonify({"success": False, "error": "Invalid image filename."}), 400

    resolved_path = os.path.abspath(os.path.join(app.config["UPLOAD_FOLDER"], safe_name))
    uploads_root = os.path.abspath(app.config["UPLOAD_FOLDER"]) + os.sep
    if not resolved_path.startswith(uploads_root) or not os.path.isfile(resolved_path):
        return jsonify({"success": False, "error": "Uploaded image not found."}), 404

    return send_from_directory(app.config["UPLOAD_FOLDER"], safe_name)


@app.route("/api/auth/bootstrap-status", methods=["GET"])
def auth_bootstrap_status():
    with get_db_connection() as conn:
        admin_count = conn.execute(
            "SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'"
        ).fetchone()[0]
        total_users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]

    return jsonify(
        {
            "success": True,
            "admin_exists": admin_count > 0,
            "passcode_configured": bool(os.environ.get("ADMIN_PASSCODE", "").strip()),
            "total_users": total_users,
        }
    )


@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    payload = request.get_json(silent=True) or {}
    full_name = str(payload.get("full_name", "")).strip()
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    farm_location = str(payload.get("farm_location", "")).strip()[:80]

    if len(full_name) < 2 or len(full_name) > 80:
        return jsonify({"success": False, "error": "Full name must be between 2 and 80 characters."}), 400
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        return jsonify({"success": False, "error": "Please enter a valid email address."}), 400
    if len(password) < 8 or len(password) > 128:
        return jsonify({"success": False, "error": "Password must be between 8 and 128 characters."}), 400

    now = now_str()
    password_hash = generate_password_hash(password)

    with get_db_connection() as conn:
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if existing:
            return jsonify({"success": False, "error": "An account with this email already exists."}), 409

        cur = conn.execute(
            """
            INSERT INTO users (full_name, email, password_hash, role, status, farm_location, created_at, last_login_at)
            VALUES (?, ?, ?, 'user', 'active', ?, ?, ?)
            """,
            (full_name, email, password_hash, farm_location, now, now),
        )
        user_id = cur.lastrowid
        token = create_session(conn, user_id)
        record_audit_event(
            conn, "USER_REGISTERED", email, "user", f"user#{user_id}", f"New account created ({full_name})"
        )
        user_row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        admin_count = conn.execute(
            "SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'"
        ).fetchone()[0]
        conn.commit()

    return (
        jsonify(
            {
                "success": True,
                "token": token,
                "user": sanitize_user_row(user_row),
                "admin_exists": admin_count > 0,
            }
        ),
        201,
    )


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))

    if not email or not password:
        return jsonify({"success": False, "error": "Email and password are required."}), 400

    with get_db_connection() as conn:
        user_row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not user_row or not check_password_hash(user_row["password_hash"], password):
            record_audit_event(conn, "AUTH_FAILED", email or "unknown", "guest", "login", "Invalid credentials")
            conn.commit()
            return jsonify({"success": False, "error": "Invalid email address or password."}), 401

        if user_row["status"] != "active":
            record_audit_event(
                conn,
                "AUTH_BLOCKED",
                user_row["email"],
                user_row["role"],
                f"user#{user_row['id']}",
                "Sign-in blocked because account is suspended",
            )
            conn.commit()
            return jsonify({"success": False, "error": "This account has been suspended."}), 401

        conn.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (now_str(), user_row["id"]))
        token = create_session(conn, user_row["id"])
        record_audit_event(conn, "USER_LOGIN", user_row["email"], user_row["role"], f"user#{user_row['id']}", "User signed in")
        updated = conn.execute("SELECT * FROM users WHERE id = ?", (user_row["id"],)).fetchone()
        admin_count = conn.execute(
            "SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'"
        ).fetchone()[0]
        conn.commit()

    return jsonify(
        {
            "success": True,
            "token": token,
            "user": sanitize_user_row(updated),
            "admin_exists": admin_count > 0,
        }
    )


@app.route("/api/auth/logout", methods=["POST"])
@require_auth
def auth_logout():
    with get_db_connection() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (g.auth_token_hash,))
        record_audit_event(
            conn, "USER_LOGOUT", g.auth_user["email"], g.auth_user["role"], f"user#{g.auth_user['id']}", "User signed out"
        )
        conn.commit()
    return jsonify({"success": True})


@app.route("/api/auth/me", methods=["GET"])
@require_auth
def auth_me():
    with get_db_connection() as conn:
        admin_count = conn.execute(
            "SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'"
        ).fetchone()[0]
    return jsonify({"success": True, "user": sanitize_user_row(g.auth_user), "admin_exists": admin_count > 0})


@app.route("/api/auth/profile", methods=["PATCH"])
@require_auth
def auth_update_profile():
    payload = request.get_json(silent=True) or {}
    full_name = str(payload.get("full_name", g.auth_user["full_name"])).strip()
    farm_location = str(payload.get("farm_location", g.auth_user["farm_location"])).strip()[:80]

    if len(full_name) < 2 or len(full_name) > 80:
        return jsonify({"success": False, "error": "Full name must be between 2 and 80 characters."}), 400

    with get_db_connection() as conn:
        conn.execute(
            "UPDATE users SET full_name = ?, farm_location = ? WHERE id = ?",
            (full_name, farm_location, g.auth_user["id"]),
        )
        record_audit_event(
            conn, "PROFILE_UPDATED", g.auth_user["email"], g.auth_user["role"], f"user#{g.auth_user['id']}", "Profile updated"
        )
        updated = conn.execute("SELECT * FROM users WHERE id = ?", (g.auth_user["id"],)).fetchone()
        conn.commit()

    return jsonify({"success": True, "user": sanitize_user_row(updated)})


@app.route("/api/auth/claim-admin", methods=["POST"])
@require_auth
def auth_claim_admin():
    payload = request.get_json(silent=True) or {}
    configured_passcode = os.environ.get("ADMIN_PASSCODE", "").strip()
    provided_passcode = str(payload.get("passcode", ""))

    with get_db_connection() as conn:
        admin_count = conn.execute(
            "SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'"
        ).fetchone()[0]

        if configured_passcode:
            if not provided_passcode or not hmac.compare_digest(provided_passcode, configured_passcode):
                record_audit_event(
                    conn, "ADMIN_CLAIM_DENIED", g.auth_user["email"], g.auth_user["role"], "admin", "Invalid admin passcode"
                )
                conn.commit()
                return jsonify({"success": False, "error": "Invalid administrator passcode."}), 401
        elif admin_count > 0:
            return (
                jsonify({"success": False, "error": "Initial administrator ownership has already been claimed."}),
                401,
            )

        conn.execute("UPDATE users SET role = 'admin' WHERE id = ?", (g.auth_user["id"],))
        record_audit_event(
            conn,
            "ADMIN_CLAIMED",
            g.auth_user["email"],
            "admin",
            f"user#{g.auth_user['id']}",
            "Administrator role claimed",
        )
        updated = conn.execute("SELECT * FROM users WHERE id = ?", (g.auth_user["id"],)).fetchone()
        conn.commit()

    return jsonify({"success": True, "user": sanitize_user_row(updated), "admin_exists": True})


@app.route("/api/predict", methods=["POST"])
def predict():
    lang = request.form.get("lang", "en")
    auth_user, _ = resolve_authenticated_user()

    if "image" not in request.files:
        return jsonify({"success": False, "error": "No image file provided under field 'image'."}), 400

    file = request.files["image"]
    if not file or not file.filename:
        return jsonify({"success": False, "error": "No image file selected."}), 400

    safe_original = secure_filename(file.filename)
    if not safe_original or not is_allowed_extension(safe_original):
        return (
            jsonify({"success": False, "error": "Unsupported file format. Only JPG, JPEG, and PNG are allowed."}),
            400,
        )

    raw_bytes = file.read()
    if len(raw_bytes) > MAX_CONTENT_LENGTH:
        return jsonify({"success": False, "error": "File exceeds the 10 MB maximum upload limit."}), 413

    try:
        image_format = verify_image_bytes(raw_bytes)
    except ImageValidationError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    if not predictor.is_ready:
        return (
            jsonify(
                {
                    "success": False,
                    "error": predictor.load_error
                    or "Plant disease classification model is not available on the server.",
                }
            ),
            503,
        )

    ext = "png" if image_format == "PNG" else "jpg"
    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    save_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_filename)

    try:
        with open(save_path, "wb") as out_file:
            out_file.write(raw_bytes)
    except OSError as exc:
        return jsonify({"success": False, "error": f"Failed to save uploaded image: {exc}"}), 500

    try:
        prediction_result = predictor.predict(save_path, lang=lang)
    except ModelUnavailableError as exc:
        if os.path.exists(save_path):
            os.remove(save_path)
        return jsonify({"success": False, "error": str(exc)}), 503
    except LowConfidencePredictionError as exc:
        if os.path.exists(save_path):
            os.remove(save_path)
        return jsonify({"success": False, "error": str(exc)}), 422
    except ImageValidationError as exc:
        if os.path.exists(save_path):
            os.remove(save_path)
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        if os.path.exists(save_path):
            os.remove(save_path)
        return jsonify({"success": False, "error": f"Prediction failed: {exc}"}), 500

    plant_name = str(prediction_result["plant"])
    disease_name = str(prediction_result["disease"])
    confidence = float(prediction_result["confidence"])
    disease_info = prediction_result["disease_info"]
    created_at = now_str()

    try:
        with get_db_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO scans (
                    image_filename, plant_name, disease_name, confidence, created_at, user_id, user_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    unique_filename,
                    plant_name,
                    disease_name,
                    confidence,
                    created_at,
                    auth_user["id"] if auth_user else None,
                    auth_user["full_name"] if auth_user else "Guest Grower",
                ),
            )
            scan_id = cursor.lastrowid
            record_audit_event(
                conn,
                "SCAN_CREATED",
                auth_user["email"] if auth_user else "guest",
                auth_user["role"] if auth_user else "guest",
                f"scan#{scan_id}",
                f"{plant_name} — {disease_name} ({confidence}%)",
            )
            conn.commit()
    except sqlite3.Error as exc:
        if os.path.exists(save_path):
            os.remove(save_path)
        return jsonify({"success": False, "error": f"Database error while saving scan: {exc}"}), 500

    return jsonify(
        {
            "success": True,
            "prediction": {
                "plant": plant_name,
                "disease": disease_name,
                "confidence": confidence,
            },
            "disease_info": {
                "description": disease_info["description"],
                "symptoms": disease_info["symptoms"],
                "recommendations": disease_info["recommendations"],
            },
            "scan_id": scan_id,
        }
    )


@app.route("/api/history", methods=["GET"])
def history():
    auth_user, _ = resolve_authenticated_user()
    scope = request.args.get("scope", "all").lower()

    if scope == "mine" and not auth_user:
        return jsonify({"success": False, "error": "Sign in to view your personal scan records."}), 401

    try:
        with get_db_connection() as conn:
            if scope == "mine" and auth_user:
                rows = conn.execute(
                    """
                    SELECT id, image_filename, plant_name, disease_name, confidence, created_at, user_id, user_name, flagged, review_note
                    FROM scans
                    WHERE user_id = ?
                    ORDER BY id DESC
                    """,
                    (auth_user["id"],),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT id, image_filename, plant_name, disease_name, confidence, created_at, user_id, user_name, flagged, review_note
                    FROM scans
                    ORDER BY id DESC
                    """
                ).fetchall()

        records = [
            {
                "id": row["id"],
                "plant": row["plant_name"],
                "disease": row["disease_name"],
                "confidence": row["confidence"],
                "image_url": f"/uploads/{row['image_filename']}",
                "created_at": row["created_at"],
                "user_id": row["user_id"],
                "user_name": row["user_name"] or "Field Grower",
                "flagged": bool(row["flagged"]),
                "review_note": row["review_note"] or "",
                "can_delete": bool(
                    auth_user and (auth_user["role"] == "admin" or row["user_id"] == auth_user["id"])
                ),
            }
            for row in rows
        ]
        return jsonify({"success": True, "history": records})
    except sqlite3.Error as exc:
        return jsonify({"success": False, "error": f"Database error reading history: {exc}"}), 500


@app.route("/api/history/<int:scan_id>", methods=["DELETE"])
@require_auth
def delete_scan_history(scan_id: int):
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM scans WHERE id = ?", (scan_id,)).fetchone()
        if not row:
            return jsonify({"success": False, "error": "Scan record not found."}), 404

        is_admin = g.auth_user["role"] == "admin"
        is_owner = row["user_id"] is not None and row["user_id"] == g.auth_user["id"]
        if not is_admin and not is_owner:
            return jsonify({"success": False, "error": "Permission denied."}), 403

        conn.execute("DELETE FROM scans WHERE id = ?", (scan_id,))
        record_audit_event(
            conn,
            "SCAN_DELETED",
            g.auth_user["email"],
            g.auth_user["role"],
            f"scan#{scan_id}",
            f"Deleted {row['plant_name']} — {row['disease_name']}",
        )
        conn.commit()

    safe_path = os.path.abspath(os.path.join(app.config["UPLOAD_FOLDER"], os.path.basename(row["image_filename"])))
    if safe_path.startswith(os.path.abspath(app.config["UPLOAD_FOLDER"]) + os.sep) and os.path.isfile(safe_path):
        os.remove(safe_path)

    return jsonify({"success": True, "deleted_id": scan_id})


@app.route("/api/stats", methods=["GET"])
def stats():
    try:
        with get_db_connection() as conn:
            rows = conn.execute("SELECT disease_name, confidence, flagged FROM scans").fetchall()

        total_scans = len(rows)
        healthy_plants = sum(1 for row in rows if is_healthy_label(row["disease_name"]))
        diseased_plants = total_scans - healthy_plants
        avg_confidence = (
            round(sum(float(row["confidence"]) for row in rows) / total_scans, 1)
            if total_scans > 0
            else 0.0
        )
        flagged_scans = sum(1 for row in rows if row["flagged"])

        return jsonify(
            {
                "success": True,
                "total_scans": total_scans,
                "healthy_plants": healthy_plants,
                "diseased_plants": diseased_plants,
                "avg_confidence": avg_confidence,
                "flagged_scans": flagged_scans,
            }
        )
    except sqlite3.Error as exc:
        return jsonify({"success": False, "error": f"Database error computing statistics: {exc}"}), 500


@app.route("/api/analytics", methods=["GET"])
def analytics():
    auth_user, _ = resolve_authenticated_user()
    scope = request.args.get("scope", "all").lower()

    with get_db_connection() as conn:
        if scope == "mine" and auth_user:
            rows = conn.execute(
                "SELECT plant_name, disease_name, confidence, created_at, flagged FROM scans WHERE user_id = ?",
                (auth_user["id"],),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT plant_name, disease_name, confidence, created_at, flagged FROM scans"
            ).fetchall()

    total = len(rows)
    healthy_count = sum(1 for r in rows if is_healthy_label(r["disease_name"]))
    diseased_count = total - healthy_count
    flagged_count = sum(1 for r in rows if r["flagged"])
    avg_confidence = round(sum(float(r["confidence"]) for r in rows) / total, 1) if total > 0 else 0.0

    crop_map: dict[str, dict] = {}
    disease_map: dict[tuple[str, str], dict] = {}
    daily_map: dict[str, dict] = {}
    bucket_low = bucket_mid = bucket_high = 0

    for r in rows:
        plant = str(r["plant_name"] or "Unknown").strip()
        disease = str(r["disease_name"] or "Unknown").strip()
        conf = float(r["confidence"] or 0.0)
        healthy = is_healthy_label(disease)
        date_key = str(r["created_at"] or "")[:10] or "Unknown"

        if conf < 70:
            bucket_low += 1
        elif conf < 85:
            bucket_mid += 1
        else:
            bucket_high += 1

        c_entry = crop_map.setdefault(plant, {"plant": plant, "total": 0, "healthy": 0, "diseased": 0, "conf_sum": 0.0})
        c_entry["total"] += 1
        c_entry["healthy" if healthy else "diseased"] += 1
        c_entry["conf_sum"] += conf

        d_entry = disease_map.setdefault(
            (plant, disease),
            {"disease": disease, "plant": plant, "count": 0, "conf_sum": 0.0, "is_healthy": healthy},
        )
        d_entry["count"] += 1
        d_entry["conf_sum"] += conf

        day_entry = daily_map.setdefault(date_key, {"date": date_key, "total": 0, "healthy": 0, "diseased": 0})
        day_entry["total"] += 1
        day_entry["healthy" if healthy else "diseased"] += 1

    crop_breakdown = sorted(
        [
            {
                "plant": c["plant"],
                "total": c["total"],
                "healthy": c["healthy"],
                "diseased": c["diseased"],
                "avg_confidence": round(c["conf_sum"] / c["total"], 1),
            }
            for c in crop_map.values()
        ],
        key=lambda x: x["total"],
        reverse=True,
    )[:8]

    disease_breakdown = sorted(
        [
            {
                "disease": d["disease"],
                "plant": d["plant"],
                "count": d["count"],
                "avg_confidence": round(d["conf_sum"] / d["count"], 1),
                "is_healthy": d["is_healthy"],
            }
            for d in disease_map.values()
        ],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]

    daily_series = [daily_map[k] for k in sorted(daily_map.keys())][-14:]

    return jsonify(
        {
            "success": True,
            "summary": {
                "total_scans": total,
                "healthy_count": healthy_count,
                "diseased_count": diseased_count,
                "healthy_rate": round((healthy_count / total) * 100, 1) if total > 0 else 0.0,
                "avg_confidence": avg_confidence,
                "distinct_crops": len(crop_map),
                "flagged_count": flagged_count,
            },
            "confidence_distribution": [
                {"label": "< 70%", "key": "low", "count": bucket_low},
                {"label": "70 – 84.9%", "key": "mid", "count": bucket_mid},
                {"label": "85 – 100%", "key": "high", "count": bucket_high},
            ],
            "crop_breakdown": crop_breakdown,
            "disease_breakdown": disease_breakdown,
            "daily_series": daily_series,
        }
    )


@app.route("/api/weather", methods=["GET"])
def weather():
    lang = "hi" if request.args.get("lang", "en").lower().startswith("hi") else "en"
    city_query = request.args.get("city", "").strip()
    lat_arg = request.args.get("lat")
    lon_arg = request.args.get("lon")

    latitude = 28.6139
    longitude = 77.2090
    location_name = "New Delhi, India"

    try:
        if city_query:
            if len(city_query) > 80:
                return jsonify({"success": False, "error": "Location query is too long."}), 400
            geo_params = urllib.parse.urlencode(
                {"name": city_query, "count": 1, "language": "en", "format": "json"}
            )
            geo_url = f"https://geocoding-api.open-meteo.com/v1/search?{geo_params}"
            with urllib.request.urlopen(geo_url, timeout=7) as resp:
                geo_data = json.loads(resp.read().decode("utf-8"))
            results = geo_data.get("results") or []
            if not results:
                return jsonify({"success": False, "error": f"No location matched '{city_query}'."}), 404
            match = results[0]
            latitude = float(match["latitude"])
            longitude = float(match["longitude"])
            parts = [match.get("name"), match.get("admin1"), match.get("country")]
            location_name = ", ".join([p for p in parts if p])
        elif lat_arg is not None and lon_arg is not None:
            latitude = float(lat_arg)
            longitude = float(lon_arg)
            if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                return jsonify({"success": False, "error": "Invalid coordinate bounds."}), 400
            location_name = f"{latitude:.2f}°, {longitude:.2f}°"

        weather_params = urllib.parse.urlencode(
            {
                "latitude": latitude,
                "longitude": longitude,
                "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,surface_pressure,wind_speed_10m,dew_point_2m",
                "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
                "timezone": "auto",
                "forecast_days": 5,
            }
        )
        forecast_url = f"https://api.open-meteo.com/v1/forecast?{weather_params}"
        with urllib.request.urlopen(forecast_url, timeout=8) as resp:
            weather_data = json.loads(resp.read().decode("utf-8"))

        cur = weather_data.get("current") or {}
        temp_c = float(cur.get("temperature_2m", 24.0))
        humidity = float(cur.get("relative_humidity_2m", 60.0))
        dew_point_c = float(cur.get("dew_point_2m", temp_c - 5.0))
        precip_mm = float(cur.get("precipitation", 0.0))
        wind_kmh = float(cur.get("wind_speed_10m", 6.0))
        code = int(cur.get("weather_code", 0))

        daily = weather_data.get("daily") or {}
        times = daily.get("time") or []
        forecast = [
            {
                "date": d,
                "weather_code": int((daily.get("weather_code") or [0])[i]),
                "condition": map_weather_code_label(int((daily.get("weather_code") or [0])[i]), lang),
                "temp_max_c": float((daily.get("temperature_2m_max") or [0])[i]),
                "temp_min_c": float((daily.get("temperature_2m_min") or [0])[i]),
                "precip_mm": float((daily.get("precipitation_sum") or [0])[i]),
                "precip_prob": float((daily.get("precipitation_probability_max") or [0])[i]),
                "wind_max_kmh": float((daily.get("wind_speed_10m_max") or [0])[i]),
            }
            for i, d in enumerate(times)
        ]

        return jsonify(
            {
                "success": True,
                "location": {
                    "name": location_name,
                    "latitude": latitude,
                    "longitude": longitude,
                    "timezone": weather_data.get("timezone", "UTC"),
                },
                "current": {
                    "observed_at": cur.get("time") or now_str(),
                    "temperature_c": temp_c,
                    "apparent_temperature_c": float(cur.get("apparent_temperature", temp_c)),
                    "humidity_pct": humidity,
                    "dew_point_c": dew_point_c,
                    "precipitation_mm": precip_mm,
                    "cloud_cover_pct": float(cur.get("cloud_cover", 0)),
                    "pressure_hpa": float(cur.get("surface_pressure", 1013)),
                    "wind_speed_kmh": wind_kmh,
                    "weather_code": code,
                    "condition": map_weather_code_label(code, lang),
                },
                "agronomy_risk": compute_crop_weather_risk(temp_c, humidity, dew_point_c, precip_mm, wind_kmh, lang),
                "forecast": forecast,
            }
        )
    except (ValueError, urllib.error.URLError, TimeoutError) as exc:
        return jsonify({"success": False, "error": f"Unable to fetch weather forecast: {exc}"}), 500


@app.route("/api/admin/overview", methods=["GET"])
@require_admin
def admin_overview():
    with get_db_connection() as conn:
        users = conn.execute("SELECT role, status FROM users").fetchall()
        scans = conn.execute("SELECT disease_name, flagged FROM scans").fetchall()
        audit_count = conn.execute("SELECT COUNT(*) FROM audit_logs").fetchone()[0]

    total_scans = len(scans)
    healthy_scans = sum(1 for s in scans if is_healthy_label(s["disease_name"]))
    diseased_scans = total_scans - healthy_scans

    return jsonify(
        {
            "success": True,
            "overview": {
                "total_users": len(users),
                "active_users": sum(1 for u in users if u["status"] == "active"),
                "suspended_users": sum(1 for u in users if u["status"] == "suspended"),
                "admin_count": sum(1 for u in users if u["role"] == "admin" and u["status"] == "active"),
                "total_scans": total_scans,
                "healthy_scans": healthy_scans,
                "diseased_scans": diseased_scans,
                "disease_rate": round((diseased_scans / total_scans) * 100, 1) if total_scans > 0 else 0.0,
                "flagged_scans": sum(1 for s in scans if s["flagged"]),
                "audit_events": audit_count,
            },
        }
    )


@app.route("/api/admin/users", methods=["GET"])
@require_admin
def admin_users():
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT u.*, COUNT(s.id) AS scan_count
            FROM users u
            LEFT JOIN scans s ON s.user_id = u.id
            GROUP BY u.id
            ORDER BY u.id ASC
            """
        ).fetchall()

    users_list = []
    for row in rows:
        item = sanitize_user_row(row)
        item["scan_count"] = row["scan_count"]
        users_list.append(item)

    return jsonify({"success": True, "users": users_list})


@app.route("/api/admin/users/<int:target_id>", methods=["PATCH"])
@require_admin
def admin_update_user(target_id: int):
    payload = request.get_json(silent=True) or {}
    with get_db_connection() as conn:
        current = conn.execute("SELECT * FROM users WHERE id = ?", (target_id,)).fetchone()
        if not current:
            return jsonify({"success": False, "error": "User not found."}), 404

        next_role = str(payload.get("role", current["role"])).strip()
        next_status = str(payload.get("status", current["status"])).strip()
        if next_role not in ALLOWED_ROLES:
            return jsonify({"success": False, "error": "Invalid user role."}), 400
        if next_status not in ALLOWED_STATUSES:
            return jsonify({"success": False, "error": "Invalid user status."}), 400

        remaining_admins = conn.execute(
            "SELECT COUNT(*) FROM users WHERE id != ? AND role = 'admin' AND status = 'active'",
            (target_id,),
        ).fetchone()[0]
        if (
            current["role"] == "admin"
            and current["status"] == "active"
            and (next_role != "admin" or next_status != "active")
            and remaining_admins == 0
        ):
            return (
                jsonify({"success": False, "error": "Cannot demote or suspend the last remaining active administrator."}),
                400,
            )

        conn.execute("UPDATE users SET role = ?, status = ? WHERE id = ?", (next_role, next_status, target_id))
        if next_status != "active":
            conn.execute("DELETE FROM sessions WHERE user_id = ?", (target_id,))

        record_audit_event(
            conn,
            "ADMIN_USER_UPDATED",
            g.auth_user["email"],
            g.auth_user["role"],
            current["email"],
            f"Role: {current['role']} -> {next_role}, Status: {current['status']} -> {next_status}",
        )
        updated = conn.execute("SELECT * FROM users WHERE id = ?", (target_id,)).fetchone()
        conn.commit()

    return jsonify({"success": True, "user": sanitize_user_row(updated)})


@app.route("/api/admin/scans", methods=["GET"])
@require_admin
def admin_scans():
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT s.*, u.email AS user_email
            FROM scans s
            LEFT JOIN users u ON u.id = s.user_id
            ORDER BY s.id DESC
            """
        ).fetchall()

    return jsonify(
        {
            "success": True,
            "scans": [
                {
                    "id": row["id"],
                    "plant": row["plant_name"],
                    "disease": row["disease_name"],
                    "confidence": row["confidence"],
                    "image_url": f"/uploads/{row['image_filename']}",
                    "created_at": row["created_at"],
                    "user_id": row["user_id"],
                    "user_name": row["user_name"] or "Guest Grower",
                    "user_email": row["user_email"] or "—",
                    "flagged": bool(row["flagged"]),
                    "review_note": row["review_note"] or "",
                }
                for row in rows
            ],
        }
    )


@app.route("/api/admin/scans/<int:scan_id>", methods=["PATCH", "DELETE"])
@require_admin
def admin_manage_scan(scan_id: int):
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM scans WHERE id = ?", (scan_id,)).fetchone()
        if not row:
            return jsonify({"success": False, "error": "Scan record not found."}), 404

        if request.method == "DELETE":
            conn.execute("DELETE FROM scans WHERE id = ?", (scan_id,))
            record_audit_event(
                conn,
                "ADMIN_SCAN_DELETED",
                g.auth_user["email"],
                g.auth_user["role"],
                f"scan#{scan_id}",
                f"Removed {row['plant_name']} — {row['disease_name']}",
            )
            conn.commit()
            safe_path = os.path.abspath(
                os.path.join(app.config["UPLOAD_FOLDER"], os.path.basename(row["image_filename"]))
            )
            if safe_path.startswith(os.path.abspath(app.config["UPLOAD_FOLDER"]) + os.sep) and os.path.isfile(safe_path):
                os.remove(safe_path)
            return jsonify({"success": True, "deleted_id": scan_id})

        payload = request.get_json(silent=True) or {}
        flagged = int(bool(payload.get("flagged", row["flagged"])))
        review_note = str(payload.get("review_note", row["review_note"] or "")).strip()[:300]
        conn.execute(
            "UPDATE scans SET flagged = ?, review_note = ? WHERE id = ?",
            (flagged, review_note, scan_id),
        )
        record_audit_event(
            conn,
            "ADMIN_SCAN_REVIEWED",
            g.auth_user["email"],
            g.auth_user["role"],
            f"scan#{scan_id}",
            f"Flagged: {bool(flagged)}",
        )
        conn.commit()

    return jsonify({"success": True, "scan": {"id": scan_id, "flagged": bool(flagged), "review_note": review_note}})


@app.route("/api/admin/audit-logs", methods=["GET"])
@require_admin
def admin_audit_logs():
    with get_db_connection() as conn:
        rows = conn.execute("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100").fetchall()
    return jsonify({"success": True, "logs": [dict(r) for r in rows]})


@app.errorhandler(413)
def file_too_large(_error):
    return jsonify({"success": False, "error": "File exceeds the 10 MB maximum upload limit."}), 413


@app.errorhandler(404)
def not_found(_error):
    if request.path.startswith("/api/"):
        return jsonify({"success": False, "error": "API endpoint not found."}), 404
    return jsonify({"success": False, "error": "Resource not found."}), 404


@app.errorhandler(500)
def internal_server_error(_error):
    return jsonify({"success": False, "error": "Internal server error."}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
