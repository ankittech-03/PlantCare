import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { GoogleGenAI, ThinkingLevel, Type, type GenerateContentResponse } from "@google/genai";

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = path.resolve(process.cwd());
const UPLOADS_DIR = path.resolve(ROOT_DIR, "uploads");
const DATA_DIR = path.resolve(ROOT_DIR, "data");
const SCANS_FILE = path.resolve(DATA_DIR, "scans.json");
const USERS_FILE = path.resolve(DATA_DIR, "users.json");
const SESSIONS_FILE = path.resolve(DATA_DIR, "sessions.json");
const AUDIT_FILE = path.resolve(DATA_DIR, "audit_logs.json");
const DIST_DIR = path.resolve(ROOT_DIR, "dist");

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const ALLOWED_ROLES = new Set(["user", "agronomist", "admin"]);
const ALLOWED_STATUSES = new Set(["active", "suspended"]);

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

type UserRole = "user" | "agronomist" | "admin";
type UserStatus = "active" | "suspended";

interface UserRecord {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  farm_location: string;
  created_at: string;
  last_login_at: string | null;
}

interface SessionRecord {
  token_hash: string;
  user_id: number;
  created_at: string;
  expires_at: number;
}

interface AuditLogRecord {
  id: number;
  action: string;
  actor_email: string;
  actor_role: string;
  target: string;
  details: string;
  created_at: string;
}

interface ScanRecord {
  id: number;
  plant: string;
  disease: string;
  confidence: number;
  description: string;
  symptoms: string[];
  recommendations: string[];
  image_url: string;
  created_at: string;
  user_id?: number | null;
  user_name?: string | null;
  user_email?: string | null;
  flagged?: boolean;
  review_note?: string;
}

interface ClassificationPayload {
  is_plant_leaf: boolean;
  error_reason?: string;
  plant: string;
  disease: string;
  confidence: number;
  description: string;
  symptoms: string[];
  recommendations: string[];
}

interface AuthenticatedRequest extends Request {
  authUser?: UserRecord;
  authTokenHash?: string;
}

function readJsonArray<T>(filePath: string): T[] {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(filePath: string, data: T[]): void {
  const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tempPath, filePath);
}

function readScans(): ScanRecord[] {
  return readJsonArray<ScanRecord>(SCANS_FILE);
}

function writeScans(scans: ScanRecord[]): void {
  writeJsonArray(SCANS_FILE, scans);
}

function readUsers(): UserRecord[] {
  return readJsonArray<UserRecord>(USERS_FILE);
}

function writeUsers(users: UserRecord[]): void {
  writeJsonArray(USERS_FILE, users);
}

function readSessions(): SessionRecord[] {
  const now = Date.now();
  return readJsonArray<SessionRecord>(SESSIONS_FILE).filter((s) => s.expires_at > now);
}

function writeSessions(sessions: SessionRecord[]): void {
  writeJsonArray(SESSIONS_FILE, sessions);
}

function readAuditLogs(): AuditLogRecord[] {
  return readJsonArray<AuditLogRecord>(AUDIT_FILE);
}

function recordAuditEvent(
  action: string,
  actorEmail: string,
  actorRole: string,
  target: string,
  details: string
): void {
  const logs = readAuditLogs();
  const nextId = logs.length > 0 ? Math.max(...logs.map((l) => Number(l.id) || 0)) + 1 : 1;
  logs.unshift({
    id: nextId,
    action,
    actor_email: actorEmail,
    actor_role: actorRole,
    target,
    details,
    created_at: formatTimestamp(new Date()),
  });
  writeJsonArray(AUDIT_FILE, logs.slice(0, 250));
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const [, salt, hexHash] = parts;
  if (!salt || !hexHash) return false;
  try {
    const expected = Buffer.from(hexHash, "hex");
    const actual = crypto.scryptSync(password, salt, 64);
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function safeCompareSecret(provided: string, expected: string): boolean {
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function sanitizeUser(user: UserRecord) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    status: user.status,
    farm_location: user.farm_location || "",
    created_at: user.created_at,
    last_login_at: user.last_login_at || null,
  };
}

function createSessionForUser(userId: number): string {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const sessions = readSessions();
  sessions.push({
    token_hash: tokenHash,
    user_id: userId,
    created_at: formatTimestamp(new Date()),
    expires_at: Date.now() + SESSION_TTL_MS,
  });
  writeSessions(sessions);
  return rawToken;
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+([A-Za-z0-9._-]+)$/i);
  return match ? match[1] : null;
}

function resolveAuthenticatedUser(req: Request): { user: UserRecord; tokenHash: string } | null {
  const rawToken = extractBearerToken(req);
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);
  const sessions = readSessions();
  const session = sessions.find((s) => s.token_hash === tokenHash);
  if (!session) return null;
  const users = readUsers();
  const user = users.find((u) => u.id === session.user_id);
  if (!user || user.status !== "active") return null;
  return { user, tokenHash };
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const resolved = resolveAuthenticatedUser(req);
  if (!resolved) {
    res.status(401).json({
      success: false,
      error: "Authentication required. Please sign in to continue.",
    });
    return;
  }
  req.authUser = resolved.user;
  req.authTokenHash = resolved.tokenHash;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const resolved = resolveAuthenticatedUser(req);
  if (!resolved) {
    res.status(401).json({
      success: false,
      error: "Administrator sign-in is required to access this console.",
    });
    return;
  }
  if (resolved.user.role !== "admin") {
    // Use HTTP 401 rather than 403 so upstream preview proxies do not rewrite JSON errors into HTML pages
    res.status(401).json({
      success: false,
      error: "Administrator permissions are required for this action.",
    });
    return;
  }
  req.authUser = resolved.user;
  req.authTokenHash = resolved.tokenHash;
  next();
}

function isHealthyDisease(diseaseName: string): boolean {
  const d = String(diseaseName || "").toLowerCase();
  return d.includes("healthy") || d.includes("स्वस्थ");
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add it in Settings > Secrets to enable leaf diagnostics."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function detectImageTypeFromMagicBytes(
  buffer: Buffer
): { ext: "jpg" | "png"; mimeType: "image/jpeg" | "image/png" } | null {
  if (buffer.length < 8) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: "jpg", mimeType: "image/jpeg" };
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: "png", mimeType: "image/png" };
  }
  return null;
}

function resolveSafeUploadPath(filename: string): string | null {
  const baseName = path.basename(filename);
  if (!baseName || !/^[a-zA-Z0-9._-]+$/.test(baseName)) {
    return null;
  }
  const resolved = path.resolve(UPLOADS_DIR, baseName);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
    return null;
  }
  return resolved;
}

function isTransientServiceError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const name = err instanceof Error ? err.name : "";
  return (
    name === "AbortError" ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("DEADLINE_EXCEEDED") ||
    msg.includes("high demand") ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.toLowerCase().includes("timed out") ||
    msg.toLowerCase().includes("aborted")
  );
}

function formatUpstreamError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (raw.includes("GEMINI_API_KEY") || raw.includes("API_KEY_INVALID") || raw.includes("PERMISSION_DENIED")) {
    return {
      status: 500,
      message:
        "The server diagnostic API key is missing or invalid. Please verify GEMINI_API_KEY in Settings > Secrets.",
    };
  }
  if (isTransientServiceError(err)) {
    return {
      status: 429,
      message:
        "The diagnostic service is temporarily busy due to high demand. Please wait a few seconds and click Analyze Plant again.",
    };
  }
  return {
    status: 500,
    message: raw || "An unexpected error occurred while classifying the leaf image.",
  };
}

async function callModelForLeaf(
  ai: GoogleGenAI,
  model: string,
  imageBuffer: Buffer,
  mimeType: "image/jpeg" | "image/png",
  prompt: string,
  perAttemptTimeoutMs: number,
  retryAttempts: number
): Promise<ClassificationPayload> {
  // Guard the full retry sequence cleanly without aborting a valid retry mid-flight
  const totalBudgetMs = perAttemptTimeoutMs * Math.max(1, retryAttempts) + 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), totalBudgetMs);

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBuffer.toString("base64"),
            },
          },
          { text: prompt },
        ],
      },
      config: {
        abortSignal: controller.signal,
        httpOptions: {
          timeout: perAttemptTimeoutMs,
          retryOptions: {
            attempts: retryAttempts,
            initialDelay: 0.5,
            maxDelay: 2.0,
          },
        },
        thinkingConfig: {
          thinkingLevel:
            model === "gemini-3.1-flash-lite" ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
        },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            is_plant_leaf: {
              type: Type.BOOLEAN,
              description: "True if the image depicts a plant leaf or foliage.",
            },
            error_reason: {
              type: Type.STRING,
              description: "Explanation if is_plant_leaf is false.",
            },
            plant: {
              type: Type.STRING,
              description: "Identified plant or crop name.",
            },
            disease: {
              type: Type.STRING,
              description: "Disease name or 'Healthy'.",
            },
            confidence: {
              type: Type.NUMBER,
              description: "Confidence percentage from 0 to 100.",
            },
            description: {
              type: Type.STRING,
              description: "Overview of the detected condition or leaf health.",
            },
            symptoms: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Observed foliar symptoms.",
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Actionable crop management recommendations.",
            },
          },
          required: [
            "is_plant_leaf",
            "plant",
            "disease",
            "confidence",
            "description",
            "symptoms",
            "recommendations",
          ],
        },
      },
    });

    const rawText = (response.text ?? "").trim();
    if (!rawText) {
      throw new Error("The classification service returned an empty response.");
    }
    return JSON.parse(rawText) as ClassificationPayload;
  } finally {
    clearTimeout(timer);
  }
}

async function classifyLeafSpecimen(
  imageBuffer: Buffer,
  mimeType: "image/jpeg" | "image/png",
  lang: "en" | "hi" = "en"
): Promise<ClassificationPayload> {
  const ai = getGeminiClient();

  const languageInstruction =
    lang === "hi"
      ? " Respond strictly in natural, clear Hindi (Devanagari script) for plant, disease (for healthy leaves write 'स्वस्थ (Healthy)'), description, symptoms, recommendations, and error_reason."
      : " Respond in clear English.";

  const prompt =
    "Examine this photograph as a plant pathology specialist. " +
    "First determine whether the image clearly shows a plant leaf or crop foliage. " +
    "If the image is NOT a plant leaf (for example, a person, vehicle, document, or unrelated object), " +
    "set is_plant_leaf to false and explain briefly in error_reason. " +
    "If it IS a plant leaf, set is_plant_leaf to true and provide: " +
    "1) plant: common plant or crop species name (e.g., 'Tomato', 'Potato', 'Apple', 'Maize'), " +
    "2) disease: specific disease name if affected (e.g., 'Early Blight', 'Powdery Mildew', 'Late Blight') or 'Healthy' if no disease symptoms are visible, " +
    "3) confidence: realistic classification confidence percentage between 0 and 100, " +
    "4) description: concise, accurate botanical pathology overview of the condition, " +
    "5) symptoms: 2 to 5 concise observable leaf symptoms, " +
    "6) recommendations: 2 to 5 practical, safe crop management recommendations." +
    languageInstruction;

  const attempts: Array<{ model: string; timeoutMs: number; retryAttempts: number }> = [
    { model: "gemini-4-hydrogen", timeoutMs: 25000, retryAttempts: 1 },
    { model: "gemini-3.1-flash-lite", timeoutMs: 22000, retryAttempts: 2 },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await callModelForLeaf(
        ai,
        attempt.model,
        imageBuffer,
        mimeType,
        prompt,
        attempt.timeoutMs,
        attempt.retryAttempts
      );
    } catch (err) {
      lastError = err;
      if (!isTransientServiceError(err)) {
        throw err;
      }
    }
  }

  const finalSummary = lastError instanceof Error ? lastError.message : String(lastError);
  console.error(`[PlantCare] Leaf classification failed across fallback models: ${finalSummary.slice(0, 180)}`);
  throw lastError;
}

function mapWeatherCodeLabel(code: number, lang: "en" | "hi"): string {
  const enMap: Record<number, string> = {
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
  };
  const hiMap: Record<number, string> = {
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
  };
  const table = lang === "hi" ? hiMap : enMap;
  if (table[code]) return table[code];
  return lang === "hi" ? "परिवर्तनशील मौसम" : "Variable Conditions";
}

function computeCropWeatherRisk(
  tempC: number,
  humidity: number,
  dewPointC: number,
  precipMm: number,
  windKmh: number,
  lang: "en" | "hi"
) {
  const dewSpread = Math.max(0, tempC - dewPointC);

  const lateBlightScore =
    (humidity >= 80 ? 45 : humidity >= 65 ? 25 : 5) +
    (tempC >= 12 && tempC <= 24 ? 30 : tempC >= 8 && tempC <= 28 ? 15 : 0) +
    (precipMm > 0.2 || dewSpread <= 3 ? 25 : 0);

  const powderyMildewScore =
    (tempC >= 20 && tempC <= 30 ? 40 : tempC >= 15 && tempC <= 34 ? 20 : 5) +
    (humidity >= 50 && humidity <= 80 ? 35 : humidity > 80 ? 20 : 10) +
    (precipMm < 0.5 ? 25 : 0);

  const bacterialSpotScore =
    (tempC >= 22 && tempC <= 33 ? 35 : 10) +
    (humidity >= 75 ? 35 : 15) +
    (precipMm > 0 || windKmh >= 15 ? 30 : 10);

  const level = (score: number): "high" | "moderate" | "low" =>
    score >= 70 ? "high" : score >= 40 ? "moderate" : "low";

  const overallScore = Math.max(lateBlightScore, powderyMildewScore, bacterialSpotScore);
  const overallLevel = level(overallScore);

  let sprayWindow: "optimal" | "caution" | "avoid" = "optimal";
  if (precipMm >= 0.5 || windKmh >= 20) {
    sprayWindow = "avoid";
  } else if (windKmh >= 12 || humidity >= 88 || tempC >= 33) {
    sprayWindow = "caution";
  }

  const advisories: string[] = [];
  if (lang === "hi") {
    if (lateBlightScore >= 70) {
      advisories.push("अधिक नमी और कम ओस-अंतराल के कारण आलू और टमाटर में लेट ब्लाइट का उच्च जोखिम है।");
    }
    if (powderyMildewScore >= 70) {
      advisories.push("गर्म और शुष्क-नम मौसम में चूर्णिल आसिता (Powdery Mildew) के लिए पत्तियों की जांच बढ़ाएं।");
    }
    if (bacterialSpotScore >= 70) {
      advisories.push("हवा और बारिश के छींटों से जीवाणु धब्बा रोग फैलने की संभावना अधिक है।");
    }
    if (sprayWindow === "avoid") {
      advisories.push("तेज हवा या वर्षा के कारण अभी पत्तियों पर छिड़काव से बचें।");
    } else if (sprayWindow === "optimal") {
      advisories.push("निचली हवा और बिना वर्षा के कारण सुबह या शाम का समय खेत छिड़काव के लिए अनुकूल है।");
    } else {
      advisories.push("मध्यम हवा/नमी है — छिड़काव से पहले स्थानीय हवा की गति जांचें।");
    }
  } else {
    if (lateBlightScore >= 70) {
      advisories.push(
        "High humidity and narrow dew-point spread elevate Late Blight risk on tomato and potato foliage."
      );
    }
    if (powderyMildewScore >= 70) {
      advisories.push(
        "Warm canopy temperatures with dry-to-moderate humidity favor Powdery Mildew spore germination."
      );
    }
    if (bacterialSpotScore >= 70) {
      advisories.push(
        "Warm moisture and leaf surface wetness increase Bacterial Spot spread on pepper and tomato crops."
      );
    }
    if (sprayWindow === "avoid") {
      advisories.push(
        "Avoid foliar application during active rain or brisk wind to prevent wash-off and drift."
      );
    } else if (sprayWindow === "optimal") {
      advisories.push(
        "Calm wind and dry foliage provide a favorable window for morning or late-afternoon foliar care."
      );
    } else {
      advisories.push(
        "Marginal field window — check local breeze and leaf dryness before applying foliar treatments."
      );
    }
  }

  return {
    overall_risk: overallLevel,
    overall_score: overallScore,
    spray_window: sprayWindow,
    dew_spread_c: Math.round(dewSpread * 10) / 10,
    diseases: [
      { key: "late_blight", score: lateBlightScore, level: level(lateBlightScore) },
      { key: "powdery_mildew", score: powderyMildewScore, level: level(powderyMildewScore) },
      { key: "bacterial_spot", score: bacterialSpotScore, level: level(bacterialSpotScore) },
    ],
    advisories,
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Unsupported file format. Only JPG, JPEG, and PNG images are allowed."));
      return;
    }
    cb(null, true);
  },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  // Serve uploaded leaf specimen images securely
  app.get("/uploads/:filename", (req: Request, res: Response) => {
    const rawFilename = String(req.params.filename || "");
    const safePath = resolveSafeUploadPath(rawFilename);
    if (!safePath || !fs.existsSync(safePath)) {
      res.status(404).json({ success: false, error: "Image not found." });
      return;
    }
    res.sendFile(safePath);
  });

  /* ----------------------------------------------------------------------
     Authentication & User Account Endpoints
     ---------------------------------------------------------------------- */
  app.get("/api/auth/bootstrap-status", (_req: Request, res: Response) => {
    const users = readUsers();
    const adminExists = users.some((u) => u.role === "admin" && u.status === "active");
    const passcodeConfigured = Boolean((process.env.ADMIN_PASSCODE || "").trim());
    res.json({
      success: true,
      admin_exists: adminExists,
      passcode_configured: passcodeConfigured,
      total_users: users.length,
    });
  });

  app.post("/api/auth/register", (req: Request, res: Response) => {
    const fullName = String(req.body?.full_name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const farmLocation = String(req.body?.farm_location || "").trim().slice(0, 80);

    if (fullName.length < 2 || fullName.length > 80) {
      res.status(400).json({
        success: false,
        error: "Please enter a full name between 2 and 80 characters.",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({
        success: false,
        error: "Please enter a valid email address.",
      });
      return;
    }

    if (password.length < 8 || password.length > 128) {
      res.status(400).json({
        success: false,
        error: "Password must be between 8 and 128 characters.",
      });
      return;
    }

    const users = readUsers();
    if (users.some((u) => u.email === email)) {
      res.status(409).json({
        success: false,
        error: "An account with this email address already exists.",
      });
      return;
    }

    const nextId = users.length > 0 ? Math.max(...users.map((u) => Number(u.id) || 0)) + 1 : 1;
    const now = formatTimestamp(new Date());
    const newUser: UserRecord = {
      id: nextId,
      full_name: fullName,
      email,
      password_hash: hashPassword(password),
      role: "user",
      status: "active",
      farm_location: farmLocation,
      created_at: now,
      last_login_at: now,
    };

    users.push(newUser);
    writeUsers(users);

    const token = createSessionForUser(newUser.id);
    const adminExists = users.some((u) => u.role === "admin" && u.status === "active");
    recordAuditEvent(
      "USER_REGISTERED",
      newUser.email,
      newUser.role,
      `user#${newUser.id}`,
      `New account created (${newUser.full_name})`
    );

    res.status(201).json({
      success: true,
      token,
      user: sanitizeUser(newUser),
      admin_exists: adminExists,
    });
  });

  app.post("/api/auth/login", (req: Request, res: Response) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: "Email and password are required.",
      });
      return;
    }

    const users = readUsers();
    const userIndex = users.findIndex((u) => u.email === email);
    const user = userIndex >= 0 ? users[userIndex] : null;

    if (!user || !verifyPassword(password, user.password_hash)) {
      recordAuditEvent(
        "AUTH_FAILED",
        email || "unknown",
        "guest",
        "login",
        "Invalid email or password attempt"
      );
      res.status(401).json({
        success: false,
        error: "Invalid email address or password.",
      });
      return;
    }

    if (user.status !== "active") {
      recordAuditEvent(
        "AUTH_BLOCKED",
        user.email,
        user.role,
        `user#${user.id}`,
        "Sign-in blocked because account is suspended"
      );
      res.status(401).json({
        success: false,
        error: "This account has been suspended. Please contact an administrator.",
      });
      return;
    }

    users[userIndex] = {
      ...user,
      last_login_at: formatTimestamp(new Date()),
    };
    writeUsers(users);

    const token = createSessionForUser(user.id);
    const adminExists = users.some((u) => u.role === "admin" && u.status === "active");
    recordAuditEvent("USER_LOGIN", user.email, user.role, `user#${user.id}`, "User signed in");

    res.json({
      success: true,
      token,
      user: sanitizeUser(users[userIndex]),
      admin_exists: adminExists,
    });
  });

  app.post("/api/auth/logout", requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (req.authTokenHash) {
      const remaining = readSessions().filter((s) => s.token_hash !== req.authTokenHash);
      writeSessions(remaining);
    }
    if (req.authUser) {
      recordAuditEvent(
        "USER_LOGOUT",
        req.authUser.email,
        req.authUser.role,
        `user#${req.authUser.id}`,
        "User signed out"
      );
    }
    res.json({ success: true });
  });

  app.get("/api/auth/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const users = readUsers();
    const adminExists = users.some((u) => u.role === "admin" && u.status === "active");
    res.json({
      success: true,
      user: sanitizeUser(req.authUser!),
      admin_exists: adminExists,
    });
  });

  app.patch("/api/auth/profile", requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const fullName = String(req.body?.full_name ?? req.authUser!.full_name).trim();
    const farmLocation = String(req.body?.farm_location ?? req.authUser!.farm_location)
      .trim()
      .slice(0, 80);

    if (fullName.length < 2 || fullName.length > 80) {
      res.status(400).json({
        success: false,
        error: "Full name must be between 2 and 80 characters.",
      });
      return;
    }

    const users = readUsers();
    const idx = users.findIndex((u) => u.id === req.authUser!.id);
    if (idx < 0) {
      res.status(404).json({ success: false, error: "User record not found." });
      return;
    }

    users[idx] = {
      ...users[idx],
      full_name: fullName,
      farm_location: farmLocation,
    };
    writeUsers(users);

    recordAuditEvent(
      "PROFILE_UPDATED",
      users[idx].email,
      users[idx].role,
      `user#${users[idx].id}`,
      "Updated profile details"
    );

    res.json({ success: true, user: sanitizeUser(users[idx]) });
  });

  app.post("/api/auth/claim-admin", requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const users = readUsers();
    const configuredPasscode = (process.env.ADMIN_PASSCODE || "").trim();
    const providedPasscode = String(req.body?.passcode || "");
    const activeAdmins = users.filter((u) => u.role === "admin" && u.status === "active");

    if (configuredPasscode) {
      if (!providedPasscode || !safeCompareSecret(providedPasscode, configuredPasscode)) {
        recordAuditEvent(
          "ADMIN_CLAIM_DENIED",
          req.authUser!.email,
          req.authUser!.role,
          "admin",
          "Invalid admin passcode supplied"
        );
        res.status(401).json({
          success: false,
          error: "Invalid administrator passcode.",
        });
        return;
      }
    } else if (activeAdmins.length > 0) {
      res.status(401).json({
        success: false,
        error:
          "Initial administrator ownership has already been claimed. Ask an existing administrator to promote your account.",
      });
      return;
    }

    const idx = users.findIndex((u) => u.id === req.authUser!.id);
    if (idx < 0) {
      res.status(404).json({ success: false, error: "Account not found." });
      return;
    }

    users[idx] = { ...users[idx], role: "admin" };
    writeUsers(users);

    recordAuditEvent(
      "ADMIN_CLAIMED",
      users[idx].email,
      "admin",
      `user#${users[idx].id}`,
      configuredPasscode
        ? "Administrator role verified via server passcode"
        : "First-run administrator ownership claimed"
    );

    res.json({
      success: true,
      user: sanitizeUser(users[idx]),
      admin_exists: true,
    });
  });

  /* ----------------------------------------------------------------------
     Leaf Prediction, History & Statistics
     ---------------------------------------------------------------------- */
  app.post("/api/predict", (req: AuthenticatedRequest, res: Response) => {
    const resolvedAuth = resolveAuthenticatedUser(req);
    upload.single("image")(req, res, async (uploadErr: unknown) => {
      if (uploadErr) {
        if (uploadErr instanceof multer.MulterError && uploadErr.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({
            success: false,
            error: "File exceeds the 10 MB maximum upload limit.",
          });
          return;
        }
        const errMessage =
          uploadErr instanceof Error ? uploadErr.message : "Invalid file upload request.";
        res.status(400).json({ success: false, error: errMessage });
        return;
      }

      if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
        res.status(400).json({
          success: false,
          error: "No image file received under form field 'image'.",
        });
        return;
      }

      const detected = detectImageTypeFromMagicBytes(req.file.buffer);
      if (!detected) {
        res.status(400).json({
          success: false,
          error: "Invalid image file content. Please upload a valid JPG or PNG photograph.",
        });
        return;
      }

      try {
        const rawLang = String(req.body?.lang || "en").toLowerCase();
        const lang: "en" | "hi" = rawLang.startsWith("hi") ? "hi" : "en";
        const result = await classifyLeafSpecimen(req.file.buffer, detected.mimeType, lang);

        if (!result.is_plant_leaf) {
          res.status(400).json({
            success: false,
            error:
              result.error_reason ||
              "The uploaded image does not appear to be a plant leaf. Please upload a clear leaf photo.",
          });
          return;
        }

        const safeFilename = `${crypto.randomUUID()}.${detected.ext}`;
        const savePath = resolveSafeUploadPath(safeFilename);
        if (!savePath) {
          res.status(500).json({ success: false, error: "Failed to resolve upload destination." });
          return;
        }
        fs.writeFileSync(savePath, req.file.buffer);

        const plant = String(result.plant || "Unknown Plant").trim();
        const disease = String(result.disease || "Unknown Condition").trim();
        const rawConfidence = Number(result.confidence);
        const confidence = Number.isFinite(rawConfidence)
          ? Math.round(Math.max(0, Math.min(100, rawConfidence)) * 10) / 10
          : 0;
        const description = String(result.description || "").trim();
        const symptoms = Array.isArray(result.symptoms)
          ? result.symptoms.map((item) => String(item).trim()).filter(Boolean)
          : [];
        const recommendations = Array.isArray(result.recommendations)
          ? result.recommendations.map((item) => String(item).trim()).filter(Boolean)
          : [];

        const existingScans = readScans();
        const nextId =
          existingScans.length > 0
            ? Math.max(...existingScans.map((s) => Number(s.id) || 0)) + 1
            : 1;

        const newRecord: ScanRecord = {
          id: nextId,
          plant,
          disease,
          confidence,
          description,
          symptoms,
          recommendations,
          image_url: `/uploads/${safeFilename}`,
          created_at: formatTimestamp(new Date()),
          user_id: resolvedAuth?.user.id ?? null,
          user_name: resolvedAuth?.user.full_name ?? "Guest Grower",
          user_email: resolvedAuth?.user.email ?? null,
          flagged: false,
          review_note: "",
        };

        existingScans.unshift(newRecord);
        writeScans(existingScans);

        recordAuditEvent(
          "SCAN_CREATED",
          resolvedAuth?.user.email || "guest",
          resolvedAuth?.user.role || "guest",
          `scan#${nextId}`,
          `${plant} — ${disease} (${confidence}%)`
        );

        res.json({
          success: true,
          prediction: {
            plant,
            disease,
            confidence,
          },
          disease_info: {
            description,
            symptoms,
            recommendations,
          },
          scan_id: nextId,
        });
      } catch (err: unknown) {
        const formatted = formatUpstreamError(err);
        res.status(formatted.status).json({ success: false, error: formatted.message });
      }
    });
  });

  app.get("/api/history", (req: Request, res: Response) => {
    try {
      const resolvedAuth = resolveAuthenticatedUser(req);
      const scope = String(req.query.scope || "all").toLowerCase();
      let scans = readScans();

      if (scope === "mine") {
        if (!resolvedAuth) {
          res.status(401).json({
            success: false,
            error: "Sign in to view your personal scan records.",
          });
          return;
        }
        scans = scans.filter((s) => s.user_id === resolvedAuth.user.id);
      }

      const history = scans.map((scan) => ({
        id: scan.id,
        plant: scan.plant,
        disease: scan.disease,
        confidence: scan.confidence,
        image_url: scan.image_url,
        created_at: scan.created_at,
        description: scan.description || "",
        symptoms: Array.isArray(scan.symptoms) ? scan.symptoms : [],
        recommendations: Array.isArray(scan.recommendations) ? scan.recommendations : [],
        user_id: scan.user_id ?? null,
        user_name: scan.user_name || "Field Grower",
        flagged: Boolean(scan.flagged),
        review_note: scan.review_note || "",
        can_delete: Boolean(
          resolvedAuth &&
            (resolvedAuth.user.role === "admin" || scan.user_id === resolvedAuth.user.id)
        ),
      }));
      res.json({ success: true, history });
    } catch {
      res.status(500).json({ success: false, error: "Failed to read scan history." });
    }
  });

  app.delete("/api/history/:id", requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const scanId = Number(req.params.id);
    if (!Number.isInteger(scanId) || scanId <= 0) {
      res.status(400).json({ success: false, error: "Invalid scan ID." });
      return;
    }

    const scans = readScans();
    const targetIndex = scans.findIndex((s) => Number(s.id) === scanId);
    if (targetIndex < 0) {
      res.status(404).json({ success: false, error: "Scan record not found." });
      return;
    }

    const target = scans[targetIndex];
    const isAdmin = req.authUser!.role === "admin";
    const isOwner = target.user_id !== null && target.user_id === req.authUser!.id;
    if (!isAdmin && !isOwner) {
      res.status(401).json({
        success: false,
        error: "You do not have permission to delete this scan record.",
      });
      return;
    }

    scans.splice(targetIndex, 1);
    writeScans(scans);

    if (target.image_url) {
      const safeImg = resolveSafeUploadPath(path.basename(target.image_url));
      if (safeImg && fs.existsSync(safeImg)) {
        try {
          fs.unlinkSync(safeImg);
        } catch {
          // Ignore file unlink failure
        }
      }
    }

    recordAuditEvent(
      "SCAN_DELETED",
      req.authUser!.email,
      req.authUser!.role,
      `scan#${scanId}`,
      `Deleted ${target.plant} — ${target.disease}`
    );

    res.json({ success: true, deleted_id: scanId });
  });

  app.get("/api/stats", (_req: Request, res: Response) => {
    try {
      const scans = readScans();
      const total_scans = scans.length;
      const healthy_plants = scans.filter((scan) => isHealthyDisease(scan.disease)).length;
      const diseased_plants = total_scans - healthy_plants;
      const avg_confidence =
        total_scans > 0
          ? Math.round(
              (scans.reduce((sum, s) => sum + (Number(s.confidence) || 0), 0) / total_scans) * 10
            ) / 10
          : 0;
      const flagged_scans = scans.filter((s) => Boolean(s.flagged)).length;

      res.json({
        success: true,
        total_scans,
        healthy_plants,
        diseased_plants,
        avg_confidence,
        flagged_scans,
      });
    } catch {
      res.status(500).json({ success: false, error: "Failed to compute scan statistics." });
    }
  });

  /* ----------------------------------------------------------------------
     Advanced Analytics Endpoint (Derived Strictly From Real Scan Data)
     ---------------------------------------------------------------------- */
  app.get("/api/analytics", (req: Request, res: Response) => {
    try {
      const resolvedAuth = resolveAuthenticatedUser(req);
      const scope = String(req.query.scope || "all").toLowerCase();
      let scans = readScans();

      if (scope === "mine" && resolvedAuth) {
        scans = scans.filter((s) => s.user_id === resolvedAuth.user.id);
      }

      const total = scans.length;
      const healthyCount = scans.filter((s) => isHealthyDisease(s.disease)).length;
      const diseasedCount = total - healthyCount;
      const flaggedCount = scans.filter((s) => Boolean(s.flagged)).length;
      const avgConfidence =
        total > 0
          ? Math.round(
              (scans.reduce((acc, s) => acc + (Number(s.confidence) || 0), 0) / total) * 10
            ) / 10
          : 0;

      const cropMap = new Map<
        string,
        { plant: string; total: number; healthy: number; diseased: number; confSum: number }
      >();
      const diseaseMap = new Map<
        string,
        { disease: string; plant: string; count: number; confSum: number; is_healthy: boolean }
      >();
      const dailyMap = new Map<string, { date: string; total: number; healthy: number; diseased: number }>();

      let bucketLow = 0;
      let bucketMid = 0;
      let bucketHigh = 0;

      for (const s of scans) {
        const plant = String(s.plant || "Unknown").trim();
        const disease = String(s.disease || "Unknown").trim();
        const conf = Number(s.confidence) || 0;
        const healthy = isHealthyDisease(disease);
        const dateKey = String(s.created_at || "").slice(0, 10) || "Unknown";

        if (conf < 70) bucketLow++;
        else if (conf < 85) bucketMid++;
        else bucketHigh++;

        const cropEntry = cropMap.get(plant) || {
          plant,
          total: 0,
          healthy: 0,
          diseased: 0,
          confSum: 0,
        };
        cropEntry.total++;
        if (healthy) cropEntry.healthy++;
        else cropEntry.diseased++;
        cropEntry.confSum += conf;
        cropMap.set(plant, cropEntry);

        const diseaseKey = `${plant}:::${disease}`;
        const diseaseEntry = diseaseMap.get(diseaseKey) || {
          disease,
          plant,
          count: 0,
          confSum: 0,
          is_healthy: healthy,
        };
        diseaseEntry.count++;
        diseaseEntry.confSum += conf;
        diseaseMap.set(diseaseKey, diseaseEntry);

        const dayEntry = dailyMap.get(dateKey) || {
          date: dateKey,
          total: 0,
          healthy: 0,
          diseased: 0,
        };
        dayEntry.total++;
        if (healthy) dayEntry.healthy++;
        else dayEntry.diseased++;
        dailyMap.set(dateKey, dayEntry);
      }

      const crop_breakdown = Array.from(cropMap.values())
        .map((c) => ({
          plant: c.plant,
          total: c.total,
          healthy: c.healthy,
          diseased: c.diseased,
          avg_confidence: Math.round((c.confSum / c.total) * 10) / 10,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8);

      const disease_breakdown = Array.from(diseaseMap.values())
        .map((d) => ({
          disease: d.disease,
          plant: d.plant,
          count: d.count,
          avg_confidence: Math.round((d.confSum / d.count) * 10) / 10,
          is_healthy: d.is_healthy,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const daily_series = Array.from(dailyMap.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14);

      res.json({
        success: true,
        summary: {
          total_scans: total,
          healthy_count: healthyCount,
          diseased_count: diseasedCount,
          healthy_rate: total > 0 ? Math.round((healthyCount / total) * 1000) / 10 : 0,
          avg_confidence: avgConfidence,
          distinct_crops: cropMap.size,
          flagged_count: flaggedCount,
        },
        confidence_distribution: [
          { label: "< 70%", key: "low", count: bucketLow },
          { label: "70 – 84.9%", key: "mid", count: bucketMid },
          { label: "85 – 100%", key: "high", count: bucketHigh },
        ],
        crop_breakdown,
        disease_breakdown,
        daily_series,
      });
    } catch {
      res.status(500).json({ success: false, error: "Failed to compute analytics." });
    }
  });

  /* ----------------------------------------------------------------------
     Live Weather & Agronomic Risk Proxy (Open-Meteo Allowlisted HTTPS)
     ---------------------------------------------------------------------- */
  app.get("/api/weather", async (req: Request, res: Response) => {
    const rawLang = String(req.query.lang || "en").toLowerCase();
    const lang: "en" | "hi" = rawLang.startsWith("hi") ? "hi" : "en";
    const cityQuery = String(req.query.city || "").trim();
    const rawLat = req.query.lat !== undefined ? Number(req.query.lat) : NaN;
    const rawLon = req.query.lon !== undefined ? Number(req.query.lon) : NaN;

    let latitude = 28.6139;
    let longitude = 77.209;
    let locationName = "New Delhi, India";

    try {
      if (cityQuery) {
        if (cityQuery.length > 80) {
          res.status(400).json({ success: false, error: "Location query is too long." });
          return;
        }
        const geoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
        geoUrl.searchParams.set("name", cityQuery);
        geoUrl.searchParams.set("count", "1");
        geoUrl.searchParams.set("language", "en");
        geoUrl.searchParams.set("format", "json");

        const geoResp = await fetch(geoUrl.toString(), { signal: AbortSignal.timeout(7000) });
        if (!geoResp.ok) {
          throw new Error(`Geocoding service responded with HTTP ${geoResp.status}`);
        }
        const geoData = (await geoResp.json()) as {
          results?: Array<{
            name: string;
            admin1?: string;
            country?: string;
            latitude: number;
            longitude: number;
          }>;
        };
        const match = geoData.results?.[0];
        if (!match) {
          res.status(404).json({
            success: false,
            error:
              lang === "hi"
                ? `'${cityQuery}' के लिए कोई स्थान नहीं मिला। कृपया किसी अन्य शहर का नाम खोजें।`
                : `No location matched "${cityQuery}". Try entering a nearby city or district.`,
          });
          return;
        }
        latitude = Number(match.latitude);
        longitude = Number(match.longitude);
        locationName = [match.name, match.admin1, match.country].filter(Boolean).join(", ");
      } else if (Number.isFinite(rawLat) && Number.isFinite(rawLon)) {
        if (rawLat < -90 || rawLat > 90 || rawLon < -180 || rawLon > 180) {
          res.status(400).json({ success: false, error: "Invalid latitude or longitude range." });
          return;
        }
        latitude = rawLat;
        longitude = rawLon;
        locationName = `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
      }

      const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
      forecastUrl.searchParams.set("latitude", String(latitude));
      forecastUrl.searchParams.set("longitude", String(longitude));
      forecastUrl.searchParams.set(
        "current",
        "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,surface_pressure,wind_speed_10m,dew_point_2m"
      );
      forecastUrl.searchParams.set(
        "daily",
        "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max"
      );
      forecastUrl.searchParams.set("timezone", "auto");
      forecastUrl.searchParams.set("forecast_days", "5");

      const weatherResp = await fetch(forecastUrl.toString(), {
        signal: AbortSignal.timeout(8000),
      });
      if (!weatherResp.ok) {
        throw new Error(`Weather upstream returned HTTP ${weatherResp.status}`);
      }
      const weatherData = (await weatherResp.json()) as {
        timezone?: string;
        current?: {
          time?: string;
          temperature_2m?: number;
          relative_humidity_2m?: number;
          apparent_temperature?: number;
          precipitation?: number;
          weather_code?: number;
          cloud_cover?: number;
          surface_pressure?: number;
          wind_speed_10m?: number;
          dew_point_2m?: number;
        };
        daily?: {
          time?: string[];
          weather_code?: number[];
          temperature_2m_max?: number[];
          temperature_2m_min?: number[];
          precipitation_sum?: number[];
          precipitation_probability_max?: number[];
          wind_speed_10m_max?: number[];
        };
      };

      const cur = weatherData.current || {};
      const tempC = Number(cur.temperature_2m ?? 24);
      const humidity = Number(cur.relative_humidity_2m ?? 60);
      const dewPointC = Number(cur.dew_point_2m ?? tempC - 5);
      const precipMm = Number(cur.precipitation ?? 0);
      const windKmh = Number(cur.wind_speed_10m ?? 6);
      const code = Number(cur.weather_code ?? 0);

      const risk = computeCropWeatherRisk(tempC, humidity, dewPointC, precipMm, windKmh, lang);

      const dailyTimes = weatherData.daily?.time || [];
      const forecast = dailyTimes.map((dateStr, idx) => ({
        date: dateStr,
        weather_code: Number(weatherData.daily?.weather_code?.[idx] ?? 0),
        condition: mapWeatherCodeLabel(Number(weatherData.daily?.weather_code?.[idx] ?? 0), lang),
        temp_max_c: Number(weatherData.daily?.temperature_2m_max?.[idx] ?? 0),
        temp_min_c: Number(weatherData.daily?.temperature_2m_min?.[idx] ?? 0),
        precip_mm: Number(weatherData.daily?.precipitation_sum?.[idx] ?? 0),
        precip_prob: Number(weatherData.daily?.precipitation_probability_max?.[idx] ?? 0),
        wind_max_kmh: Number(weatherData.daily?.wind_speed_10m_max?.[idx] ?? 0),
      }));

      res.json({
        success: true,
        location: {
          name: locationName,
          latitude,
          longitude,
          timezone: weatherData.timezone || "UTC",
        },
        current: {
          observed_at: cur.time || formatTimestamp(new Date()),
          temperature_c: tempC,
          apparent_temperature_c: Number(cur.apparent_temperature ?? tempC),
          humidity_pct: humidity,
          dew_point_c: dewPointC,
          precipitation_mm: precipMm,
          cloud_cover_pct: Number(cur.cloud_cover ?? 0),
          pressure_hpa: Number(cur.surface_pressure ?? 1013),
          wind_speed_kmh: windKmh,
          weather_code: code,
          condition: mapWeatherCodeLabel(code, lang),
        },
        agronomy_risk: risk,
        forecast,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to fetch live weather data.";
      res.status(500).json({ success: false, error: msg });
    }
  });

  /* ----------------------------------------------------------------------
     Role-Protected Admin Console Endpoints
     ---------------------------------------------------------------------- */
  app.get("/api/admin/overview", requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const users = readUsers();
    const scans = readScans();
    const auditLogs = readAuditLogs();
    const healthyScans = scans.filter((s) => isHealthyDisease(s.disease)).length;
    const diseasedScans = scans.length - healthyScans;

    res.json({
      success: true,
      overview: {
        total_users: users.length,
        active_users: users.filter((u) => u.status === "active").length,
        suspended_users: users.filter((u) => u.status === "suspended").length,
        admin_count: users.filter((u) => u.role === "admin" && u.status === "active").length,
        total_scans: scans.length,
        healthy_scans: healthyScans,
        diseased_scans: diseasedScans,
        disease_rate:
          scans.length > 0 ? Math.round((diseasedScans / scans.length) * 1000) / 10 : 0,
        flagged_scans: scans.filter((s) => Boolean(s.flagged)).length,
        audit_events: auditLogs.length,
      },
    });
  });

  app.get("/api/admin/users", requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const users = readUsers();
    const scans = readScans();
    const scanCountByUser = new Map<number, number>();
    for (const scan of scans) {
      if (scan.user_id) {
        scanCountByUser.set(scan.user_id, (scanCountByUser.get(scan.user_id) || 0) + 1);
      }
    }

    res.json({
      success: true,
      users: users.map((u) => ({
        ...sanitizeUser(u),
        scan_count: scanCountByUser.get(u.id) || 0,
      })),
    });
  });

  app.patch("/api/admin/users/:id", requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      res.status(400).json({ success: false, error: "Invalid user ID." });
      return;
    }

    const users = readUsers();
    const idx = users.findIndex((u) => u.id === targetId);
    if (idx < 0) {
      res.status(404).json({ success: false, error: "User not found." });
      return;
    }

    const current = users[idx];
    const nextRole = (req.body?.role ? String(req.body.role).trim() : current.role) as UserRole;
    const nextStatus = (
      req.body?.status ? String(req.body.status).trim() : current.status
    ) as UserStatus;

    if (!ALLOWED_ROLES.has(nextRole)) {
      res.status(400).json({ success: false, error: "Invalid user role specified." });
      return;
    }
    if (!ALLOWED_STATUSES.has(nextStatus)) {
      res.status(400).json({ success: false, error: "Invalid account status specified." });
      return;
    }

    const remainingActiveAdmins = users.filter(
      (u) => u.id !== targetId && u.role === "admin" && u.status === "active"
    ).length;

    if (
      current.role === "admin" &&
      current.status === "active" &&
      (nextRole !== "admin" || nextStatus !== "active") &&
      remainingActiveAdmins === 0
    ) {
      res.status(400).json({
        success: false,
        error: "Cannot demote or suspend the last remaining active administrator.",
      });
      return;
    }

    users[idx] = { ...current, role: nextRole, status: nextStatus };
    writeUsers(users);

    if (nextStatus !== "active") {
      writeSessions(readSessions().filter((s) => s.user_id !== targetId));
    }

    recordAuditEvent(
      "ADMIN_USER_UPDATED",
      req.authUser!.email,
      req.authUser!.role,
      current.email,
      `Role: ${current.role} -> ${nextRole}, Status: ${current.status} -> ${nextStatus}`
    );

    res.json({ success: true, user: sanitizeUser(users[idx]) });
  });

  app.get("/api/admin/scans", requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const scans = readScans();
    res.json({
      success: true,
      scans: scans.map((s) => ({
        id: s.id,
        plant: s.plant,
        disease: s.disease,
        confidence: s.confidence,
        image_url: s.image_url,
        created_at: s.created_at,
        user_id: s.user_id ?? null,
        user_name: s.user_name || "Guest Grower",
        user_email: s.user_email || "—",
        flagged: Boolean(s.flagged),
        review_note: s.review_note || "",
      })),
    });
  });

  app.patch("/api/admin/scans/:id", requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const scanId = Number(req.params.id);
    if (!Number.isInteger(scanId) || scanId <= 0) {
      res.status(400).json({ success: false, error: "Invalid scan ID." });
      return;
    }

    const scans = readScans();
    const idx = scans.findIndex((s) => Number(s.id) === scanId);
    if (idx < 0) {
      res.status(404).json({ success: false, error: "Scan record not found." });
      return;
    }

    const flagged =
      typeof req.body?.flagged === "boolean" ? req.body.flagged : Boolean(scans[idx].flagged);
    const reviewNote =
      req.body?.review_note !== undefined
        ? String(req.body.review_note).trim().slice(0, 300)
        : scans[idx].review_note || "";

    scans[idx] = {
      ...scans[idx],
      flagged,
      review_note: reviewNote,
    };
    writeScans(scans);

    recordAuditEvent(
      "ADMIN_SCAN_REVIEWED",
      req.authUser!.email,
      req.authUser!.role,
      `scan#${scanId}`,
      `Flagged: ${flagged}${reviewNote ? ` · Note: ${reviewNote}` : ""}`
    );

    res.json({ success: true, scan: scans[idx] });
  });

  app.delete("/api/admin/scans/:id", requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const scanId = Number(req.params.id);
    if (!Number.isInteger(scanId) || scanId <= 0) {
      res.status(400).json({ success: false, error: "Invalid scan ID." });
      return;
    }

    const scans = readScans();
    const idx = scans.findIndex((s) => Number(s.id) === scanId);
    if (idx < 0) {
      res.status(404).json({ success: false, error: "Scan record not found." });
      return;
    }

    const [removed] = scans.splice(idx, 1);
    writeScans(scans);

    if (removed.image_url) {
      const safeImg = resolveSafeUploadPath(path.basename(removed.image_url));
      if (safeImg && fs.existsSync(safeImg)) {
        try {
          fs.unlinkSync(safeImg);
        } catch {
          // Ignore file unlink failure
        }
      }
    }

    recordAuditEvent(
      "ADMIN_SCAN_DELETED",
      req.authUser!.email,
      req.authUser!.role,
      `scan#${scanId}`,
      `Removed ${removed.plant} — ${removed.disease}`
    );

    res.json({ success: true, deleted_id: scanId });
  });

  app.get("/api/admin/audit-logs", requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const logs = readAuditLogs().slice(0, 100);
    res.json({ success: true, logs });
  });

  // Return JSON for any unmatched /api/* route
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: "API endpoint not found." });
  });

  // Development vs Production Frontend Serving
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(DIST_DIR));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(DIST_DIR, "index.html"));
    });
  }

  // Global error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : "Internal server error.";
    res.status(500).json({ success: false, error: message });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PlantCare server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
