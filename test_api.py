"""
Automated API and SQLite verification tests for the PlantCare Flask backend.
Run with:
  python test_api.py
Optional live prediction test on an actual leaf image (requires trained model):
  python test_api.py --image path/to/leaf.jpg --lang hi
"""

import argparse
from io import BytesIO
import os
import sqlite3
import sys
import uuid

from app import DATABASE_PATH, app, predictor


def run_suite(sample_image_path: str | None = None, lang: str = "en") -> int:
    client = app.test_client()

    print("1. Testing GET /api/stats ...")
    stats_resp = client.get("/api/stats")
    assert stats_resp.status_code == 200, f"Expected 200, got {stats_resp.status_code}"
    stats_json = stats_resp.get_json()
    assert stats_json["success"] is True
    for key in ("total_scans", "healthy_plants", "diseased_plants", "avg_confidence", "flagged_scans"):
        assert key in stats_json, f"Missing stats key: {key}"
    print("   OK:", stats_json)

    print("2. Testing GET /api/history & GET /api/analytics ...")
    hist_resp = client.get("/api/history")
    assert hist_resp.status_code == 200
    hist_json = hist_resp.get_json()
    assert hist_json["success"] is True and isinstance(hist_json["history"], list)

    analytics_resp = client.get("/api/analytics")
    assert analytics_resp.status_code == 200
    analytics_json = analytics_resp.get_json()
    assert analytics_json["success"] is True and "summary" in analytics_json
    print(f"   OK: {len(hist_json['history'])} saved scan(s), analytics summary keys verified.")

    print("3. Testing user registration, login, and role protection ...")
    test_email = f"grower_{uuid.uuid4().hex[:8]}@example.com"
    reg_resp = client.post(
        "/api/auth/register",
        json={
            "full_name": "Test Grower",
            "email": test_email,
            "password": "StrongPassword123",
            "farm_location": "Pune, India",
        },
    )
    assert reg_resp.status_code == 201, f"Expected 201, got {reg_resp.status_code}"
    reg_json = reg_resp.get_json()
    token = reg_json["token"]
    assert reg_json["user"]["role"] == "user"

    # Standard user must be blocked from admin overview
    admin_unauth = client.get("/api/admin/overview")
    assert admin_unauth.status_code == 401
    admin_forbidden = client.get(
        "/api/admin/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert admin_forbidden.status_code == 403
    print("   OK: Auth registration & admin RBAC checks enforced.")

    print("4. Testing POST /api/predict validation (missing file & corrupted bytes) ...")
    missing_resp = client.post("/api/predict")
    assert missing_resp.status_code == 400
    assert missing_resp.get_json()["success"] is False

    corrupt_resp = client.post(
        "/api/predict",
        data={"image": (BytesIO(b"not-an-image"), "fake.jpg")},
        content_type="multipart/form-data",
    )
    assert corrupt_resp.status_code == 400
    assert corrupt_resp.get_json()["success"] is False
    print("   OK: Invalid uploads rejected safely with HTTP 400.")

    print("5. Checking SQLite database schema at database/plantcare.db ...")
    assert os.path.exists(DATABASE_PATH), "database/plantcare.db does not exist!"
    with sqlite3.connect(DATABASE_PATH) as conn:
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
        for required in ("scans", "users", "sessions", "audit_logs"):
            assert required in tables, f"Missing table: {required}"
        cols = [row[1] for row in conn.execute("PRAGMA table_info(scans)").fetchall()]
    for col in ("id", "image_filename", "plant_name", "disease_name", "confidence", "created_at"):
        assert col in cols, f"Missing column {col} in scans"
    print("   OK: SQLite tables and columns verified:", sorted(tables))

    if sample_image_path:
        print(f"6. Testing POST /api/predict with real image '{sample_image_path}' (lang={lang}) ...")
        if not predictor.is_ready:
            print("   Model unavailable:", predictor.load_error)
            return 1
        with open(sample_image_path, "rb") as fh:
            pred_resp = client.post(
                "/api/predict",
                data={"image": (fh, os.path.basename(sample_image_path)), "lang": lang},
                content_type="multipart/form-data",
            )
        print("   Status:", pred_resp.status_code)
        print("   Response:", pred_resp.get_json())
    else:
        print("6. Skipping live image prediction (--image not supplied). Model ready:", predictor.is_ready)
        if not predictor.is_ready:
            print("   Model status:", predictor.load_error)

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test PlantCare Flask backend endpoints.")
    parser.add_argument("--image", help="Path to an actual JPG/PNG leaf image for live prediction testing")
    parser.add_argument("--lang", default="en", choices=["en", "hi"], help="Prediction language (en or hi)")
    args = parser.parse_args()
    sys.exit(run_suite(args.image, args.lang))
