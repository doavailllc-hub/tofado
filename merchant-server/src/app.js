import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";

import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import multer from "multer";
import { OAuth2Client } from "google-auth-library";
import nodemailer from "nodemailer";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import "dotenv/config";
import { config } from './config.js';
import { validatePurchaseOrder, recordNumber, ORDER_TRANSITIONS, canTransition } from './utils/orders.js';
import { availableInvoiceBalance, invoiceState, paymentIdempotencyKey, validPaymentAmount } from './utils/finance.js';
import { isValidGstin, isValidIndianPhone, normalizeGstin, normalizeIndianPhone } from './utils/india.js';
import { authColumns, registrationColumns, requireColumns } from './schema.js';
import { rateLimit } from 'express-rate-limit';
import { asyncHandler, requestContext, errorHandler, logFailure } from './middleware/http.js';
import { pool } from "./db.js";
import { auth, optionalAuth, allow, allowOnboarding } from "./middleware/auth.js";
import {
  hashPassword,
  verifyPassword,
} from "./utils/password.js";
export const app = express();
let releaseId = process.env.RELEASE_ID || 'development';
const DELIVERY_TRANSITIONS = {
  pending: new Set(['packed', 'cancelled']),
  packed: new Set(['ready', 'cancelled']),
  ready: new Set(['dispatched', 'cancelled']),
  dispatched: new Set(['out_for_delivery', 'cancelled']),
  out_for_delivery: new Set(['delivered', 'cancelled']),
  delivered: new Set(),
  cancelled: new Set(),
};
try {
  releaseId = JSON.parse(fs.readFileSync(new URL('../release.json', import.meta.url), 'utf8')).release_id || releaseId;
} catch {}
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY.split(',').map(value => value.trim()));
app.use(requestContext);
app.use(cors({ origin: config.origins }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many sign-in attempts. Try again later.' } }));
app.use(['/api/public', '/api/catalog', '/api/applications'], rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many requests. Try again shortly.' } }));
app.use(express.json({ limit: '1mb' }));
const q = async (sql, p = []) => {
  const [rows] = await pool.query(sql, p);
  return rows;
};

const sign = (user) =>
  jwt.sign(
    { id: user.id, role: user.role },
    config.jwtSecret,
    { expiresIn: "15m" }
  );

const googleClient = new OAuth2Client();
let mailTransport = null;
function getMailTransport() {
  if (mailTransport) return mailTransport;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  mailTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return mailTransport;
}
const emailCodeHash = (email, code) =>
  crypto
    .createHmac("sha256", config.jwtSecret)
    .update(`${email}:${code}`)
    .digest("hex");

function getPlayReviewLogin(email, role = null) {
  const reviewEmail = String(process.env.PLAY_REVIEW_EMAIL || "").trim().toLowerCase();
  const reviewCode = String(process.env.PLAY_REVIEW_OTP || "").trim();
  const reviewRole = String(process.env.PLAY_REVIEW_ROLE || "").trim().toLowerCase();
  const configured =
    /^\S+@\S+\.\S+$/.test(reviewEmail) &&
    /^\d{6}$/.test(reviewCode) &&
    ["retailer", "wholesaler"].includes(reviewRole);

  if (!configured || email !== reviewEmail || (role && role !== reviewRole)) {
    return null;
  }

  return { code: reviewCode, role: reviewRole };
}
const refreshTokenHash = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    business_name: user.business_name,
    phone: user.phone || null,
    location: user.location || null,
    address: user.address || null,
    tax_number: user.tax_number || null,
    license_number: user.license_number || null,
    logo_url: user.logo_url || null,
    business_category: user.business_category || null,
    shop_type: user.shop_type || null,
    verification_status:
      user.role === "wholesaler"
        ? user.verification_status || "draft"
        : "not_required",
    profile_complete: Boolean(
      user.business_name &&
      user.phone &&
      user.location &&
      user.business_category &&
      user.shop_type
    ),
  };
}



let authSchemaReady;
async function ensureAuthSchema() {
  if (!authSchemaReady) authSchemaReady = requireColumns(pool, authColumns).catch(error => { authSchemaReady = null; throw error; });
  await authSchemaReady;
}

async function createSession(user, connection = pool) {
  const refreshToken = crypto.randomBytes(48).toString("base64url");
  await connection.query(
    `
    INSERT INTO auth_sessions (user_id, token_hash, expires_at)
    VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 180 DAY))
    `,
    [user.id, refreshTokenHash(refreshToken)]
  );
  return { token: sign(user), refresh_token: refreshToken, user: publicUser(user) };
}

const s3 = new S3Client({
  region: process.env.AWS_REGION,
});

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 20,
    parts: 21,
    fieldSize: 16 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      callback(
        new Error("Only JPG, PNG, and WEBP logo files are allowed.")
      );
      return;
    }

    callback(null, true);
  },
});

function getPublicS3Url(key) {
  const configuredBaseUrl =
    process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");

  if (configuredBaseUrl) {
    return `${configuredBaseUrl}/${key}`;
  }

  if (!process.env.S3_BUCKET || !process.env.AWS_REGION) {
    throw new Error(
      "S3_BUCKET and AWS_REGION must be configured."
    );
  }

  return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

function getManagedS3Key(url) {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);
    const key = decodeURIComponent(
      parsedUrl.pathname.replace(/^\/+/, "")
    );

    return key.startsWith("merchant-logos/") ? key : null;
  } catch {
    return null;
  }
}

function validateProfilePayload(body = {}) {
  const requiredFields = [
    ["name", "Contact name"],
    ["business_name", "Business name"],
    ["phone", "Phone number"],
    ["location", "Location"],
    ["business_category", "Business category"],
    ["shop_type", "Shop type"],
  ];

  for (const [key, label] of requiredFields) {
    if (!String(body[key] || "").trim()) {
      return `${label} is required.`;
    }
  }

  if (!isValidIndianPhone(body.phone)) {
    return "Enter a valid 10-digit Indian mobile number.";
  }

  if (
    body.website &&
    !/^https?:\/\/.+/i.test(String(body.website).trim())
  ) {
    return "Website must start with http:// or https://.";
  }

  if (!isValidGstin(body.tax_number)) {
    return "Enter a valid 15-character GSTIN.";
  }

  return "";
}



let registrationSchemaReady;
async function ensureRegistrationSchema() {
  if (!registrationSchemaReady) registrationSchemaReady = requireColumns(pool, registrationColumns).catch(error => { registrationSchemaReady = null; throw error; });
  await registrationSchemaReady;
}

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'tofado-merchant-api', release: releaseId }));
app.post("/api/applications", asyncHandler(async (req, res, next) => {
  try {
    await ensureRegistrationSchema();

    const {
      role,
      name,
      business_name,
      business_category,
      shop_type,
      email,
      phone,
      location,
      address,
      tax_number,
      license_number,
      password,
    } = req.body || {};

    const cleanRole = String(role || "").trim().toLowerCase();
    const cleanName = String(name || "").trim();
    const cleanBusinessName = String(business_name || "").trim();
    const cleanBusinessCategory = String(business_category || "").trim();
    const cleanShopType = String(shop_type || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = normalizeIndianPhone(phone);
    const cleanLocation = String(location || "").trim();
    const cleanAddress = String(address || "").trim();
    const cleanTaxNumber = normalizeGstin(tax_number) || null;
    const cleanLicenseNumber =
      String(license_number || "").trim() || null;
    const cleanPassword = String(password || "");

    if (!["retailer", "wholesaler"].includes(cleanRole)) {
      return res.status(400).json({ message: "Choose retailer or wholesaler." });
    }

    if (
      !cleanName ||
      !cleanBusinessName ||
      !cleanBusinessCategory ||
      !cleanShopType ||
      !cleanEmail ||
      !cleanPhone ||
      !cleanLocation ||
      !cleanAddress ||
      !cleanPassword
    ) {
      return res.status(400).json({
        message: "Complete all required business details.",
      });
    }

    if (cleanPassword.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters.",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        message: "Enter a valid email address.",
      });
    }

    if (!isValidIndianPhone(cleanPhone)) {
      return res.status(400).json({ message: "Enter a valid 10-digit Indian mobile number." });
    }

    if (!isValidGstin(cleanTaxNumber)) {
      return res.status(400).json({ message: "Enter a valid 15-character GSTIN." });
    }

    const existing = await q(
      `
      SELECT email FROM users WHERE LOWER(email) = LOWER(?)
      UNION ALL
      SELECT email FROM merchant_applications WHERE LOWER(email) = LOWER(?)
      LIMIT 1
      `,
      [cleanEmail, cleanEmail]
    );

    if (existing.length) {
      return res.status(409).json({
        message:
          "This email is already registered or has an application under review.",
      });
    }

    const passwordHash = await hashPassword(cleanPassword);

    const result = await q(
      `
      INSERT INTO merchant_applications
      (
        role,
        name,
        business_name,
        business_category,
        shop_type,
        email,
        phone,
        location,
        address,
        tax_number,
        license_number,
        password_hash,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `,
      [
        cleanRole,
        cleanName,
        cleanBusinessName,
        cleanBusinessCategory,
        cleanShopType,
        cleanEmail,
        cleanPhone,
        cleanLocation,
        cleanAddress,
        cleanTaxNumber,
        cleanLicenseNumber,
        passwordHash,
      ]
    );

    return res.status(201).json({
      message: "Verification request submitted.",
      application_id: result.insertId,
      status: "pending",
    });
  } catch (error) {
    logFailure("CREATE MERCHANT APPLICATION ERROR:", error);
    next(error);
  }
}));
app.post("/api/auth/email/request", asyncHandler(async (req, res, next) => {
  try {
    await ensureAuthSchema();
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    const [recent] = await q(
      `SELECT id FROM email_login_codes
       WHERE email = ? AND created_at > DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 60 SECOND)
       ORDER BY id DESC LIMIT 1`,
      [email]
    );
    if (recent) {
      return res.status(429).json({ message: "Wait one minute before requesting another code." });
    }

    const playReviewLogin = getPlayReviewLogin(email);
    const transport = playReviewLogin ? null : getMailTransport();
    if (!playReviewLogin && !transport) {
      return res.status(503).json({ message: "Email sign-in is not configured." });
    }

    const code = playReviewLogin?.code || String(crypto.randomInt(100000, 1000000));
    const result = await q(
      `INSERT INTO email_login_codes (email, code_hash, expires_at)
       VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE))`,
      [email, emailCodeHash(email, code)]
    );

    try {
      if (playReviewLogin) {
        return res.json({ message: "Verification code sent.", expires_in: 600 });
      }
      await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: "Your Tofado sign-in code",
        text: `Your Tofado sign-in code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px"><h2 style="color:#5b35b5">Sign in to Tofado</h2><p>Use this verification code to continue:</p><div style="font-size:34px;font-weight:700;letter-spacing:8px;padding:18px 0">${code}</div><p style="color:#5f6368">This code expires in 10 minutes. Never share it with anyone.</p></div>`,
      });
    } catch (mailError) {
      await q("DELETE FROM email_login_codes WHERE id = ?", [result.insertId]);
      throw mailError;
    }

    return res.json({ message: "Verification code sent.", expires_in: 600 });
  } catch (error) {
    logFailure("SEND EMAIL LOGIN CODE ERROR:", error);
    next(error);
  }
}));

app.post("/api/auth/email/verify", asyncHandler(async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await ensureAuthSchema();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const code = String(req.body?.code || "").trim();
    const role = String(req.body?.role || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: "Enter the six-digit code from your email." });
    }

    const playReviewLogin = getPlayReviewLogin(email, role);
    await connection.beginTransaction();
    const [[loginCode]] = await connection.query(
      `SELECT * FROM email_login_codes
       WHERE email = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [email]
    );
    const supplied = Buffer.from(emailCodeHash(email, code), "hex");
    const expected = loginCode ? Buffer.from(loginCode.code_hash, "hex") : Buffer.alloc(32);
    if (!loginCode || loginCode.attempts >= 5 || !crypto.timingSafeEqual(supplied, expected)) {
      if (loginCode) {
        if (loginCode.attempts < 5) await connection.query("UPDATE email_login_codes SET attempts = attempts + 1 WHERE id = ?", [loginCode.id]);
        await connection.commit();
      } else {
        await connection.rollback();
      }
      return res.status(401).json({ message: "The verification code is invalid or expired." });
    }

    let [[user]] = await connection.query("SELECT * FROM users WHERE email = ? LIMIT 1 FOR UPDATE", [email]);
    if (user && user.status !== "active") {
      await connection.rollback();
      return res.status(403).json({ message: "Your merchant account is awaiting approval." });
    }
    if (user && ["retailer", "wholesaler"].includes(user.role) && ["retailer", "wholesaler"].includes(role) && user.role !== role) {
      await connection.rollback();
      return res.status(403).json({
        message: `This account belongs to the Tofado ${user.role} app.`,
      });
    }
    if (!user) {
      if (!["retailer", "wholesaler"].includes(role)) {
        await connection.rollback();
        return res.status(400).json({ message: "Choose retailer or wholesaler." });
      }
      const displayName = email.split("@")[0].replace(/[._-]+/g, " ").slice(0, 120);
      const passwordHash = await hashPassword(crypto.randomBytes(32).toString("hex"));
      const [created] = await connection.query(
        `INSERT INTO users
          (role, name, business_name, email, auth_provider, phone, location,
           business_category, shop_type, password_hash, status,
           verification_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'email_otp', '', '', '', '', ?, 'active', ?,
                 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [role, displayName, displayName, email, passwordHash,
          role === "wholesaler" ? "draft" : "not_required"]
      );
      [[user]] = await connection.query("SELECT * FROM users WHERE id = ? LIMIT 1", [created.insertId]);
    }

    await connection.query("UPDATE email_login_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?", [loginCode.id]);
    const session = await createSession(user, connection);
    await connection.commit();
    return res.json(session);
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}));

app.post("/api/auth/login", asyncHandler(async (req, res, next) => {
  try {
    await ensureAuthSchema();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const rows = await q("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
    const user = rows[0];

    if (
      !user ||
      user.status !== "active" ||
      !user.password_hash ||
      !(await verifyPassword(req.body?.password || "", user.password_hash))
    ) {
      return res.status(401).json({
        message: "Invalid credentials or account not approved",
      });
    }

    return res.json(await createSession(user));
  } catch (error) {
    next(error);
  }
}));

app.post("/api/auth/google", asyncHandler(async (req, res, next) => {
  try {
    await ensureAuthSchema();
    const idToken = String(req.body?.id_token || "");
    const role = String(req.body?.role || "").trim().toLowerCase();
    const audiences = String(process.env.GOOGLE_CLIENT_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!idToken || !audiences.length) {
      return res.status(503).json({ message: "Google sign-in is not configured." });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: audiences,
    });
    const identity = ticket.getPayload();

    if (!identity?.sub || !identity.email || !identity.email_verified) {
      return res.status(401).json({ message: "Google account could not be verified." });
    }

    const email = identity.email.trim().toLowerCase();
    let [user] = await q(
      "SELECT * FROM users WHERE google_sub = ? OR email = ? ORDER BY google_sub = ? DESC LIMIT 1",
      [identity.sub, email, identity.sub]
    );

    if (user) {
      if (user.google_sub && user.google_sub !== identity.sub) {
        return res.status(409).json({ message: "This email is linked to another Google account." });
      }
      if (["retailer", "wholesaler"].includes(user.role) && ["retailer", "wholesaler"].includes(role) && user.role !== role) {
        return res.status(403).json({
          message: `This account belongs to the Tofado ${user.role} app.`,
        });
      }
      if (user.status !== "active") {
        return res.status(403).json({ message: "Your merchant account is awaiting approval." });
      }
      if (!user.google_sub) {
        await q(
          "UPDATE users SET google_sub = ?, auth_provider = 'google', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [identity.sub, user.id]
        );
        user = { ...user, google_sub: identity.sub, auth_provider: "google" };
      }
      return res.json(await createSession(user));
    }

    if (!["retailer", "wholesaler"].includes(role)) {
      return res.status(409).json({
        code: "ROLE_REQUIRED",
        message: "Choose how you will use Tofado to create your account.",
      });
    }

    const name = String(identity.name || email.split("@")[0]).trim().slice(0, 150);
    const passwordHash = await hashPassword(crypto.randomBytes(32).toString("hex"));
    const result = await q(
      `
      INSERT INTO users
        (role, name, business_name, email, google_sub, auth_provider,
         phone, location, business_category, shop_type, password_hash,
         status, verification_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'google', '', '', '', '', ?, 'active',
              ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [
        role,
        name,
        name,
        email,
        identity.sub,
        passwordHash,
        role === "wholesaler" ? "draft" : "not_required",
      ]
    );
    [user] = await q("SELECT * FROM users WHERE id = ? LIMIT 1", [result.insertId]);
    return res.status(201).json(await createSession(user));
  } catch (error) {
    if (error?.message?.includes("Wrong recipient") || error?.message?.includes("Invalid token")) {
      return res.status(401).json({ message: "Google account could not be verified." });
    }
    next(error);
  }
}));

app.post("/api/auth/refresh", asyncHandler(async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await ensureAuthSchema();
    const refreshToken = String(req.body?.refresh_token || "");
    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token is required." });
    }

    await connection.beginTransaction();
    const [[session]] = await connection.query(
      `
      SELECT s.id AS session_id, u.*
      FROM auth_sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.revoked_at IS NULL
        AND s.expires_at > CURRENT_TIMESTAMP AND u.status = 'active'
      LIMIT 1 FOR UPDATE
      `,
      [refreshTokenHash(refreshToken)]
    );
    if (!session) {
      await connection.rollback();
      return res.status(401).json({ message: "Session has expired. Sign in again." });
    }

    await connection.query(
      "UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP, last_used_at = CURRENT_TIMESTAMP WHERE id = ?",
      [session.session_id]
    );
    const renewed = await createSession(session, connection);
    await connection.commit();
    return res.json(renewed);
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}));

app.post("/api/auth/logout", asyncHandler(async (req, res, next) => {
  try {
    await ensureAuthSchema();
    const refreshToken = String(req.body?.refresh_token || "");
    if (refreshToken) {
      await q(
        "UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND revoked_at IS NULL",
        [refreshTokenHash(refreshToken)]
      );
    }
    return res.json({ message: "Signed out." });
  } catch (error) {
    next(error);
  }
}));
app.get("/api/auth/me", auth, asyncHandler(async (req, res, next) => {
  try {
    const [user] = await q(
      "SELECT id, name, email, role, business_name, phone, location, address, tax_number, license_number, business_category, shop_type, logo_url, status, verification_status FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );
    if (!user || user.status !== "active") {
      return res.status(401).json({ message: "Account is unavailable." });
    }
    return res.json(publicUser(user));
  } catch (error) {
    next(error);
  }
}));
app.get("/api/profile", auth, asyncHandler(async (req, res, next) => {
  try {
    const [profile] = await q(
      `SELECT
         id,
         name,
         email,
         role,
         business_name,
         phone,
         location,
         address,
         tax_number,
         license_number,
         business_category,
         shop_type,
         description,
         website,
         logo_url,
         status,
         created_at,
         updated_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.id]
    );

    if (!profile) {
      return res.status(404).json({
        message: "Business profile not found.",
      });
    }

    return res.json(profile);
  } catch (error) {
    next(error);
  }
}));

app.put("/api/profile", auth, asyncHandler(async (req, res, next) => {
  try {
    const validationError = validateProfilePayload(req.body);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const {
      name,
      business_name,
      phone,
      location,
      address = "",
      tax_number = "",
      business_category,
      shop_type,
      description = "",
      website = "",
    } = req.body;

    await q(
      `UPDATE users
       SET
         name = ?,
         business_name = ?,
         phone = ?,
         location = ?,
         address = ?,
         tax_number = ?,
         business_category = ?,
         shop_type = ?,
         description = ?,
         website = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name.trim(),
        business_name.trim(),
        normalizeIndianPhone(phone),
        location.trim(),
        address.trim(),
        normalizeGstin(tax_number),
        business_category.trim(),
        shop_type.trim(),
        description.trim(),
        website.trim(),
        req.user.id,
      ]
    );

    const [profile] = await q(
      `SELECT
         id,
         name,
         email,
         role,
         business_name,
         phone,
         location,
         address,
         tax_number,
         license_number,
         business_category,
         shop_type,
         description,
         website,
         logo_url,
         status,
         created_at,
         updated_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.id]
    );

    return res.json(profile);
  } catch (error) {
    next(error);
  }
}));

app.post(
  "/api/profile/logo",
  auth,
  logoUpload.single("logo"),
  asyncHandler(async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Select a business logo.",
        });
      }

      if (!process.env.S3_BUCKET) {
        return res.status(500).json({
          message: "S3_BUCKET is not configured on the server.",
        });
      }

      const [currentProfile] = await q(
        "SELECT logo_url FROM users WHERE id = ? LIMIT 1",
        [req.user.id]
      );

      if (!currentProfile) {
        return res.status(404).json({
          message: "Business profile not found.",
        });
      }

      const mimeExtension = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
      }[req.file.mimetype];

      const originalExtension =
        path.extname(req.file.originalname).toLowerCase();

      const extension =
        [".jpg", ".jpeg", ".png", ".webp"].includes(
          originalExtension
        )
          ? originalExtension === ".jpeg"
            ? ".jpg"
            : originalExtension
          : mimeExtension;

      const key = [
        "merchant-logos",
        String(req.user.id),
        `${crypto.randomUUID()}${extension}`,
      ].join("/");

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
          CacheControl: "public, max-age=31536000, immutable",
        })
      );

      const logoUrl = getPublicS3Url(key);
      const previousKey = getManagedS3Key(
        currentProfile.logo_url
      );

      await q(
        `UPDATE users
         SET
           logo_url = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [logoUrl, req.user.id]
      );

      if (previousKey && previousKey !== key) {
        s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: previousKey,
          })
        ).catch((deleteError) => {
          logFailure("Unable to delete previous merchant logo:", deleteError);
        });
      }

      return res.status(201).json({
        message: "Business logo uploaded successfully.",
        logo_url: logoUrl,
      });
    } catch (error) {
      next(error);
    }
  })
);

app.delete(
  "/api/profile/logo",
  auth,
  asyncHandler(async (req, res, next) => {
    try {
      const [currentProfile] = await q(
        "SELECT logo_url FROM users WHERE id = ? LIMIT 1",
        [req.user.id]
      );

      if (!currentProfile) {
        return res.status(404).json({
          message: "Business profile not found.",
        });
      }

      const currentKey = getManagedS3Key(
        currentProfile.logo_url
      );

      await q(
        `UPDATE users
         SET
           logo_url = NULL,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [req.user.id]
      );

      if (currentKey && process.env.S3_BUCKET) {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: currentKey,
          })
        );
      }

      return res.json({
        message: "Business logo removed.",
      });
    } catch (error) {
      next(error);
    }
  })
);

app.post(
  "/api/wholesaler/verification",
  auth,
  allowOnboarding,
  asyncHandler(async (req, res, next) => {
    try {
      await ensureAuthSchema();
      await ensureRegistrationSchema();
      const fields = {
        name: String(req.body?.name || "").trim(),
        business_name: String(req.body?.business_name || "").trim(),
        phone: normalizeIndianPhone(req.body?.phone),
        location: String(req.body?.location || "").trim(),
        address: String(req.body?.address || "").trim(),
        tax_number: normalizeGstin(req.body?.tax_number),
        license_number: String(req.body?.license_number || "").trim(),
        business_category: String(req.body?.business_category || "").trim(),
        shop_type: String(req.body?.shop_type || "").trim(),
      };

      if (Object.values(fields).some((value) => !value)) {
        return res.status(400).json({
          message: "Complete all required verification details.",
        });
      }

      if (!isValidGstin(fields.tax_number)) {
        return res.status(400).json({ message: "Enter a valid 15-character GSTIN." });
      }

      const [user] = await q(
        "SELECT email, password_hash, logo_url, verification_status FROM users WHERE id = ? LIMIT 1",
        [req.user.id]
      );
      if (!user) {
        return res.status(404).json({ message: "Wholesaler account not found." });
      }
      if (!user.logo_url) {
        return res.status(400).json({ message: "Upload your company logo before submitting." });
      }
      if (user.verification_status === "verified") {
        return res.status(409).json({ message: "This wholesaler is already verified." });
      }

      await q(
        `
        UPDATE users
        SET name = ?, business_name = ?, phone = ?, location = ?, address = ?,
            tax_number = ?, license_number = ?, business_category = ?, shop_type = ?,
            verification_status = 'pending', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [...Object.values(fields), req.user.id]
      );

      const [existingApplication] = await q(
        "SELECT id FROM merchant_applications WHERE source_user_id = ? ORDER BY id DESC LIMIT 1",
        [req.user.id]
      );
      const applicationValues = [
        fields.name, fields.business_name, fields.business_category,
        fields.shop_type, user.email, fields.phone, fields.location,
        fields.address, fields.tax_number, fields.license_number, user.logo_url,
        user.password_hash,
      ];

      if (existingApplication) {
        await q(
          `
          UPDATE merchant_applications
          SET role = 'wholesaler', name = ?, business_name = ?, business_category = ?,
              shop_type = ?, email = ?, phone = ?, location = ?, address = ?,
              tax_number = ?, license_number = ?, logo_url = ?, password_hash = ?,
              status = 'pending', reviewed_by = NULL, reviewed_at = NULL,
              created_at = CURRENT_TIMESTAMP
          WHERE id = ?
          `,
          [...applicationValues, existingApplication.id]
        );
      } else {
        await q(
          `
          INSERT INTO merchant_applications
            (source_user_id, role, name, business_name, business_category, shop_type,
             email, phone, location, address, tax_number, license_number, logo_url,
             password_hash, status)
          VALUES (?, 'wholesaler', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
          `,
          [req.user.id, ...applicationValues]
        );
      }

      return res.status(201).json({
        message: "Verification application submitted.",
        verification_status: "pending",
      });
    } catch (error) {
      next(error);
    }
  })
);
app.get('/api/retailer/wholesalers', auth, allow('retailer'), asyncHandler(async (req, res) => res.json(await q("SELECT id,business_name,location,phone FROM users WHERE role='wholesaler' AND status='active' AND verification_status='verified' ORDER BY business_name"))));
app.post('/api/retailer/orders', auth, allow('retailer'), asyncHandler(async (req, res) => {
  const order = validatePurchaseOrder(req.body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[wholesaler]] = await connection.query("SELECT id FROM users WHERE id=? AND role='wholesaler' AND status='active' AND verification_status='verified' FOR UPDATE", [order.wholesalerId]);
    if (!wholesaler) throw Object.assign(new Error('Wholesaler is unavailable.'), { status: 404 });
    const orderNo = recordNumber('PO');
    const [result] = await connection.query('INSERT INTO purchase_orders(order_no,retailer_id,wholesaler_id,delivery_address,required_date,notes,status,total_amount) VALUES(?,?,?,?,?,?,?,0)', [orderNo, req.user.id, order.wholesalerId, order.address, order.date, order.notes, 'pending']);
    for (const item of order.items) await connection.query('INSERT INTO purchase_order_items(order_id,product_name,quantity,unit,notes) VALUES(?,?,?,?,?)', [result.insertId, item.name, item.quantity, item.unit, item.notes]);
    await connection.commit();
    res.status(201).json({ id: result.insertId, order_no: orderNo });
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}));
app.get('/api/retailer/orders', auth, allow('retailer'), asyncHandler(async (req, res) => res.json(await q(`SELECT o.id,o.order_no,w.business_name wholesaler_name,o.created_at,o.status,o.total_amount FROM purchase_orders o JOIN users w ON w.id=o.wholesaler_id WHERE o.retailer_id=? ORDER BY o.id DESC`, [req.user.id]))));
app.get('/api/retailer/catalog/orders', auth, allow('retailer'), asyncHandler(async (req, res) => res.json(await q(`
  SELECT o.id,o.order_no,w.business_name wholesaler_name,o.created_at,o.required_date,o.status,o.total_amount,
         COUNT(oi.id) items_count
  FROM wholesale_catalog_orders o
  JOIN users w ON w.id=o.wholesaler_id
  LEFT JOIN wholesale_catalog_order_items oi ON oi.order_id=o.id
  WHERE o.retailer_id=?
  GROUP BY o.id,o.order_no,w.business_name,o.created_at,o.required_date,o.status,o.total_amount
  ORDER BY o.id DESC`, [req.user.id]))));
app.get('/api/retailer/catalog/orders/:id', auth, allow('retailer'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid order ID.' });
  const [order] = await q(`SELECT o.*,w.business_name wholesaler_name,i.id invoice_id,i.invoice_no,
      i.status payment_status,i.lifecycle_status invoice_status,i.due_date payment_due_date,
      d.id delivery_id,d.status delivery_status,d.driver_name,d.driver_phone,d.vehicle_number
    FROM wholesale_catalog_orders o
    JOIN users w ON w.id=o.wholesaler_id
    LEFT JOIN invoices i ON i.catalog_order_id=o.id AND i.source_type='catalog_order'
    LEFT JOIN wholesale_catalog_deliveries d ON d.order_id=o.id
    WHERE o.id=? AND o.retailer_id=? LIMIT 1`, [id, req.user.id]);
  if (!order) return res.status(404).json({ message: 'Catalog order not found.' });
  const items = await q(`SELECT oi.id,oi.product_id,oi.product_name,oi.sku,oi.unit,oi.price AS unit_price,
      oi.quantity,oi.line_total,p.price_mode,p.image_url
    FROM wholesale_catalog_order_items oi
    LEFT JOIN wholesale_products p ON p.id=oi.product_id
    WHERE oi.order_id=? ORDER BY oi.id ASC`, [id]);
  res.json({
    order,
    items,
    invoice: order.invoice_id ? { id:order.invoice_id, invoice_no:order.invoice_no, status:order.invoice_status, payment_status:order.payment_status, due_date:order.payment_due_date } : null,
    delivery: order.delivery_id ? { id:order.delivery_id, status:order.delivery_status, driver_name:order.driver_name, driver_phone:order.driver_phone, vehicle_number:order.vehicle_number } : null,
  });
}));
app.get('/api/retailer/invoices', auth, allow('retailer'), asyncHandler(async (req, res) => res.json(await q(`SELECT i.id,i.invoice_no,w.business_name wholesaler_name,COALESCE(o.order_no,co.order_no) order_no,i.source_type,i.total_amount,i.paid_amount,i.due_date,i.status FROM invoices i LEFT JOIN purchase_orders o ON o.id=i.order_id LEFT JOIN wholesale_catalog_orders co ON co.id=i.catalog_order_id JOIN users w ON w.id=i.wholesaler_id WHERE i.retailer_id=? ORDER BY i.id DESC`, [req.user.id]))));
app.get('/api/retailer/dashboard', auth, allow('retailer'), asyncHandler(async (req, res) => { const [s] = await q(`SELECT COUNT(*) total_orders,SUM(status='pending') pending_orders,COALESCE(SUM(total_amount),0) purchase_value FROM purchase_orders WHERE retailer_id=?`, [req.user.id]); const [inv] = await q(`SELECT COALESCE(SUM(total_amount-paid_amount),0) outstanding FROM invoices WHERE retailer_id=?`, [req.user.id]); const recent = await q(`SELECT o.id,o.order_no,w.business_name,o.created_at,o.status,o.total_amount FROM purchase_orders o JOIN users w ON w.id=o.wholesaler_id WHERE o.retailer_id=? ORDER BY o.id DESC LIMIT 8`, [req.user.id]); res.json({ stats: { total_orders: s.total_orders, pending_orders: s.pending_orders, purchase_value: `INR ${Number(s.purchase_value).toFixed(2)}`, outstanding: `INR ${Number(inv.outstanding).toFixed(2)}` }, recent }) }));
app.get('/api/wholesaler/orders', auth, allow('wholesaler'), asyncHandler(async (req, res) => res.json(await q(`SELECT o.id,o.order_no,r.business_name retailer_name,o.created_at,o.required_date,o.status,o.total_amount FROM purchase_orders o JOIN users r ON r.id=o.retailer_id WHERE o.wholesaler_id=? ORDER BY o.id DESC`, [req.user.id]))));
app.get('/api/wholesaler/orders/:id', auth, allow('wholesaler'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid order ID.' });
  const [order] = await q(`SELECT o.*, r.business_name AS retailer_name
    FROM purchase_orders o JOIN users r ON r.id=o.retailer_id
    WHERE o.id=? AND o.wholesaler_id=? LIMIT 1`, [id, req.user.id]);
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  const items = await q('SELECT id, product_name, quantity, unit, unit_price, notes FROM purchase_order_items WHERE order_id=? ORDER BY id', [id]);
  const [invoice] = await q('SELECT id, invoice_no FROM invoices WHERE order_id=? AND wholesaler_id=? AND retailer_id=? LIMIT 1', [id, req.user.id, order.retailer_id]);
  res.json({ order, items, invoice: invoice || null });
}));
app.patch('/api/wholesaler/orders/:id/status', auth, allow('wholesaler'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id), status = String(req.body?.status || '').trim().toLowerCase();
  if (!Number.isSafeInteger(id) || id <= 0 || !Object.hasOwn(ORDER_TRANSITIONS, status)) return res.status(400).json({ message: 'Invalid order or status.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[order]] = await connection.query('SELECT status FROM purchase_orders WHERE id=? AND wholesaler_id=? FOR UPDATE', [id, req.user.id]);
    if (!order) throw Object.assign(new Error('Order not found.'), { status: 404 });
    if (!canTransition(order.status, status)) throw Object.assign(new Error('Invalid order status transition.'), { status: 422 });
    await connection.query('UPDATE purchase_orders SET status=?, updated_at=CURRENT_TIMESTAMP, delivered_at=IF(?="delivered",COALESCE(delivered_at,NOW()),delivered_at) WHERE id=? AND wholesaler_id=?', [status, status, id, req.user.id]);
    await connection.commit(); res.json({ message: 'Order status updated.' });
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}));
app.get('/api/wholesaler/invoices', auth, allow('wholesaler'), asyncHandler(async (req, res) => res.json(await q(`SELECT i.id,i.invoice_no,COALESCE(r.business_name,i.business_name,i.customer_name) retailer_name,COALESCE(o.order_no,co.order_no) order_no,i.source_type,i.total_amount,i.paid_amount,i.due_date,i.status FROM invoices i LEFT JOIN users r ON r.id=i.retailer_id LEFT JOIN purchase_orders o ON o.id=i.order_id LEFT JOIN wholesale_catalog_orders co ON co.id=i.catalog_order_id WHERE i.wholesaler_id=? ORDER BY i.id DESC`, [req.user.id]))));
app.get('/api/wholesaler/payments', auth, allow('wholesaler'), asyncHandler(async (req, res) => res.json(await q(`SELECT p.id,p.payment_no,COALESCE(r.business_name,i.business_name,i.customer_name) retailer_name,i.invoice_no,p.amount,p.method,p.paid_at,p.status FROM payments p JOIN invoices i ON i.id=p.invoice_id LEFT JOIN users r ON r.id=p.retailer_id WHERE p.wholesaler_id=? ORDER BY p.id DESC`, [req.user.id]))));
app.get('/api/wholesaler/dashboard', auth, allow('wholesaler'), asyncHandler(async (req, res) => { const [s] = await q(`SELECT COUNT(*) total_orders,SUM(status='pending') pending_orders,SUM(status='delivered') delivered_orders,COUNT(DISTINCT retailer_id) retailers FROM purchase_orders WHERE wholesaler_id=?`, [req.user.id]); const [i] = await q(`SELECT COALESCE(SUM(total_amount-paid_amount),0) outstanding FROM invoices WHERE wholesaler_id=?`, [req.user.id]); const recent = await q(`SELECT o.id,o.order_no,r.business_name,o.created_at,o.status,o.total_amount FROM purchase_orders o JOIN users r ON r.id=o.retailer_id WHERE o.wholesaler_id=? ORDER BY o.id DESC LIMIT 8`, [req.user.id]); res.json({ stats: { total_orders: s.total_orders, pending_orders: s.pending_orders, delivered_orders: s.delivered_orders, retailers: s.retailers, outstanding: `INR ${Number(i.outstanding).toFixed(2)}` }, recent }) }));
app.get("/api/admin/applications", auth, allow("admin"), asyncHandler(async (req, res, next) => {
  try {
    await ensureRegistrationSchema();

    const rows = await q(
      `
      SELECT
        id,
        source_user_id,
        role,
        name,
        business_name,
        business_category,
        shop_type,
        email,
        phone,
        location,
        address,
        tax_number,
        license_number,
        logo_url,
        status,
        created_at,
        reviewed_at
      FROM merchant_applications
      ORDER BY id DESC
      `
    );

    return res.json(rows);
  } catch (error) {
    next(error);
  }
}));
app.patch(
  "/api/admin/applications/:id",
  auth,
  allow("admin"),
  asyncHandler(async (req, res, next) => {
    const connection = await pool.getConnection();

    try {
      await ensureRegistrationSchema();

      const applicationId = Number(req.params.id);
      const status = String(req.body?.status || "").trim().toLowerCase();

      if (!Number.isInteger(applicationId) || applicationId <= 0) {
        return res.status(400).json({ message: "Invalid application." });
      }

      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({
          message: "Status must be approved or rejected.",
        });
      }

      await connection.beginTransaction();

      const [[application]] = await connection.query(
        `
        SELECT *
        FROM merchant_applications
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [applicationId]
      );

      if (!application) {
        await connection.rollback();
        return res.status(404).json({ message: "Application not found." });
      }

      if (application.status !== "pending") {
        await connection.rollback();
        return res.status(409).json({
          message: "This application has already been processed.",
        });
      }

      let approvedWholesalerUserId = null;

      if (application.source_user_id) {
        const [[sourceUser]] = await connection.query(
          "SELECT id, role FROM users WHERE id = ? LIMIT 1 FOR UPDATE",
          [application.source_user_id]
        );
        if (!sourceUser || sourceUser.role !== application.role) {
          await connection.rollback();
          return res.status(409).json({
            message: "The application account is unavailable.",
          });
        }
        await connection.query(
          "UPDATE users SET verification_status = ?, verified_at = CASE WHEN ? = 'verified' THEN CURRENT_TIMESTAMP ELSE verified_at END, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [status === "approved" ? "verified" : "rejected", status === "approved" ? "verified" : "rejected", sourceUser.id]
        );
        if (status === "approved" && sourceUser.role === "wholesaler") {
          approvedWholesalerUserId = Number(sourceUser.id);
        }
      } else if (status === "approved") {
        const [[existingUser]] = await connection.query(
          `
          SELECT id
          FROM users
          WHERE LOWER(email) = LOWER(?)
          LIMIT 1
          `,
          [application.email]
        );

        if (existingUser) {
          await connection.rollback();
          return res.status(409).json({
            message: "A user account already exists for this email.",
          });
        }

        const [createdUserResult] = await connection.query(
          `
          INSERT INTO users
          (
            role,
            name,
            business_name,
            business_category,
            shop_type,
            email,
            phone,
            location,
            address,
            tax_number,
            license_number,
            password_hash,
            status,
            verified_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())
          `,
          [
            application.role,
            application.name,
            application.business_name,
            application.business_category,
            application.shop_type,
            application.email,
            application.phone,
            application.location,
            application.address,
            application.tax_number,
            application.license_number,
            application.password_hash,
          ]
        );

        if (application.role === "wholesaler") {
          approvedWholesalerUserId = Number(createdUserResult.insertId);
        }
      }

      await connection.query(
        `
        UPDATE merchant_applications
        SET
          status = ?,
          reviewed_by = ?,
          reviewed_at = NOW()
        WHERE id = ?
        `,
        [status, req.user.id, applicationId]
      );

      await connection.commit();

      if (approvedWholesalerUserId) {
        await getOrCreateWholesaleCatalog(approvedWholesalerUserId);
      }

      return res.json({
        message:
          status === "approved"
            ? "Merchant approved and account activated."
            : "Merchant application rejected.",
        application_id: applicationId,
        status,
      });
    } catch (error) {
      await connection.rollback();
      logFailure("REVIEW MERCHANT APPLICATION ERROR:", error);
      next(error);
    } finally {
      connection.release();
    }
  })
);
app.get('/api/admin/users', auth, allow('admin'), asyncHandler(async (req, res) => res.json(await q("SELECT id,business_name,role,name,phone,location,status,created_at FROM users WHERE role!='admin' ORDER BY id DESC"))));
app.patch('/api/admin/wholesalers/:id/unapprove', auth, allow('admin'), asyncHandler(async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const wholesalerId = Number(req.params.id);
    if (!Number.isInteger(wholesalerId) || wholesalerId <= 0) {
      return res.status(400).json({ message: 'Invalid wholesaler.' });
    }
    await connection.beginTransaction();
    const [[wholesaler]] = await connection.query("SELECT id FROM users WHERE id=? AND role='wholesaler' LIMIT 1 FOR UPDATE", [wholesalerId]);
    if (!wholesaler) {
      await connection.rollback();
      return res.status(404).json({ message: 'Wholesaler not found.' });
    }
    await connection.query("UPDATE users SET status='suspended', verification_status='rejected', updated_at=CURRENT_TIMESTAMP WHERE id=?", [wholesalerId]);
    await connection.query("UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=? AND revoked_at IS NULL", [wholesalerId]);
    await connection.commit();
    return res.json({ message: 'Wholesaler unapproved and access revoked.', status: 'suspended' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}));
app.delete('/api/admin/wholesalers/:id', auth, allow('admin'), asyncHandler(async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const wholesalerId = Number(req.params.id);
    if (!Number.isInteger(wholesalerId) || wholesalerId <= 0) {
      return res.status(400).json({ message: 'Invalid wholesaler.' });
    }
    await connection.beginTransaction();
    const [[wholesaler]] = await connection.query("SELECT id,email FROM users WHERE id=? AND role='wholesaler' LIMIT 1 FOR UPDATE", [wholesalerId]);
    if (!wholesaler) {
      await connection.rollback();
      return res.status(404).json({ message: 'Wholesaler not found.' });
    }
    await connection.query('DELETE FROM auth_sessions WHERE user_id=?', [wholesalerId]);
    await connection.query('DELETE FROM email_login_codes WHERE email=?', [wholesaler.email]);
    await connection.query("DELETE FROM users WHERE id=? AND role='wholesaler'", [wholesalerId]);
    await connection.commit();
    return res.json({ message: 'Wholesaler deleted permanently.' });
  } catch (error) {
    await connection.rollback();
    if (error?.code === 'ER_ROW_IS_REFERENCED_2' || error?.errno === 1451) {
      return res.status(409).json({ message: 'This wholesaler has business records and cannot be deleted. Use Unapprove to disable access while preserving order and accounting history.' });
    }
    next(error);
  } finally {
    connection.release();
  }
}));
app.get('/api/admin/orders', auth, allow('admin'), asyncHandler(async (req, res) => res.json(await q(`SELECT o.id,o.order_no,r.business_name retailer_name,w.business_name wholesaler_name,o.status,o.total_amount,o.created_at FROM purchase_orders o JOIN users r ON r.id=o.retailer_id JOIN users w ON w.id=o.wholesaler_id ORDER BY o.id DESC`))));
app.get('/api/admin/finance', auth, allow('admin'), asyncHandler(async (req, res) => res.json(await q(`SELECT i.id,i.invoice_no,i.source_type,COALESCE(r.business_name,i.business_name,i.customer_name) retailer_name,w.business_name wholesaler_name,i.total_amount,i.paid_amount,i.status,i.due_date FROM invoices i LEFT JOIN users r ON r.id=i.retailer_id JOIN users w ON w.id=i.wholesaler_id ORDER BY i.id DESC`))));
app.get('/api/admin/dashboard', auth, allow('admin'), asyncHandler(async (req, res) => { const [[u]] = await pool.query(`SELECT SUM(role='retailer') retailers,SUM(role='wholesaler') wholesalers FROM users WHERE status='active'`); const [[a]] = await pool.query(`SELECT COUNT(*) pending_verifications FROM merchant_applications WHERE status='pending'`); const [[o]] = await pool.query(`SELECT COUNT(*) total_orders,COALESCE(SUM(total_amount),0) order_value FROM purchase_orders`); const recent = await q(`SELECT o.id,o.order_no,CONCAT(r.business_name,' → ',w.business_name) business_name,o.created_at,o.status,o.total_amount FROM purchase_orders o JOIN users r ON r.id=o.retailer_id JOIN users w ON w.id=o.wholesaler_id ORDER BY o.id DESC LIMIT 8`); res.json({ stats: { retailers: u.retailers || 0, wholesalers: u.wholesalers || 0, pending_verifications: a.pending_verifications, total_orders: o.total_orders, order_value: `INR ${Number(o.order_value).toFixed(2)}` }, recent }) }));


app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      message:
        err.code === "LIMIT_FILE_SIZE"
          ? "Logo must be smaller than 5 MB."
          : err.message,
    });
  }

  if (
    err?.message ===
    "Only JPG, PNG, and WEBP logo files are allowed."
  ) {
    return res.status(400).json({
      message: err.message,
    });
  }

  next(err);
});
// ============================================================
// WHOLESALER PRODUCT CATALOG
// ============================================================

const productImageUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 6 * 1024 * 1024,
    files: 1,
    fields: 20,
    parts: 21,
    fieldSize: 16 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      callback(
        new Error(
          "Only JPG, PNG, and WEBP product images are allowed."
        )
      );

      return;
    }

    callback(null, true);
  },
});

function createCatalogSlug(value, userId) {
  const slug = String(value || "wholesale-catalog")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

  return `${slug || "catalog"}-${userId}`;
}
async function getOrCreateWholesaleCatalog(wholesalerId) {
  const [existingCatalog] = await q(
    `
    SELECT
      c.id,
      c.wholesaler_id,
      c.slug,
      c.title,
      c.catalog_title,
      c.catalog_description,
      c.cover_image_url,
      c.cover_updated_at,
      c.is_published,
      c.created_at,
      c.updated_at,

      u.business_name,
      u.logo_url,
      u.phone,
      u.location

    FROM wholesale_catalogs c

    INNER JOIN users u
      ON u.id = c.wholesaler_id

    WHERE c.wholesaler_id = ?

    LIMIT 1
    `,
    [wholesalerId]
  );

  if (existingCatalog) {
    return existingCatalog;
  }

  const [wholesaler] = await q(
    `
    SELECT
      id,
      business_name,
      logo_url,
      phone,
      location

    FROM users

    WHERE id = ?
      AND role = 'wholesaler'

    LIMIT 1
    `,
    [wholesalerId]
  );

  if (!wholesaler) {
    throw new Error("Wholesaler account not found.");
  }

  const slug = createCatalogSlug(
    wholesaler.business_name,
    wholesaler.id
  );

  const title =
    `${wholesaler.business_name} Product Catalog`;

  await q(
    `
    INSERT INTO wholesale_catalogs (
      wholesaler_id,
      slug,
      title,
      catalog_title,
      catalog_description,
      cover_image_url,
      is_published
    )
    VALUES (?, ?, ?, ?, NULL, NULL, 1)
    `,
    [
      wholesaler.id,
      slug,
      title,
      title,
    ]
  );

  const [createdCatalog] = await q(
    `
    SELECT
      c.id,
      c.wholesaler_id,
      c.slug,
      c.title,
      c.catalog_title,
      c.catalog_description,
      c.cover_image_url,
      c.cover_updated_at,
      c.is_published,
      c.created_at,
      c.updated_at,

      u.business_name,
      u.logo_url,
      u.phone,
      u.location

    FROM wholesale_catalogs c

    INNER JOIN users u
      ON u.id = c.wholesaler_id

    WHERE c.wholesaler_id = ?

    LIMIT 1
    `,
    [wholesalerId]
  );

  return createdCatalog;
}


let marketplaceCatalogSyncPromise = null;

async function ensureMarketplaceCatalogsForApprovedWholesalers() {
  if (marketplaceCatalogSyncPromise) {
    return marketplaceCatalogSyncPromise;
  }

  marketplaceCatalogSyncPromise = (async () => {
    const missingWholesalers = await q(
      `
      SELECT
        u.id
      FROM users u
      LEFT JOIN wholesale_catalogs c
        ON c.wholesaler_id = u.id
      WHERE u.role = 'wholesaler'
        AND u.status = 'active' AND u.role = 'wholesaler' AND u.verification_status = 'verified'
        AND c.id IS NULL
      ORDER BY u.id ASC
      LIMIT 100
      `
    );

    for (const wholesaler of missingWholesalers) {
      await getOrCreateWholesaleCatalog(wholesaler.id);
    }
  })().finally(() => {
    marketplaceCatalogSyncPromise = null;
  });

  return marketplaceCatalogSyncPromise;
}


app.get(
  "/api/wholesaler/catalog",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const catalog =
        await getOrCreateWholesaleCatalog(req.user.id);

      const frontendUrl =
        process.env.PUBLIC_CATALOG_URL ||
        process.env.CLIENT_URL?.split(",")[0] ||
        "http://localhost:5173";

      return res.json({
        ...catalog,

        catalog_title:
          catalog.catalog_title ||
          catalog.title ||
          `${catalog.business_name} Product Catalog`,

        catalog_description:
          catalog.catalog_description || "",

        cover_image_url:
          catalog.cover_image_url || null,

        public_url:
          `${frontendUrl.replace(/\/+$/, "")}/catalog/${catalog.slug}`,
      });
    } catch (error) {
      logFailure("LOAD WHOLESALER CATALOG ERROR:", error);

      next(error);
    }
  })
);
// Get products belonging to the logged-in wholesaler
app.get(
  "/api/wholesaler/catalog/products",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const products = await q(
        `SELECT
           id,
           wholesaler_id,
           name,
           sku,
           brand,
           category_name,
           description,
           image_url,
           image_key,
           unit,
           pack_size,
           minimum_order,
           price,
           compare_price,
           stock_quantity,
           low_stock_level,
           is_active,
           created_at,
           updated_at
         FROM wholesale_products
         WHERE wholesaler_id = ?
         ORDER BY id DESC`,
        [req.user.id]
      );

      return res.json(products);
    } catch (error) {
      next(error);
    }
  })
);

// Upload product image to S3
app.post(
  "/api/wholesaler/catalog/product-image",
  auth,
  allow("wholesaler"),
  productImageUpload.single("image"),
  asyncHandler(async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Select a product image.",
        });
      }

      if (!process.env.S3_BUCKET) {
        return res.status(500).json({
          message: "S3_BUCKET is not configured on the server.",
        });
      }

      const extensions = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
      };

      const extension =
        extensions[req.file.mimetype] || ".jpg";

      const imageKey = [
        "merchant-products",
        String(req.user.id),
        `${crypto.randomUUID()}${extension}`,
      ].join("/");

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: imageKey,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
          CacheControl:
            "public, max-age=31536000, immutable",
        })
      );

      return res.status(201).json({
        message: "Product image uploaded successfully.",
        image_url: getPublicS3Url(imageKey),
        image_key: imageKey,
      });
    } catch (error) {
      logFailure("PRODUCT IMAGE UPLOAD ERROR:", {
        name: error?.name,
        message: error?.message,
        code: error?.Code || error?.code,
        status: error?.$metadata?.httpStatusCode,
        resource: error?.Resource,
        stack: error?.stack,
      });

      return res
        .status(error?.$metadata?.httpStatusCode || 500)
        .json({
          message:
            error?.message ||
            "Unable to upload product image.",
        });
    }
  })
);
// Create a wholesaler product
app.post(
  "/api/wholesaler/catalog/products",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const {
        name,
        sku,
        brand,
        category_name,
        description,
        image_url,
        image_key,
        unit = "piece",
        pack_size,
minimum_order = 1,
price_mode = "fixed",
price,
compare_price,
        stock_quantity = 0,
        low_stock_level = 5,
        is_active = true,
      } = req.body;

      if (!String(name || "").trim()) {
        return res.status(400).json({
          message: "Product name is required.",
        });
      }

      if (!String(category_name || "").trim()) {
        return res.status(400).json({
          message: "Product category is required.",
        });
      }

    const cleanPriceMode =
  price_mode === "quote" ? "quote" : "fixed";

const productPrice =
  cleanPriceMode === "quote"
    ? null
    : Number(price);

if (
  cleanPriceMode === "fixed" &&
  (!Number.isFinite(productPrice) || productPrice < 0)
) {
  return res.status(400).json({
    message: "Enter a valid product price.",
  });
}
      const minimumOrder = Math.max(
        1,
        Number(minimum_order || 1)
      );

      const stockQuantity = Math.max(
        0,
        Number(stock_quantity || 0)
      );

      const lowStockLevel = Math.max(
        0,
        Number(low_stock_level || 0)
      );

      const result = await q(
        `INSERT INTO wholesale_products
        (
          wholesaler_id,
          name,
          sku,
          brand,
          category_name,
          description,
          image_url,
          image_key,
          unit,
          pack_size,
        minimum_order,
price_mode,
price,
compare_price,
          stock_quantity,
          low_stock_level,
          is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`,
        [
          req.user.id,
          String(name).trim(),
          String(sku || "").trim() || null,
          String(brand || "").trim() || null,
          String(category_name).trim(),
          String(description || "").trim() || null,
          String(image_url || "").trim() || null,
          String(image_key || "").trim() || null,
          String(unit || "piece").trim(),
          String(pack_size || "").trim() || null,
         minimumOrder,
cleanPriceMode,
productPrice,
          compare_price === "" ||
          compare_price === null ||
          compare_price === undefined
            ? null
            : Number(compare_price),
          stockQuantity,
          lowStockLevel,
          Boolean(is_active) ? 1 : 0,
        ]
      );

      const [product] = await q(
        `SELECT
           id,
           wholesaler_id,
           name,
           sku,
           brand,
           category_name,
           description,
           image_url,
           image_key,
           unit,
           pack_size,
      minimum_order,
price_mode,
price,
compare_price,
           stock_quantity,
           low_stock_level,
           is_active,
           created_at,
           updated_at
         FROM wholesale_products
         WHERE id = ?
           AND wholesaler_id = ?
         LIMIT 1`,
        [result.insertId, req.user.id]
      );

      return res.status(201).json({
        message: "Product added successfully.",
        product,
      });
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          message:
            "A product with this SKU already exists.",
        });
      }

      next(error);
    }
  })
);
// Get one product
app.get(
  "/api/wholesaler/catalog/products/:id",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const [product] = await q(
        `SELECT *
         FROM wholesale_products
         WHERE id = ?
           AND wholesaler_id = ?
         LIMIT 1`,
        [req.params.id, req.user.id]
      );

      if (!product) {
        return res.status(404).json({
          message: "Product not found.",
        });
      }

      return res.json(product);
    } catch (error) {
      next(error);
    }
  })
);

// Update product
app.put(
  "/api/wholesaler/catalog/products/:id",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const {
        name,
        sku,
        brand,
        category_name,
        description,
        image_url,
        image_key,
        unit = "piece",
        pack_size,
      minimum_order = 1,
price_mode = "fixed",
price,
compare_price,
        stock_quantity = 0,
        low_stock_level = 5,
        is_active = true,
      } = req.body;

      if (!String(name || "").trim()) {
        return res.status(400).json({
          message: "Product name is required.",
        });
      }
const cleanPriceMode =
  price_mode === "quote" ? "quote" : "fixed";

const productPrice =
  cleanPriceMode === "quote"
    ? null
    : Number(price);

if (
  cleanPriceMode === "fixed" &&
  (!Number.isFinite(productPrice) || productPrice < 0)
) {
  return res.status(400).json({
    message: "Enter a valid product price.",
  });
}
      const result = await q(
        `UPDATE wholesale_products
         SET
           name = ?,
           sku = ?,
           brand = ?,
           category_name = ?,
           description = ?,
           image_url = ?,
           image_key = ?,
           unit = ?,
           pack_size = ?,
         minimum_order = ?,
price_mode = ?,
price = ?,
compare_price = ?,
           stock_quantity = ?,
           low_stock_level = ?,
           is_active = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND wholesaler_id = ?`,
        [
          String(name).trim(),
          String(sku || "").trim() || null,
          String(brand || "").trim() || null,
          String(category_name || "").trim() || null,
          String(description || "").trim() || null,
          String(image_url || "").trim() || null,
          String(image_key || "").trim() || null,
          String(unit || "piece").trim(),
          String(pack_size || "").trim() || null,
     Math.max(1, Number(minimum_order || 1)),
cleanPriceMode,
productPrice,
          compare_price === "" ||
          compare_price === null ||
          compare_price === undefined
            ? null
            : Number(compare_price),
          Math.max(0, Number(stock_quantity || 0)),
          Math.max(0, Number(low_stock_level || 0)),
          Boolean(is_active) ? 1 : 0,
          req.params.id,
          req.user.id,
        ]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          message: "Product not found.",
        });
      }

      return res.json({
        message: "Product updated successfully.",
      });
    } catch (error) {
      next(error);
    }
  })
);
// ======================================================
// UPDATE PRODUCT PUBLISH STATUS
// PATCH /api/wholesaler/catalog/products/:id/status
// ======================================================

app.patch(
  "/api/wholesaler/catalog/products/:id/status",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const productId = Number(req.params.id);
      const wholesalerId = Number(req.user.id);
      const { is_active } = req.body || {};

      if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({
          message: "Invalid product ID.",
        });
      }

      if (typeof is_active !== "boolean") {
        return res.status(400).json({
          message: "Product status must be true or false.",
        });
      }

      const result = await q(
        `
        UPDATE wholesale_products
        SET
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND wholesaler_id = ?
        `,
        [
          is_active ? 1 : 0,
          productId,
          wholesalerId,
        ]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          message:
            "Product not found or it does not belong to your business.",
        });
      }

      const [product] = await q(
        `
        SELECT
          id,
          wholesaler_id,
          name,
          sku,
          brand,
          category_name,
          description,
          image_url,
          image_key,
          unit,
          pack_size,
minimum_order,
price_mode,
price,
compare_price,
          stock_quantity,
          low_stock_level,
          is_active,
          created_at,
          updated_at
        FROM wholesale_products
        WHERE id = ?
          AND wholesaler_id = ?
        `,
        [productId, wholesalerId]
      );

      return res.json(product);
    } catch (error) {
      logFailure("UPDATE PRODUCT STATUS ERROR:", error);

      next(error);
    }
  })
);
// Delete product
app.delete(
  "/api/wholesaler/catalog/products/:id",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const [product] = await q(
        `SELECT image_key
         FROM wholesale_products
         WHERE id = ?
           AND wholesaler_id = ?
         LIMIT 1`,
        [req.params.id, req.user.id]
      );

      if (!product) {
        return res.status(404).json({
          message: "Product not found.",
        });
      }

      await q(
        `DELETE FROM wholesale_products
         WHERE id = ?
           AND wholesaler_id = ?`,
        [req.params.id, req.user.id]
      );

      if (product.image_key && process.env.S3_BUCKET) {
        s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: product.image_key,
          })
        ).catch((error) => {
          logFailure("Unable to delete product image:", error);
        });
      }

      return res.json({
        message: "Product deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  })
);
// ======================================================
// PUBLIC CATALOG STOREFRONT
// GET /api/public/catalog/:slug
// ======================================================

app.get(
  "/api/public/catalog/:slug",
  asyncHandler(async (req, res, next) => {
    try {
      const slug = String(req.params.slug || "").trim();

      if (!slug) {
        return res.status(400).json({
          message: "Catalog slug is required.",
        });
      }

      const [catalog] = await q(
        `
        SELECT
          c.id,
          c.wholesaler_id,
          c.slug,
          c.title,
          c.catalog_title,
          c.catalog_description,
          c.cover_image_url,
          c.is_published,
          c.created_at,
          c.updated_at,

          u.business_name,
          u.logo_url,
          u.phone,
          u.location,
          u.address

        FROM wholesale_catalogs c

        INNER JOIN users u
          ON u.id = c.wholesaler_id
          AND u.role = 'wholesaler'

        WHERE c.slug = ?
          AND u.status = 'active' AND u.verification_status = 'verified'
          AND c.is_published = 1

        LIMIT 1
        `,
        [slug]
      );

      if (!catalog) {
        return res.status(404).json({
          message: "This catalog is currently unavailable.",
        });
      }

      const products = await q(
        `
        SELECT
  id,
  wholesaler_id,
  name,
  sku,
  brand,
  category_name,
  description,
  image_url,
  unit,
  pack_size,
  minimum_order,
  price_mode,
  price,
  compare_price,
  stock_quantity,
  low_stock_level,
  is_active,
  created_at,
  updated_at
FROM wholesale_products
WHERE wholesaler_id = ?
  AND is_active = 1
ORDER BY id DESC
        `,
        [catalog.wholesaler_id]
      );

      return res.json({
        catalog: {
          ...catalog,

          catalog_title:
            catalog.catalog_title ||
            catalog.title ||
            `${catalog.business_name} Product Catalog`,

          catalog_description:
            catalog.catalog_description || "",

          cover_image_url:
            catalog.cover_image_url || null,
        },

        products,
      });
    } catch (error) {
      logFailure("LOAD PUBLIC CATALOG ERROR:", error);

      next(error);
    }
  })
);
// Public catalog storefront
app.get(
  "/api/catalog/:slug",
  asyncHandler(async (req, res, next) => {
    try {
      const [catalog] = await q(
        `SELECT
           c.id,
           c.wholesaler_id,
           c.slug,
           c.title,
           c.is_published,
           u.business_name,
           u.logo_url,
           u.phone,
           u.location,
           u.description,
           u.website
         FROM wholesale_catalogs c
         INNER JOIN users u
           ON u.id = c.wholesaler_id
         WHERE c.slug = ?
           AND c.is_published = 1
           AND u.status = 'active' AND u.role = 'wholesaler' AND u.verification_status = 'verified'
         LIMIT 1`,
        [req.params.slug]
      );

      if (!catalog) {
        return res.status(404).json({
          message: "Catalog not found or unavailable.",
        });
      }

      const products = await q(
        `SELECT
           id,
           name,
           sku,
           brand,
           category_name,
           description,
           image_url,
           unit,
           pack_size,
           minimum_order,
           price_mode,
           price,
           compare_price,
           stock_quantity,
           low_stock_level,
           is_active
         FROM wholesale_products
         WHERE wholesaler_id = ?
           AND is_active = 1
         ORDER BY id DESC`,
        [catalog.wholesaler_id]
      );

      return res.json({
        catalog,
        products,
      });
    } catch (error) {
      next(error);
    }
  })
);
// Public catalog storefront

app.post(
  "/api/public/catalog/:slug/orders",
  optionalAuth,
  asyncHandler(async (req, res, next) => {
    const connection = await pool.getConnection();

    try {
      if (req.user && req.user.role !== "retailer") {
        return res.status(403).json({
          message: "Only retailer accounts can place linked storefront orders.",
        });
      }

      const {
        customer_name,
        business_name = "",
        phone,
        email = "",
        delivery_address,
        required_date,
        notes = "",
        items,
      } = req.body;

      if (!String(customer_name || "").trim()) {
        return res.status(400).json({
          message: "Customer name is required.",
        });
      }

      if (!String(phone || "").trim()) {
        return res.status(400).json({
          message: "Phone number is required.",
        });
      }

      if (!String(delivery_address || "").trim()) {
        return res.status(400).json({
          message: "Delivery address is required.",
        });
      }

      if (!Array.isArray(items) || !items.length) {
        return res.status(400).json({
          message: "Add at least one product.",
        });
      }

      await connection.beginTransaction();

      const [[catalog]] = await connection.query(
        `SELECT
           c.id,
           c.wholesaler_id,
           c.slug,
           c.is_published
         FROM wholesale_catalogs c
         INNER JOIN users u
           ON u.id = c.wholesaler_id
         WHERE c.slug = ?
           AND c.is_published = 1
           AND u.status = 'active' AND u.role = 'wholesaler' AND u.verification_status = 'verified'
         LIMIT 1
         FOR UPDATE`,
        [req.params.slug]
      );

      if (!catalog) {
        await connection.rollback();

        return res.status(404).json({
          message: "Catalog not found or unavailable.",
        });
      }

      const productIds = [
        ...new Set(
          items
            .map((item) => Number(item.product_id))
            .filter((id) => Number.isInteger(id) && id > 0)
        ),
      ];

      if (!productIds.length) {
        await connection.rollback();

        return res.status(400).json({
          message: "No valid products were selected.",
        });
      }

      const placeholders = productIds.map(() => "?").join(",");

      const [products] = await connection.query(
        `SELECT
           id,
           name,
           sku,
           unit,
           price,
           minimum_order,
           stock_quantity,
           is_active
         FROM wholesale_products
         WHERE wholesaler_id = ?
           AND is_active = 1
           AND id IN (${placeholders})
         FOR UPDATE`,
        [catalog.wholesaler_id, ...productIds]
      );

      const productsById = new Map(
        products.map((product) => [
          Number(product.id),
          product,
        ])
      );

      const orderItems = [];
      let totalAmount = 0;

      for (const requestedItem of items) {
        const productId = Number(requestedItem.product_id);
        const product = productsById.get(productId);

        if (!product) {
          await connection.rollback();

          return res.status(400).json({
            message:
              "One of the selected products is no longer available.",
          });
        }

        const quantity = Number(requestedItem.quantity);
        const minimumOrder = Math.max(
          1,
          Number(product.minimum_order || 1)
        );

        if (!Number.isFinite(quantity) || quantity < minimumOrder) {
          await connection.rollback();

          return res.status(400).json({
            message: `${product.name} requires a minimum order of ${minimumOrder}.`,
          });
        }

        const stockQuantity = Number(product.stock_quantity);

        if (
          Number.isFinite(stockQuantity) &&
          quantity > stockQuantity
        ) {
          await connection.rollback();

          return res.status(400).json({
            message: `Only ${stockQuantity} ${product.unit} of ${product.name} are available.`,
          });
        }

        const price = Number(product.price || 0);
        const lineTotal = price * quantity;

        totalAmount += lineTotal;

        orderItems.push({
          product,
          quantity,
          price,
          lineTotal,
        });
      }

      const orderNo = `CO-${Date.now()
        .toString()
        .slice(-10)}`;

      const [orderResult] = await connection.query(
        `INSERT INTO wholesale_catalog_orders
        (
          order_no,
          catalog_id,
          wholesaler_id,
          retailer_id,
          customer_name,
          business_name,
          phone,
          email,
          delivery_address,
          required_date,
          notes,
          status,
          total_amount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          orderNo,
          catalog.id,
          catalog.wholesaler_id,
          req.user?.id || null,
          String(customer_name).trim(),
          String(business_name).trim() || null,
          String(phone).trim(),
          String(email).trim() || null,
          String(delivery_address).trim(),
          required_date || null,
          String(notes).trim() || null,
          totalAmount,
        ]
      );

      for (const item of orderItems) {
        await connection.query(
          `INSERT INTO wholesale_catalog_order_items
          (
            order_id,
            product_id,
            product_name,
            sku,
            unit,
            price,
            quantity,
            line_total
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderResult.insertId,
            item.product.id,
            item.product.name,
            item.product.sku || null,
            item.product.unit || "piece",
            item.price,
            item.quantity,
            item.lineTotal,
          ]
        );
      }

      await connection.commit();

      return res.status(201).json({
        message: "Order sent successfully.",
        id: orderResult.insertId,
        order_no: orderNo,
        total_amount: totalAmount,
      });
    } catch (error) {
      await connection.rollback();
      next(error);
    } finally {
      connection.release();
    }
  })
);
app.patch('/api/wholesaler/catalog/orders/:id/status', auth, allow('wholesaler'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id), status = String(req.body?.status || '').trim().toLowerCase();
  if (!Number.isSafeInteger(id) || id <= 0 || !Object.hasOwn(ORDER_TRANSITIONS, status)) return res.status(400).json({ message: 'Invalid order or status.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[order]] = await connection.query('SELECT status FROM wholesale_catalog_orders WHERE id=? AND wholesaler_id=? FOR UPDATE', [id, req.user.id]);
    if (!order) throw Object.assign(new Error('Order not found.'), { status: 404 });
    if (!canTransition(order.status, status)) throw Object.assign(new Error('Invalid order status transition.'), { status: 422 });
    await connection.query('UPDATE wholesale_catalog_orders SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND wholesaler_id=?', [status, id, req.user.id]);
    await connection.commit(); res.json({ message: 'Order status updated.' });
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}));
// Get public catalog orders for logged-in wholesaler
app.get(
  "/api/wholesaler/catalog/orders",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const orders = await q(
        `SELECT
           o.id,
           o.order_no,
           o.customer_name,
           o.business_name,
           o.phone,
           o.email,
           o.delivery_address,
           o.required_date,
           o.notes,
           o.status,
           o.total_amount,
           o.created_at,
           o.updated_at,
           COUNT(oi.id) AS items_count
         FROM wholesale_catalog_orders o
         LEFT JOIN wholesale_catalog_order_items oi
           ON oi.order_id = o.id
         WHERE o.wholesaler_id = ?
         GROUP BY
           o.id,
           o.order_no,
           o.customer_name,
           o.business_name,
           o.phone,
           o.email,
           o.delivery_address,
           o.required_date,
           o.notes,
           o.status,
           o.total_amount,
           o.created_at,
           o.updated_at
         ORDER BY o.id DESC`,
        [req.user.id]
      );

      return res.json(orders);
    } catch (error) {
      next(error);
    }
  })
);


// Get one catalog order with products, invoice, payment and delivery
app.get(
  "/api/wholesaler/catalog/orders/:id",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const [order] = await q(
        `SELECT
           o.id,
           o.order_no,
           o.catalog_id,
           o.wholesaler_id,
           o.customer_name,
           o.business_name,
           o.phone,
           o.email,
           o.delivery_address,
           o.required_date,
           o.notes,
           o.status,
           o.total_amount,
           o.created_at,
           o.updated_at,

           i.id AS invoice_id,
           i.invoice_no,
           i.lifecycle_status AS invoice_status,
           i.payment_type,
           i.status AS payment_status,
           i.due_date AS payment_due_date,
           i.paid_at,

           d.id AS delivery_id,
           d.delivery_type,
           d.status AS delivery_status,
           d.delivery_notes,
           d.driver_name,
           d.driver_phone,
           d.vehicle_number,
           d.dispatched_at,
           d.delivered_at

         FROM wholesale_catalog_orders o

         LEFT JOIN invoices i
           ON i.catalog_order_id = o.id
          AND i.source_type = 'catalog_order'

         LEFT JOIN wholesale_catalog_deliveries d
           ON d.order_id = o.id

         WHERE o.id = ?
           AND o.wholesaler_id = ?

         LIMIT 1`,
        [req.params.id, req.user.id]
      );

      if (!order) {
        return res.status(404).json({
          message: "Catalog order not found.",
        });
      }

      const items = await q(
        `SELECT
           oi.id,
           oi.order_id,
           oi.product_id,
           oi.product_name,
           oi.sku,
           oi.unit,
           oi.price,
           oi.quantity,
           oi.line_total,
           oi.created_at,
           p.price_mode,
           p.image_url
         FROM wholesale_catalog_order_items oi
         LEFT JOIN wholesale_products p
           ON p.id = oi.product_id
         WHERE oi.order_id = ?
         ORDER BY oi.id ASC`,
        [order.id]
      );

      return res.json({
        ...order,
        items,
      });
    } catch (error) {
      next(error);
    }
  })
);
// Update catalog-order payment terms
app.patch(
  "/api/wholesaler/catalog/orders/:id/payment",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const {
        payment_type,
        payment_due_date = null,
      } = req.body;

      const allowedPaymentTypes = [
        "online",
        "due",
        "credit",
        "cash_on_delivery",
      ];

      if (!allowedPaymentTypes.includes(payment_type)) {
        return res.status(400).json({
          message: "Invalid payment type.",
        });
      }

      const result = await q(
        `UPDATE invoices i
         INNER JOIN wholesale_catalog_orders o
           ON o.id = i.catalog_order_id
         SET
           i.payment_type = ?,
           i.due_date = ?,
           i.updated_at = CURRENT_TIMESTAMP
         WHERE o.id = ?
           AND o.wholesaler_id = ?`,
        [
          payment_type,
          payment_due_date || null,
          req.params.id,
          req.user.id,
        ]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          message:
            "Invoice not found. Confirm the order first.",
        });
      }

      return res.json({
        message: "Payment terms updated.",
      });
    } catch (error) {
      next(error);
    }
  })
);

// Update catalog-order payment status
app.patch(
  "/api/wholesaler/catalog/orders/:id/payment-status",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const paymentStatus = String(
        req.body.payment_status || ""
      ).toLowerCase();

      const allowedStatuses = [
        "pending",
        "partial",
        "paid",
        "overdue",
      ];

      if (!allowedStatuses.includes(paymentStatus)) {
        return res.status(400).json({
          message: "Invalid payment status.",
        });
      }

      if (["partial", "paid"].includes(paymentStatus)) {
        return res.status(409).json({
          message: "Record or approve a payment to change the invoice balance.",
        });
      }

      const result = await q(
        `UPDATE invoices i
         INNER JOIN wholesale_catalog_orders o
           ON o.id = i.catalog_order_id
         SET
           i.updated_at = CURRENT_TIMESTAMP
         WHERE o.id = ?
           AND o.wholesaler_id = ?`,
        [
          req.params.id,
          req.user.id,
        ]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          message: "Invoice not found.",
        });
      }

      return res.json({
        message: "Payment status updated.",
      });
    } catch (error) {
      next(error);
    }
  })
);

// Create or update catalog-order delivery
app.post(
  "/api/wholesaler/catalog/orders/:id/delivery",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    const connection = await pool.getConnection();

    try {
      const {
        delivery_type = "merchant_delivery",
        delivery_notes = "",
      } = req.body;

      const allowedDeliveryTypes = [
        "merchant_delivery",
        "customer_pickup",
        "third_party",
      ];

      if (!allowedDeliveryTypes.includes(delivery_type)) {
        return res.status(400).json({
          message: "Invalid delivery type.",
        });
      }

      await connection.beginTransaction();

      const [[order]] = await connection.query(
        `SELECT
           id,
           status
         FROM wholesale_catalog_orders
         WHERE id = ?
           AND wholesaler_id = ?
         LIMIT 1
         FOR UPDATE`,
        [req.params.id, req.user.id]
      );

      if (!order) {
        await connection.rollback();

        return res.status(404).json({
          message: "Order not found.",
        });
      }

      if (!["confirmed", "packed"].includes(order.status)) {
        await connection.rollback();

        return res.status(409).json({
          message:
            "Only confirmed orders can create or update a delivery.",
        });
      }

      await connection.query(
        `INSERT INTO wholesale_catalog_deliveries
        (
          order_id,
          wholesaler_id,
          delivery_type,
          delivery_notes,
          status,
          ready_at
        )
        VALUES (?, ?, ?, ?, 'ready', CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          delivery_type = VALUES(delivery_type),
          delivery_notes = VALUES(delivery_notes),
          updated_at = CURRENT_TIMESTAMP`,
        [
          order.id,
          req.user.id,
          delivery_type,
          String(delivery_notes || "").trim() || null,
        ]
      );

      await connection.query(
        `UPDATE wholesale_catalog_orders
         SET
           status = 'packed',
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [order.id]
      );

      const [[delivery]] = await connection.query(
        `SELECT
           id,
           delivery_type,
           status,
           delivery_notes
         FROM wholesale_catalog_deliveries
         WHERE order_id = ?
         LIMIT 1`,
        [order.id]
      );

      await connection.commit();

      return res.status(201).json({
        message: "Delivery created.",
        delivery_id: delivery.id,
        delivery_type: delivery.delivery_type,
        delivery_status: delivery.status,
        status: "packed",
      });
    } catch (error) {
      await connection.rollback();
      next(error);
    } finally {
      connection.release();
    }
  })
);
// ======================================================
// WHOLESALER: GET PUBLIC CATALOG ENQUIRIES
// GET /api/wholesaler/catalog/enquiries
// ======================================================

app.get(
  "/api/wholesaler/catalog/enquiries",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const enquiries = await q(
        `SELECT
          e.id,
          e.wholesaler_id,
          e.product_id,
          e.customer_name,
          e.business_name,
          e.phone,
          e.email,
          e.message,
          e.quantity,
          e.status,
          e.created_at,
          e.updated_at,

          p.name AS product_name,
          p.sku AS product_sku,
          p.image_url AS product_image

        FROM wholesale_catalog_enquiries e

        LEFT JOIN wholesale_products p
          ON p.id = e.product_id

        WHERE e.wholesaler_id = ?

        ORDER BY e.created_at DESC`,
        [req.user.id]
      );

      return res.json({
        enquiries,
        total: enquiries.length,
      });
    } catch (error) {
      next(error);
    }
  })
);
// ======================================================
// WHOLESALER: CREATE RETAILER MANUALLY
// POST /api/wholesaler/retailers
// ======================================================
// ======================================================
// WHOLESALER RETAILERS
// ======================================================

// ------------------------------------------------------
// GET CONNECTED RETAILERS
// GET /api/wholesaler/retailers
// ------------------------------------------------------
// ======================================================
// PUBLIC: SEND PRODUCT / PRICE ENQUIRY
// POST /api/public/catalog/:slug/enquiries
// ======================================================

app.post(
  "/api/public/catalog/:slug/enquiries",
  asyncHandler(async (req, res, next) => {
    try {
      const slug = String(req.params.slug || "").trim();

      const {
        product_id,
        customer_name,
        business_name = "",
        phone,
        email = "",
        quantity = 1,
        message,
      } = req.body || {};

      if (!slug) {
        return res.status(400).json({
          message: "Catalog slug is required.",
        });
      }

      if (!String(customer_name || "").trim()) {
        return res.status(400).json({
          message: "Your name is required.",
        });
      }

      if (!String(phone || "").trim()) {
        return res.status(400).json({
          message: "Phone number is required.",
        });
      }

      if (!String(message || "").trim()) {
        return res.status(400).json({
          message: "Enquiry message is required.",
        });
      }

      const [catalog] = await q(
        `
        SELECT
          c.id,
          c.wholesaler_id,
          c.slug
        FROM wholesale_catalogs c
        INNER JOIN users u
          ON u.id = c.wholesaler_id
        WHERE c.slug = ?
          AND c.is_published = 1
          AND u.status = 'active' AND u.role = 'wholesaler' AND u.verification_status = 'verified'
        LIMIT 1
        `,
        [slug]
      );

      if (!catalog) {
        return res.status(404).json({
          message: "Catalog not found or unavailable.",
        });
      }

      let product = null;

      if (product_id) {
        [product] = await q(
          `
          SELECT
            id,
            name,
            minimum_order,
            is_active
          FROM wholesale_products
          WHERE id = ?
            AND wholesaler_id = ?
            AND is_active = 1
          LIMIT 1
          `,
          [product_id, catalog.wholesaler_id]
        );

        if (!product) {
          return res.status(404).json({
            message: "Product not found or unavailable.",
          });
        }
      }

      const enquiryQuantity = Math.max(
        product?.minimum_order || 1,
        Number(quantity || 1)
      );

      const result = await q(
        `
        INSERT INTO wholesale_catalog_enquiries
        (
          wholesaler_id,
          product_id,
          customer_name,
          business_name,
          phone,
          email,
          message,
          quantity,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')
        `,
        [
          catalog.wholesaler_id,
          product?.id || null,
          String(customer_name).trim(),
          String(business_name || "").trim() || null,
          String(phone).trim(),
          String(email || "").trim() || null,
          String(message).trim(),
          enquiryQuantity,
        ]
      );

      return res.status(201).json({
        message: "Enquiry sent successfully.",
        enquiry_id: result.insertId,
      });
    } catch (error) {
      logFailure("PUBLIC CATALOG ENQUIRY ERROR:", error);

      next(error);
    }
  })
);
app.get(
  "/api/wholesaler/retailers",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const wholesalersId = Number(req.user.id);

      if (!wholesalersId) {
        return res.status(401).json({
          message: "Invalid wholesaler account.",
        });
      }

      const retailers = await q(
        `
        SELECT
          u.id,
          u.business_name,
          u.name,
          u.email,
          u.phone,
          u.location,
          u.address,
          u.tax_number,
          u.status,

          wr.id AS connection_id,
          wr.source,
          wr.credit_limit,
          wr.payment_terms,
          wr.notes,
          wr.status AS connection_status,
          wr.created_at AS connected_at,

          COUNT(DISTINCT po.id) AS orders_count,

          COALESCE(
            SUM(
              CASE
                WHEN i.status NOT IN ('paid', 'cancelled')
                THEN GREATEST(
                  COALESCE(i.total_amount, 0) -
                  COALESCE(i.paid_amount, 0),
                  0
                )
                ELSE 0
              END
            ),
            0
          ) AS outstanding

        FROM wholesaler_retailers wr

        INNER JOIN users u
          ON u.id = wr.retailer_id
          AND u.role = 'retailer'

        LEFT JOIN purchase_orders po
          ON po.retailer_id = u.id
          AND po.wholesaler_id = wr.wholesaler_id

        LEFT JOIN invoices i
          ON i.retailer_id = u.id
          AND i.wholesaler_id = wr.wholesaler_id

        WHERE wr.wholesaler_id = ?
          AND wr.status = 'active'

        GROUP BY
          u.id,
          u.business_name,
          u.name,
          u.email,
          u.phone,
          u.location,
          u.address,
          u.tax_number,
          u.status,

          wr.id,
          wr.source,
          wr.credit_limit,
          wr.payment_terms,
          wr.notes,
          wr.status,
          wr.created_at

        ORDER BY wr.created_at DESC, u.business_name ASC
        `,
        [wholesalersId]
      );

      return res.json(retailers);
    } catch (error) {
      logFailure("LOAD WHOLESALER RETAILERS ERROR:", error);

      next(error);
    }
  })
);

// ------------------------------------------------------
// CREATE OR CONNECT RETAILER MANUALLY
// POST /api/wholesaler/retailers
// ------------------------------------------------------

app.post(
  "/api/wholesaler/retailers",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    let connection;

    try {
      const wholesalerId = Number(req.user.id);

      const {
        business_name,
        name,
        email,
        phone,
        location,
        address,
        vat_number,
        tax_number,
        credit_limit = 0,
        payment_terms = "cash",
        notes,
      } = req.body || {};

      const cleanBusinessName = String(
        business_name || ""
      ).trim();

      const cleanName = String(name || "").trim();

      const cleanEmail = String(email || "")
        .trim()
        .toLowerCase();

      const cleanPhone = String(phone || "").trim();

      const cleanLocation = String(
        location || ""
      ).trim();

      const cleanAddress = String(address || "").trim();

      const cleanTaxNumber = String(
        tax_number || vat_number || ""
      ).trim();

      const cleanNotes = String(notes || "").trim();

      const cleanPaymentTerms = String(
        payment_terms || "cash"
      ).trim();

      const cleanCreditLimit = Number(credit_limit) || 0;

      if (!wholesalerId) {
        return res.status(401).json({
          message: "Invalid wholesaler account.",
        });
      }

      if (!cleanBusinessName) {
        return res.status(400).json({
          message: "Business name is required.",
        });
      }

      if (!cleanName) {
        return res.status(400).json({
          message: "Contact person is required.",
        });
      }

      if (!cleanPhone) {
        return res.status(400).json({
          message: "Phone number is required.",
        });
      }

      if (!cleanLocation) {
        return res.status(400).json({
          message: "City or location is required.",
        });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [existingRetailers] = await connection.query(
        `
        SELECT
          id,
          business_name,
          name,
          email,
          phone,
          location,
          address,
          tax_number,
          status

        FROM users

        WHERE role = 'retailer'
          AND (
            phone = ?
            OR (
              ? <> ''
              AND email = ?
            )
          )
        `,
        [
          cleanPhone,
          cleanEmail,
          cleanEmail,
        ]
      );

      if (existingRetailers.length > 1) {
        await connection.rollback();
        return res.status(409).json({
          code: "RETAILER_IDENTITY_CONFLICT",
          message:
            "The email and phone belong to different retailer accounts. Use matching registered details.",
        });
      }

      const existingRetailer = existingRetailers[0];
      if (!existingRetailer) {
        await connection.rollback();
        return res.status(404).json({
          code: "RETAILER_ACCOUNT_REQUIRED",
          message:
            "No retailer account matches this email or phone. Ask the retailer to register, then connect the account.",
        });
      }

      const retailerId = existingRetailer.id;
      const [existingConnections] = await connection.query(
        `SELECT id FROM wholesaler_retailers
         WHERE wholesaler_id = ? AND retailer_id = ? LIMIT 1`,
        [wholesalerId, retailerId]
      );
      if (existingConnections.length) {
        await connection.rollback();
        return res.status(409).json({
          message: "This retailer is already connected to your business.",
        });
      }

      const [connectionResult] =
        await connection.query(
          `
          INSERT INTO wholesaler_retailers (
            wholesaler_id,
            retailer_id,
            source,
            credit_limit,
            payment_terms,
            notes,
            status,
            created_at
          )
          VALUES (
            ?,
            ?,
            'manual',
            ?,
            ?,
            ?,
            'active',
            CURRENT_TIMESTAMP
          )
          `,
          [
            wholesalerId,
            retailerId,
            cleanCreditLimit,
            cleanPaymentTerms,
            cleanNotes || null,
          ]
        );

      await connection.commit();

      return res.status(201).json({
        message: "Existing retailer connected successfully.",

        retailer: {
          id: retailerId,
          connection_id: connectionResult.insertId,
          business_name: cleanBusinessName,
          name: cleanName,
          email: cleanEmail || null,
          phone: cleanPhone,
          location: cleanLocation,
          address: cleanAddress || null,
          tax_number: cleanTaxNumber || null,
          credit_limit: cleanCreditLimit,
          payment_terms: cleanPaymentTerms,
          notes: cleanNotes || null,
          source: "manual",
          status: "active",
        },

      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          logFailure("CREATE RETAILER ROLLBACK ERROR:", rollbackError);
        }
      }

      if (error?.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          message:
            "This retailer or connection already exists.",
        });
      }

      logFailure("CREATE WHOLESALER RETAILER ERROR:", error);

      next(error);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  })
);
// ======================================================
// GET ONE CONNECTED RETAILER
// GET /api/wholesaler/retailers/:id
// ======================================================

app.get(
  "/api/wholesaler/retailers/:id",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const wholesalerId = Number(req.user.id);
      const retailerId = Number(req.params.id);

      if (!retailerId) {
        return res.status(400).json({
          message: "Invalid retailer ID.",
        });
      }

      const retailers = await q(
        `
        SELECT
          u.id,
          u.business_name,
          u.name,
          u.email,
          u.phone,
          u.location,
          u.address,
          u.tax_number,
          u.status,

          wr.id AS connection_id,
          wr.source,
          wr.credit_limit,
          wr.payment_terms,
          wr.notes,
          wr.status AS connection_status,
          wr.created_at AS connected_at,

          COUNT(DISTINCT po.id) AS orders_count,

          COALESCE(
            SUM(DISTINCT COALESCE(po.total_amount, 0)),
            0
          ) AS order_value,

          0 AS outstanding,
          0 AS paid_amount,

          MAX(po.created_at) AS last_order_at

        FROM wholesaler_retailers wr

        INNER JOIN users u
          ON u.id = wr.retailer_id
          AND u.role = 'retailer'

        LEFT JOIN purchase_orders po
          ON po.retailer_id = u.id
          AND po.wholesaler_id = wr.wholesaler_id

        WHERE wr.wholesaler_id = ?
          AND wr.retailer_id = ?
          AND wr.status = 'active'

        GROUP BY
          u.id,
          u.business_name,
          u.name,
          u.email,
          u.phone,
          u.location,
          u.address,
          u.tax_number,
          u.status,

          wr.id,
          wr.source,
          wr.credit_limit,
          wr.payment_terms,
          wr.notes,
          wr.status,
          wr.created_at

        LIMIT 1
        `,
        [wholesalerId, retailerId]
      );

      if (!retailers.length) {
        return res.status(404).json({
          message:
            "Retailer not found or not connected to your business.",
        });
      }

      return res.json({
        retailer: retailers[0],
      });
    } catch (error) {
      logFailure("LOAD RETAILER DETAILS ERROR:", error);

      next(error);
    }
  })
);
// ======================================================
// RETAILER ORDERS
// GET /api/wholesaler/retailers/:id/orders
// ======================================================

app.get(
  "/api/wholesaler/retailers/:id/orders",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const wholesalerId = Number(req.user.id);
      const retailerId = Number(req.params.id);

      if (!retailerId) {
        return res.status(400).json({
          message: "Invalid retailer ID.",
        });
      }

      const orders = await q(
        `
        SELECT
          po.id,
          po.order_no,
          po.retailer_id,
          po.wholesaler_id,
          po.delivery_address,
          po.required_date,
          po.notes,
          po.status,
          po.subtotal,
          po.tax_amount,
          po.total_amount,
          po.delivered_at,
          po.created_at,
          po.updated_at,

          COUNT(DISTINCT poi.id) AS items_count

        FROM purchase_orders po

        LEFT JOIN purchase_order_items poi
          ON poi.order_id = po.id

        WHERE po.wholesaler_id = ?
          AND po.retailer_id = ?

        GROUP BY
          po.id,
          po.order_no,
          po.retailer_id,
          po.wholesaler_id,
          po.delivery_address,
          po.required_date,
          po.notes,
          po.status,
          po.subtotal,
          po.tax_amount,
          po.total_amount,
          po.delivered_at,
          po.created_at,
          po.updated_at

        ORDER BY po.created_at DESC
        `,
        [wholesalerId, retailerId]
      );

      return res.json({
        orders,
      });
    } catch (error) {
      logFailure("LOAD RETAILER ORDERS ERROR:", error);

      next(error);
    }
  })
);

// ======================================================
// RETAILER INVOICES
// GET /api/wholesaler/retailers/:id/invoices
// ======================================================

app.get(
  "/api/wholesaler/retailers/:id/invoices",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const wholesalerId = Number(req.user.id);
      const retailerId = Number(req.params.id);

      if (!retailerId) {
        return res.status(400).json({
          message: "Invalid retailer ID.",
        });
      }

      const invoices = await q(
        `
        SELECT
          i.id,
          i.invoice_no,
          i.source_type,
          i.order_id,
          i.catalog_order_id,
          i.retailer_id,
          i.wholesaler_id,
          i.subtotal,
          i.tax_amount,
          i.total_amount,
          i.paid_amount,
          i.due_date,
          i.status,
          i.created_at,

          po.order_no

        FROM invoices i

        LEFT JOIN purchase_orders po
          ON po.id = i.order_id

        WHERE i.wholesaler_id = ?
          AND i.retailer_id = ?

        ORDER BY i.created_at DESC
        `,
        [wholesalerId, retailerId]
      );

      return res.json({
        invoices,
      });
    } catch (error) {
      logFailure("LOAD RETAILER INVOICES ERROR:", error);

      next(error);
    }
  })
);

// ======================================================
// RETAILER PAYMENTS
// GET /api/wholesaler/retailers/:id/payments
// ======================================================

app.get(
  "/api/wholesaler/retailers/:id/payments",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const wholesalerId = Number(req.user.id);
      const retailerId = Number(req.params.id);

      if (!retailerId) {
        return res.status(400).json({
          message: "Invalid retailer ID.",
        });
      }

      const payments = await q(
        `
        SELECT
          p.id,
          p.payment_no,
          p.invoice_id,
          p.retailer_id,
          p.wholesaler_id,
          p.amount,
          p.method,
          p.reference_no,
          p.status,
          p.paid_at,
          p.created_at,

          i.invoice_no

        FROM payments p

        LEFT JOIN invoices i
          ON i.id = p.invoice_id

        WHERE p.wholesaler_id = ?
          AND p.retailer_id = ?

        ORDER BY
          COALESCE(p.paid_at, p.created_at) DESC
        `,
        [wholesalerId, retailerId]
      );

      return res.json({
        payments,
      });
    } catch (error) {
      logFailure("LOAD RETAILER PAYMENTS ERROR:", error);

      next(error);
    }
  })
);
// ======================================================
// GET WHOLESALER DELIVERIES
// GET /api/wholesaler/deliveries
// ======================================================

app.get(
  "/api/wholesaler/deliveries",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const wholesalerId = Number(req.user.id);

      const deliveries = await q(
        `
        SELECT
          d.id AS id,
          CONCAT('DEL-', LPAD(d.id, 6, '0'))
            AS delivery_no,

          d.order_id,
          d.wholesaler_id,
          d.delivery_type,
          d.delivery_notes,
          d.status,
          d.driver_name,
          d.driver_phone,
          d.vehicle_number,
          d.vehicle_number AS vehicle_no,
          d.dispatched_at,
          d.delivered_at,
          d.created_at,
          d.updated_at,

          o.order_no,
          o.retailer_id,
          o.delivery_address,
          o.required_date,
          o.notes AS order_notes,
          o.total_amount,

          COALESCE(u.business_name, o.business_name, o.customer_name) AS business_name,
          COALESCE(u.business_name, o.business_name, o.customer_name) AS retailer_name,
          COALESCE(u.name, o.customer_name) AS contact_name,
          COALESCE(u.phone, o.phone) AS contact_phone,
          COALESCE(u.phone, o.phone) AS retailer_phone,
          u.location

        FROM wholesale_catalog_deliveries d

        INNER JOIN wholesale_catalog_orders o
          ON o.id = d.order_id
         AND o.wholesaler_id = d.wholesaler_id

        LEFT JOIN users u
          ON u.id = o.retailer_id
          AND u.role = 'retailer'

        WHERE d.wholesaler_id = ?

        ORDER BY d.created_at DESC, d.id DESC
        `,
        [wholesalerId]
      );

      return res.json({
        deliveries,
      });
    } catch (error) {
      logFailure("LOAD WHOLESALER DELIVERIES ERROR:", error);

      next(error);
    }
  })
);
// ======================================================
// GET ONE DELIVERY WITH ITEMS
// GET /api/wholesaler/deliveries/:id
// ======================================================
app.get(
  "/api/wholesaler/deliveries/:id",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const wholesalerId = Number(req.user.id);
      const deliveryId = Number(req.params.id);

      if (
        !Number.isInteger(deliveryId) ||
        deliveryId <= 0
      ) {
        return res.status(400).json({
          message: "Invalid delivery ID.",
        });
      }

      const deliveries = await q(
        `
        SELECT
          d.id,
          CONCAT('DEL-', LPAD(d.id, 6, '0'))
            AS delivery_no,

          d.order_id,
          d.wholesaler_id,
          d.delivery_type,
          d.delivery_notes,
          d.delivery_notes AS notes,
          d.status,

          d.driver_name,
          d.driver_phone,

          d.vehicle_number,
          d.vehicle_number AS vehicle_no,

          d.packed_at,
          d.ready_at,
          d.dispatched_at,
          d.out_for_delivery_at,
          d.delivered_at,

          d.created_at,
          d.updated_at,

          o.order_no,
          o.customer_name,
          o.business_name,
          o.phone,
          o.email,
          o.delivery_address,
          o.required_date,
          o.total_amount

        FROM wholesale_catalog_deliveries d

        INNER JOIN wholesale_catalog_orders o
          ON o.id = d.order_id

        WHERE d.id = ?
          AND d.wholesaler_id = ?

        LIMIT 1
        `,
        [
          deliveryId,
          wholesalerId,
        ]
      );

      if (!deliveries.length) {
        return res.status(404).json({
          message:
            "Delivery not found or it does not belong to your business.",
        });
      }

      const delivery = deliveries[0];

      const items = await q(
        `
        SELECT
          oi.id,
          oi.order_id,
          oi.product_id,
          oi.product_name,
          oi.sku,
          oi.unit,
          oi.price,
          oi.quantity,
          oi.line_total

        FROM wholesale_catalog_order_items oi

        WHERE oi.order_id = ?

        ORDER BY oi.id ASC
        `,
        [delivery.order_id]
      );

      return res.json({
        delivery,
        items,
      });
    } catch (error) {
      logFailure("LOAD DELIVERY DETAILS ERROR:", error);

      next(error);
    }
  })
);
// ======================================================
// GET ONE WHOLESALER INVOICE
// GET /api/wholesaler/invoices/:id
// ======================================================
// ======================================================
// WHOLESALER: UPDATE DELIVERY
// PATCH /api/wholesaler/deliveries/:id
// ======================================================

app.patch(
  "/api/wholesaler/deliveries/:id",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const wholesalerId = Number(req.user.id);
      const deliveryId = Number(req.params.id);

      if (
        !Number.isInteger(deliveryId) ||
        deliveryId <= 0
      ) {
        return res.status(400).json({
          message: "Invalid delivery ID.",
        });
      }

      const {
        driver_name,
        driver_phone,
        vehicle_number,
        delivery_notes,
        status,
      } = req.body || {};

      // Check delivery ownership
      const deliveries = await q(
        `
        SELECT
          id,
          order_id,
          status
        FROM wholesale_catalog_deliveries
        WHERE id = ?
          AND wholesaler_id = ?
        LIMIT 1
        `,
        [
          deliveryId,
          wholesalerId,
        ]
      );

      if (!deliveries.length) {
        return res.status(404).json({
          message:
            "Delivery not found or it does not belong to your business.",
        });
      }

      const delivery = deliveries[0];

      const allowedStatuses = [
        "pending",
        "packed",
        "ready",
        "dispatched",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ];

      const nextStatus =
        status !== undefined
          ? String(status).trim().toLowerCase()
          : delivery.status;

      if (!allowedStatuses.includes(nextStatus)) {
        return res.status(400).json({
          message: "Invalid delivery status.",
        });
      }

      if (nextStatus !== delivery.status && !DELIVERY_TRANSITIONS[delivery.status]?.has(nextStatus)) {
        return res.status(422).json({
          message: "Invalid delivery status transition.",
        });
      }

      await q(
        `
        UPDATE wholesale_catalog_deliveries

        SET
          driver_name = ?,
          driver_phone = ?,
          vehicle_number = ?,
          delivery_notes = ?,
          status = ?,

          packed_at =
            CASE
              WHEN ? = 'packed'
                AND packed_at IS NULL
              THEN CURRENT_TIMESTAMP
              ELSE packed_at
            END,

          ready_at =
            CASE
              WHEN ? = 'ready'
                AND ready_at IS NULL
              THEN CURRENT_TIMESTAMP
              ELSE ready_at
            END,

          dispatched_at =
            CASE
              WHEN ? = 'dispatched'
                AND dispatched_at IS NULL
              THEN CURRENT_TIMESTAMP
              ELSE dispatched_at
            END,

          out_for_delivery_at =
            CASE
              WHEN ? = 'out_for_delivery'
                AND out_for_delivery_at IS NULL
              THEN CURRENT_TIMESTAMP
              ELSE out_for_delivery_at
            END,

          delivered_at =
            CASE
              WHEN ? = 'delivered'
                AND delivered_at IS NULL
              THEN CURRENT_TIMESTAMP
              ELSE delivered_at
            END,

          updated_at = CURRENT_TIMESTAMP

        WHERE id = ?
          AND wholesaler_id = ?
        `,
        [
          driver_name || null,
          driver_phone || null,
          vehicle_number || null,
          delivery_notes || null,

          nextStatus,

          nextStatus,
          nextStatus,
          nextStatus,
          nextStatus,
          nextStatus,

          deliveryId,
          wholesalerId,
        ]
      );

      const orderStatus = {
        packed: 'packed',
        ready: 'packed',
        dispatched: 'dispatched',
        out_for_delivery: 'dispatched',
        delivered: 'delivered',
      }[nextStatus];
      if (orderStatus) {
        await q(`UPDATE wholesale_catalog_orders SET status=?, updated_at=CURRENT_TIMESTAMP
                 WHERE id=? AND wholesaler_id=?`, [orderStatus, delivery.order_id, wholesalerId]);
      }

      const updated = await q(
        `
        SELECT *
        FROM wholesale_catalog_deliveries
        WHERE id = ?
          AND wholesaler_id = ?
        LIMIT 1
        `,
        [
          deliveryId,
          wholesalerId,
        ]
      );

      return res.json({
        message:
          "Delivery information saved successfully.",

        delivery: updated[0],
      });
    } catch (error) {
      logFailure("UPDATE DELIVERY ERROR:", error);

      next(error);
    }
  })
);
app.get(
  "/api/wholesaler/invoices/:id",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const wholesalerId = Number(req.user.id);
      const invoiceId = Number(req.params.id);

      if (!invoiceId) {
        return res.status(400).json({
          message: "Invalid invoice ID.",
        });
      }

      const invoices = await q(
        `
        SELECT
          i.id,
          i.invoice_no,
          i.source_type,
          i.order_id,
          i.catalog_order_id,
          i.retailer_id,
          i.wholesaler_id,
          i.subtotal,
          i.tax_amount,
          i.total_amount,
          i.paid_amount,
          i.due_date,
          i.status,
          i.created_at,

          COALESCE(po.order_no, co.order_no) AS order_no,
          COALESCE(po.delivery_address, co.delivery_address) AS delivery_address,
          COALESCE(po.required_date, co.required_date) AS required_date,
          COALESCE(po.notes, co.notes) AS order_notes,

          COALESCE(retailer.business_name, i.business_name, i.customer_name) AS retailer_business_name,
          COALESCE(retailer.name, i.customer_name) AS retailer_name,
          COALESCE(retailer.email, i.customer_email) AS retailer_email,
          COALESCE(retailer.phone, i.customer_phone) AS retailer_phone,
          retailer.location AS retailer_location,
          retailer.address AS retailer_address,
          retailer.tax_number AS retailer_tax_number,

          merchant.business_name AS merchant_business_name,
          merchant.name AS merchant_name,
          merchant.email AS merchant_email,
          merchant.phone AS merchant_phone,
          merchant.location AS merchant_location,
          merchant.address AS merchant_address,
          merchant.tax_number AS merchant_tax_number,
          merchant.license_number AS merchant_license_number,
          merchant.website AS merchant_website,
          merchant.logo_url AS merchant_logo_url,
          merchant.description AS merchant_description

        FROM invoices i

        LEFT JOIN purchase_orders po
          ON po.id = i.order_id

        LEFT JOIN wholesale_catalog_orders co
          ON co.id = i.catalog_order_id

        LEFT JOIN users retailer
          ON retailer.id = i.retailer_id

        INNER JOIN users merchant
          ON merchant.id = i.wholesaler_id
          AND merchant.role = 'wholesaler'

        WHERE i.id = ?
          AND i.wholesaler_id = ?

        LIMIT 1
        `,
        [invoiceId, wholesalerId]
      );

      if (!invoices.length) {
        return res.status(404).json({
          message:
            "Invoice not found or it does not belong to your business.",
        });
      }

      const invoiceRow = invoices[0];

      const items = invoiceRow.source_type === 'catalog_order'
        ? await q(`
        SELECT id, order_id, product_name, quantity, unit, price AS unit_price,
          NULL AS notes, line_total
        FROM wholesale_catalog_order_items
        WHERE order_id = ? ORDER BY id ASC`, [invoiceRow.catalog_order_id])
        : await q(`
        SELECT
          poi.id,
          poi.order_id,
          poi.product_name,
          poi.quantity,
          poi.unit,
          poi.unit_price,
          poi.notes,

          (
            COALESCE(poi.quantity, 0) *
            COALESCE(poi.unit_price, 0)
          ) AS line_total

        FROM purchase_order_items poi

        WHERE poi.order_id = ?

        ORDER BY poi.id ASC
        `,
        [invoiceRow.order_id]);

      const payments = await q(
        `
        SELECT
          p.id,
          p.payment_no,
          p.invoice_id,
          p.retailer_id,
          p.wholesaler_id,
          p.amount,
          p.method,
          p.reference_no,
          p.status,
          p.paid_at,
          p.created_at

        FROM payments p

        WHERE p.invoice_id = ?
          AND p.wholesaler_id = ?

        ORDER BY
          COALESCE(p.paid_at, p.created_at) DESC
        `,
        [invoiceId, wholesalerId]
      );

      return res.json({
        invoice: {
          id: invoiceRow.id,
          invoice_no: invoiceRow.invoice_no,
          source_type: invoiceRow.source_type,
          order_id: invoiceRow.order_id || invoiceRow.catalog_order_id,
          order_no: invoiceRow.order_no,
          retailer_id: invoiceRow.retailer_id,
          wholesaler_id: invoiceRow.wholesaler_id,
          subtotal: invoiceRow.subtotal,
          tax_amount: invoiceRow.tax_amount,
          total_amount: invoiceRow.total_amount,
          paid_amount: invoiceRow.paid_amount,
          due_date: invoiceRow.due_date,
          status: invoiceRow.status,
          created_at: invoiceRow.created_at,
          notes: invoiceRow.order_notes,
        },

        merchant: {
          id: invoiceRow.wholesaler_id,
          business_name:
            invoiceRow.merchant_business_name,
          name: invoiceRow.merchant_name,
          email: invoiceRow.merchant_email,
          phone: invoiceRow.merchant_phone,
          location: invoiceRow.merchant_location,
          address: invoiceRow.merchant_address,
          tax_number:
            invoiceRow.merchant_tax_number,
          license_number:
            invoiceRow.merchant_license_number,
          website: invoiceRow.merchant_website,
          logo_url: invoiceRow.merchant_logo_url,
          description:
            invoiceRow.merchant_description,
        },

        retailer: {
          id: invoiceRow.retailer_id,
          business_name:
            invoiceRow.retailer_business_name,
          name: invoiceRow.retailer_name,
          email: invoiceRow.retailer_email,
          phone: invoiceRow.retailer_phone,
          location: invoiceRow.retailer_location,
          address: invoiceRow.retailer_address,
          tax_number:
            invoiceRow.retailer_tax_number,
        },

        items,
        payments,
      });
    } catch (error) {
      logFailure("LOAD INVOICE DETAILS ERROR:", error);

      next(error);
    }
  })
);
// ======================================================
// WHOLESALER PAYMENTS MODULE
// Add before your final 404 handler and app.listen().
// Requires existing: app, auth, allow, q, pool.
// ======================================================

// GET /api/wholesaler/payments


// GET /api/wholesaler/payments/:id
app.get(
  "/api/wholesaler/payments/:id",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const wholesalerId = Number(req.user.id);
      const paymentId = Number(req.params.id);

      if (!paymentId) {
        return res.status(400).json({
          message: "Invalid payment ID.",
        });
      }

      const rows = await q(
        `
        SELECT
          p.id,
          p.payment_no,
          p.invoice_id,
          p.retailer_id,
          p.wholesaler_id,
          p.amount,
          p.method,
          p.reference_no,
          p.status,
          p.paid_at,
          p.created_at,

          i.invoice_no,
          i.order_id,
          i.subtotal,
          i.tax_amount,
          i.total_amount,
          i.paid_amount,
          i.due_date,
          i.status AS invoice_status,

          COALESCE(retailer.business_name, i.business_name, i.customer_name) AS retailer_business_name,
          COALESCE(retailer.name, i.customer_name) AS retailer_name,
          COALESCE(retailer.email, i.customer_email) AS retailer_email,
          COALESCE(retailer.phone, i.customer_phone) AS retailer_phone,
          retailer.location AS retailer_location,
          retailer.address AS retailer_address,
          retailer.tax_number AS retailer_tax_number,

          merchant.business_name AS merchant_business_name,
          merchant.name AS merchant_name,
          merchant.email AS merchant_email,
          merchant.phone AS merchant_phone,
          merchant.location AS merchant_location,
          merchant.address AS merchant_address,
          merchant.tax_number AS merchant_tax_number,
          merchant.license_number AS merchant_license_number,
          merchant.website AS merchant_website,
          merchant.logo_url AS merchant_logo_url

        FROM payments p

        INNER JOIN invoices i
          ON i.id = p.invoice_id

        LEFT JOIN users retailer
          ON retailer.id = p.retailer_id

        INNER JOIN users merchant
          ON merchant.id = p.wholesaler_id
          AND merchant.role = 'wholesaler'

        WHERE p.id = ?
          AND p.wholesaler_id = ?

        LIMIT 1
        `,
        [paymentId, wholesalerId]
      );

      if (!rows.length) {
        return res.status(404).json({
          message:
            "Payment not found or it does not belong to your business.",
        });
      }

      const row = rows[0];

      return res.json({
        payment: {
          id: row.id,
          payment_no: row.payment_no,
          invoice_id: row.invoice_id,
          invoice_no: row.invoice_no,
          retailer_id: row.retailer_id,
          wholesaler_id: row.wholesaler_id,
          amount: row.amount,
          method: row.method,
          reference_no: row.reference_no,
          status: row.status,
          paid_at: row.paid_at,
          created_at: row.created_at,
        },

        invoice: {
          id: row.invoice_id,
          invoice_no: row.invoice_no,
          order_id: row.order_id,
          subtotal: row.subtotal,
          tax_amount: row.tax_amount,
          total_amount: row.total_amount,
          paid_amount: row.paid_amount,
          due_date: row.due_date,
          status: row.invoice_status,
        },

        retailer: {
          id: row.retailer_id,
          business_name: row.retailer_business_name,
          name: row.retailer_name,
          email: row.retailer_email,
          phone: row.retailer_phone,
          location: row.retailer_location,
          address: row.retailer_address,
          tax_number: row.retailer_tax_number,
        },

        merchant: {
          id: row.wholesaler_id,
          business_name: row.merchant_business_name,
          name: row.merchant_name,
          email: row.merchant_email,
          phone: row.merchant_phone,
          location: row.merchant_location,
          address: row.merchant_address,
          tax_number: row.merchant_tax_number,
          license_number: row.merchant_license_number,
          website: row.merchant_website,
          logo_url: row.merchant_logo_url,
        },
      });
    } catch (error) {
      logFailure("LOAD PAYMENT DETAILS ERROR:", error);
      next(error);
    }
  })
);

// POST /api/wholesaler/payments
app.post(
  "/api/wholesaler/payments",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    let connection;

    try {
      const wholesalerId = Number(req.user.id);
      const {
        invoice_id,
        amount,
        method = "bank_transfer",
        reference_no,
        status = "paid",
        paid_at,
      } = req.body || {};

      const invoiceId = Number(invoice_id);
      const paymentAmount = Number(amount);

      const allowedMethods = [
        "cash",
        "bank_transfer",
        "upi",
        "card",
        "credit",
      ];

      const allowedStatuses = [
        "pending",
        "paid",
        "failed",
      ];

      if (!invoiceId) {
        return res.status(400).json({
          message: "Invoice is required.",
        });
      }

      if (!validPaymentAmount(paymentAmount)) {
        return res.status(400).json({
          message: "Enter a valid payment amount.",
        });
      }

      if (!allowedMethods.includes(method)) {
        return res.status(400).json({
          message: "Invalid payment method.",
        });
      }

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          message: "Invalid payment status.",
        });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [invoiceRows] = await connection.query(
        `
        SELECT
          id,
          invoice_no,
          retailer_id,
          wholesaler_id,
          total_amount,
          paid_amount,
          status
        FROM invoices
        WHERE id = ?
          AND wholesaler_id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [invoiceId, wholesalerId]
      );

      if (!invoiceRows.length) {
        await connection.rollback();

        return res.status(404).json({
          message:
            "Invoice not found or it does not belong to your business.",
        });
      }

      const invoice = invoiceRows[0];

      if (invoice.status === "cancelled") {
        await connection.rollback();
        return res.status(409).json({
          message: "Payments cannot be recorded for a cancelled invoice.",
        });
      }

      const [[paymentTotals]] = await connection.query(
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid_amount,
           COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending_amount
         FROM payments
         WHERE invoice_id = ?`,
        [invoiceId]
      );
      const outstanding = availableInvoiceBalance(
        invoice.total_amount,
        paymentTotals.paid_amount,
        paymentTotals.pending_amount
      );

      if (paymentAmount > outstanding) {
        await connection.rollback();

        return res.status(400).json({
          message:
            "Payment amount cannot exceed the invoice balance.",
          outstanding,
        });
      }

      const paymentNo = recordNumber('PAY');

      const paymentDate =
        paid_at ||
        (status === "paid" ? new Date() : null);

      const [result] = await connection.query(
        `
        INSERT INTO payments (
          payment_no,
          invoice_id,
          retailer_id,
          wholesaler_id,
          amount,
          method,
          reference_no,
          status,
          paid_at,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        [
          paymentNo,
          invoiceId,
          invoice.retailer_id,
          wholesalerId,
          paymentAmount,
          method,
          reference_no || null,
          status,
          paymentDate,
        ]
      );

      if (status === "paid") {
        const { paidAmount: newPaidAmount, status: newInvoiceStatus } = invoiceState(
          invoice.total_amount,
          Number(paymentTotals.paid_amount) + paymentAmount,
          invoice.status
        );

        await connection.query(
          `
          UPDATE invoices
          SET
            paid_amount = ?,
            status = ?
          WHERE id = ?
            AND wholesaler_id = ?
          `,
          [
            newPaidAmount,
            newInvoiceStatus,
            invoiceId,
            wholesalerId,
          ]
        );
      }

      await connection.commit();

      return res.status(201).json({
        message: "Payment recorded successfully.",
        payment: {
          id: result.insertId,
          payment_no: paymentNo,
          invoice_id: invoiceId,
          retailer_id: invoice.retailer_id,
          wholesaler_id: wholesalerId,
          amount: paymentAmount,
          method,
          reference_no: reference_no || null,
          status,
          paid_at: paymentDate,
        },
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          logFailure("PAYMENT ROLLBACK ERROR:", rollbackError);
        }
      }

      logFailure("RECORD PAYMENT ERROR:", error);
      next(error);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  })
);
// ======================================================
// UPLOAD CATALOG COVER IMAGE
// POST /api/wholesaler/catalog/cover-image
// ======================================================
// ======================================================
// UPLOAD CATALOG COVER IMAGE
// POST /api/wholesaler/catalog/cover-image
// ======================================================

app.post(
  "/api/wholesaler/catalog/cover-image",
  auth,
  allow("wholesaler"),
  productImageUpload.single("image"),
  asyncHandler(async (req, res) => {
    try {
      const wholesalerId = Number(req.user.id);

      if (!req.file) {
        return res.status(400).json({
          message: "Select a catalog cover image.",
        });
      }

      if (!process.env.S3_BUCKET) {
        return res.status(500).json({
          message:
            "S3_BUCKET is not configured on the server.",
        });
      }

      const extensions = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
      };

      const extension =
        extensions[req.file.mimetype] || ".jpg";

      const imageKey = [
        "merchant-products",
        String(wholesalerId),
        "catalog-covers",
        `${crypto.randomUUID()}${extension}`,
      ].join("/");

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: imageKey,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
          CacheControl:
            "public, max-age=31536000, immutable",
        })
      );

      const imageUrl = getPublicS3Url(imageKey);

      const [catalog] = await q(
        `
        SELECT
          id,
          cover_image_url
        FROM wholesale_catalogs
        WHERE wholesaler_id = ?
        LIMIT 1
        `,
        [wholesalerId]
      );

      if (!catalog) {
        return res.status(404).json({
          message: "Catalog not found.",
        });
      }

      const result = await q(
        `
        UPDATE wholesale_catalogs
        SET
          cover_image_url = ?,
          cover_updated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE wholesaler_id = ?
        `,
        [imageUrl, wholesalerId]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          message: "Catalog not found.",
        });
      }

      return res.status(201).json({
        message:
          "Catalog cover uploaded successfully.",
        cover_image_url: imageUrl,
        cover_image_key: imageKey,
      });
    } catch (error) {
      logFailure("CATALOG COVER UPLOAD ERROR:", {
          name: error?.name,
          message: error?.message,
          code: error?.Code || error?.code,
          status:
            error?.$metadata?.httpStatusCode,
          resource: error?.Resource,
          stack: error?.stack,
        });

      return res
        .status(
          error?.$metadata?.httpStatusCode || 500
        )
        .json({
          message:
            error?.message ||
            "Unable to upload catalog cover image.",
        });
    }
  })
);
// ======================================================
// UPDATE CATALOG COVER SETTINGS
// PUT /api/wholesaler/catalog/settings
// ======================================================

// ======================================================
// UPDATE CATALOG STOREFRONT SETTINGS
// PUT /api/wholesaler/catalog/settings
// ======================================================

app.put(
  "/api/wholesaler/catalog/settings",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const wholesalerId = Number(req.user.id);

      const {
        catalog_title,
        catalog_description,
      } = req.body || {};

      const cleanTitle = String(
        catalog_title || ""
      ).trim();

      const cleanDescription = String(
        catalog_description || ""
      ).trim();

      if (!cleanTitle) {
        return res.status(400).json({
          message: "Catalog title is required.",
        });
      }

      if (cleanTitle.length > 180) {
        return res.status(400).json({
          message:
            "Catalog title must be 180 characters or fewer.",
        });
      }

      if (cleanDescription.length > 500) {
        return res.status(400).json({
          message:
            "Catalog description must be 500 characters or fewer.",
        });
      }

      const result = await q(
        `
        UPDATE wholesale_catalogs
        SET
          catalog_title = ?,
          catalog_description = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE wholesaler_id = ?
        `,
        [
          cleanTitle,
          cleanDescription || null,
          wholesalerId,
        ]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          message: "Catalog not found.",
        });
      }

      const [catalog] = await q(
        `
        SELECT
          id,
          wholesaler_id,
          slug,
          title,
          catalog_title,
          catalog_description,
          cover_image_url,
          cover_updated_at,
          is_published,
          created_at,
          updated_at
        FROM wholesale_catalogs
        WHERE wholesaler_id = ?
        LIMIT 1
        `,
        [wholesalerId]
      );

      return res.json({
        message:
          "Storefront settings updated successfully.",
        catalog,
      });
    } catch (error) {
      logFailure("UPDATE CATALOG SETTINGS ERROR:", error);

      next(error);
    }
  })
);
// ======================================================
// REMOVE CATALOG COVER IMAGE
// DELETE /api/wholesaler/catalog/cover-image
// ======================================================

app.delete(
  "/api/wholesaler/catalog/cover-image",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const wholesalerId = Number(req.user.id);

      const catalogs = await q(
        `
        SELECT
          id,
          cover_image_url
        FROM catalogs
        WHERE wholesaler_id = ?
        LIMIT 1
        `,
        [wholesalerId]
      );

      if (!catalogs.length) {
        return res.status(404).json({
          message: "Catalog not found.",
        });
      }

      await q(
        `
        UPDATE catalogs
        SET
          cover_image_url = NULL,
          cover_updated_at = CURRENT_TIMESTAMP
        WHERE wholesaler_id = ?
        `,
        [wholesalerId]
      );

      return res.json({
        message: "Catalog cover removed successfully.",
        cover_image_url: null,
      });
    } catch (error) {
      logFailure("REMOVE CATALOG COVER ERROR:", error);

      next(error);
    }
  })
);

// ======================================================
// SEND INVOICE TO RETAILER
// POST /api/wholesaler/invoices/:id/send
// ======================================================

app.post(
  "/api/wholesaler/invoices/:id/send",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const invoiceId = Number(req.params.id);
      const wholesalerId = Number(req.user.id);

      if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
        return res.status(400).json({
          message: "Invalid invoice ID.",
        });
      }

      const [invoice] = await q(
        `
        SELECT
          i.id,
          i.invoice_no,
          i.order_id,
          i.retailer_id,
          i.wholesaler_id,
          i.total_amount,
          i.paid_amount,
          i.due_date,
          i.status,
          r.business_name AS retailer_business_name,
          r.name AS retailer_name,
          r.email AS retailer_email,
          r.phone AS retailer_phone
        FROM invoices i
        LEFT JOIN users r
          ON r.id = i.retailer_id
        WHERE i.id = ?
          AND i.wholesaler_id = ?
        LIMIT 1
        `,
        [invoiceId, wholesalerId]
      );

      if (!invoice) {
        return res.status(404).json({
          message:
            "Invoice not found or does not belong to your business.",
        });
      }

      if (!invoice.retailer_email) {
        return res.status(400).json({
          message:
            "The retailer does not have an email address.",
        });
      }

      /*
       * Add your email provider here.
       *
       * Example:
       * await sendEmail({
       *   to: invoice.retailer_email,
       *   subject: `Invoice ${invoice.invoice_no}`,
       *   html: invoiceEmailTemplate(invoice),
       * });
       */

      return res.json({
        message: "Invoice sent successfully.",
        invoice: {
          id: invoice.id,
          invoice_no: invoice.invoice_no,
          retailer_email: invoice.retailer_email,
        },
      });
    } catch (error) {
      logFailure("SEND INVOICE ERROR:", error);
      next(error);
    }
  })
);// ======================================================
// WHOLESALER: CONFIRM ORDER + GENERATE INVOICE
// POST /api/wholesaler/orders/:id/confirm
// ======================================================

// ======================================================
// WHOLESALER: CONFIRM ORDER + GENERATE INVOICE
// POST /api/wholesaler/orders/:id/confirm
// ======================================================

app.post(
  "/api/wholesaler/orders/:id/confirm",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    const connection = await pool.getConnection();

    try {
      const {
        payment_type = "due",
        payment_due_date = null,
      } = req.body || {};

      const allowedPayments = [
        "online",
        "due",
        "credit",
        "cash_on_delivery",
      ];

      if (!allowedPayments.includes(payment_type)) {
        return res.status(400).json({
          message: "Invalid payment type.",
        });
      }

      await connection.beginTransaction();

      const orderId = Number(req.params.id);

      const [[order]] = await connection.query(
        `
        SELECT *
        FROM wholesale_catalog_orders
        WHERE id = ?
          AND wholesaler_id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [orderId, req.user.id]
      );

      if (!order) {
        await connection.rollback();

        return res.status(404).json({
          message: "Order not found.",
        });
      }

      if (order.status === "cancelled") {
        await connection.rollback();

        return res.status(409).json({
          message: "Cancelled orders cannot be confirmed.",
        });
      }

      const [items] = await connection.query(
        `
        SELECT
          oi.id,
          oi.product_id,
          oi.product_name,
          oi.sku,
          oi.unit,
          oi.price,
          oi.quantity,
          oi.line_total,
          p.price_mode
        FROM wholesale_catalog_order_items oi

        LEFT JOIN wholesale_products p
          ON p.id = oi.product_id

        WHERE oi.order_id = ?
        ORDER BY oi.id ASC
        `,
        [orderId]
      );

      if (!items.length) {
        await connection.rollback();

        return res.status(400).json({
          message: "Order has no products.",
        });
      }

      const hasMissingQuotePrice = items.some(
        (item) =>
          item.price_mode === "quote" &&
          Number(item.price || 0) <= 0
      );

      if (hasMissingQuotePrice) {
        await connection.rollback();

        return res.status(400).json({
          message:
            "Enter a price for all price-on-request products before confirming this order.",
        });
      }

      const totalAmount = items.reduce(
        (total, item) =>
          total +
          Number(item.quantity || 0) *
            Number(item.price || 0),
        0
      );

      if (totalAmount <= 0) {
        await connection.rollback();

        return res.status(400).json({
          message:
            "Order total must be greater than zero before confirmation.",
        });
      }

      await connection.query(
        `
        UPDATE wholesale_catalog_orders
        SET
          total_amount = ?,
          status = 'confirmed',
          payment_type = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND wholesaler_id = ?
        `,
        [
          totalAmount,
          payment_type,
          orderId,
          req.user.id,
        ]
      );

      const [[existingInvoice]] =
        await connection.query(
          `
          SELECT *
          FROM invoices
          WHERE catalog_order_id = ?
            AND source_type = 'catalog_order'
          LIMIT 1
          `,
          [orderId]
        );

      let invoiceId = existingInvoice?.id || null;
      let invoiceNo =
        existingInvoice?.invoice_no || null;

      if (!existingInvoice) {
        invoiceNo =
          `INV-${Date.now()
            .toString()
            .slice(-10)}`;

        const [invoiceResult] =
          await connection.query(
            `
            INSERT INTO invoices
            (
              invoice_no,
              source_type,
              catalog_order_id,
              order_id,
              retailer_id,
              wholesaler_id,
              customer_name,
              business_name,
              customer_phone,
              customer_email,
              subtotal,
              tax_amount,
              total_amount,
              payment_type,
              due_date,
              status,
              lifecycle_status
            )
            VALUES
            (
              ?, 'catalog_order', ?, NULL, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?,
              'unpaid', 'issued'
            )
            `,
            [
              invoiceNo,
              order.id,
              order.retailer_id,
              order.wholesaler_id,
              order.customer_name,
              order.business_name,
              order.phone,
              order.email,
              totalAmount,
              totalAmount,
              payment_type,
              payment_due_date,
            ]
          );

        invoiceId = invoiceResult.insertId;
      }

      await connection.commit();

      return res.status(201).json({
        message:
          "Order confirmed and invoice generated.",
        order_id: orderId,
        invoice_id: invoiceId,
        invoice_no: invoiceNo,
        total_amount: totalAmount,
        payment_status:
          existingInvoice?.payment_status ||
          "pending",
      });
    } catch (error) {
      await connection.rollback();

      logFailure("CONFIRM CATALOG ORDER ERROR:", error);

      next(error);
    } finally {
      connection.release();
    }
  })
);

// ======================================================
// WHOLESALER: UPDATE ORDER PAYMENT
// POST /api/wholesaler/orders/:id/payment
// ======================================================

app.post(
  "/api/wholesaler/orders/:id/payment",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const orderId = Number(req.params.id);

      const {
        payment_type,
        payment_status,
        amount,
        reference,
      } = req.body || {};

      if (
        !Number.isInteger(orderId) ||
        orderId <= 0
      ) {
        return res.status(400).json({
          message: "Invalid order ID.",
        });
      }

      const allowedTypes = [
        "online",
        "due",
        "credit",
        "cash",
      ];

      const allowedStatuses = [
        "pending",
        "partial",
        "paid",
      ];

      if (
        payment_type &&
        !allowedTypes.includes(payment_type)
      ) {
        return res.status(400).json({
          message: "Invalid payment type.",
        });
      }

      if (
        payment_status &&
        !allowedStatuses.includes(
          payment_status
        )
      ) {
        return res.status(400).json({
          message: "Invalid payment status.",
        });
      }

      if (["partial", "paid"].includes(payment_status)) {
        return res.status(409).json({
          message: "Record or approve a payment to change the invoice balance.",
        });
      }

      const [order] = await q(
        `
        SELECT id, total_amount
        FROM wholesale_catalog_orders
        WHERE id = ?
          AND wholesaler_id = ?
        LIMIT 1
        `,
        [orderId, req.user.id]
      );

      if (!order) {
        return res.status(404).json({
          message: "Order not found.",
        });
      }

      await q(
        `
        UPDATE wholesale_catalog_orders
        SET
          payment_type = ?,
          payment_status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND wholesaler_id = ?
        `,
        [
          payment_type || null,
          payment_status || "pending",
          orderId,
          req.user.id,
        ]
      );

      await q(
        `
        UPDATE invoices
        SET
          payment_type = COALESCE(?, payment_type),
          updated_at = CURRENT_TIMESTAMP
        WHERE catalog_order_id = ?
          AND source_type = 'catalog_order'
          AND wholesaler_id = ?
        `,
        [
          payment_type || null,
          orderId,
          req.user.id,
        ]
      );

      return res.json({
        message:
          "Payment information updated.",
        order_id: orderId,
        payment_type,
        payment_status:
          payment_status || "pending",
        amount:
          amount !== undefined
            ? Number(amount)
            : Number(
                order.total_amount || 0
              ),
        reference: reference || null,
      });
    } catch (error) {
      logFailure("UPDATE ORDER PAYMENT ERROR:", error);

      next(error);
    }
  })
);
// ======================================================
// WHOLESALER: SET QUOTED PRICE FOR ORDER ITEM
// PATCH /api/wholesaler/orders/:orderId/items/:itemId/price
// ======================================================

app.patch(
  "/api/wholesaler/orders/:orderId/items/:itemId/price",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const orderId = Number(req.params.orderId);
      const itemId = Number(req.params.itemId);
      const unitPrice = Number(req.body?.unit_price);

      if (
        !Number.isInteger(orderId) ||
        orderId <= 0 ||
        !Number.isInteger(itemId) ||
        itemId <= 0
      ) {
        await connection.rollback();

        return res.status(400).json({
          message: "Invalid order or item ID.",
        });
      }

      if (
        !Number.isFinite(unitPrice) ||
        unitPrice <= 0
      ) {
        await connection.rollback();

        return res.status(400).json({
          message:
            "Quoted price must be greater than INR 0.00.",
        });
      }

      // Make sure order belongs to logged-in wholesaler
      const [[order]] = await connection.query(
        `
        SELECT
          id,
          wholesaler_id,
          status
        FROM wholesale_catalog_orders
        WHERE id = ?
          AND wholesaler_id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [orderId, req.user.id]
      );

      if (!order) {
        await connection.rollback();

        return res.status(404).json({
          message: "Order not found.",
        });
      }

      if (order.status !== "pending") {
        await connection.rollback();

        return res.status(409).json({
          message:
            "Prices can only be changed before the order is confirmed.",
        });
      }

      const [[item]] = await connection.query(
        `
        SELECT
          id,
          order_id,
          product_id,
          quantity,
          price
        FROM wholesale_catalog_order_items
        WHERE id = ?
          AND order_id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [itemId, orderId]
      );

      if (!item) {
        await connection.rollback();

        return res.status(404).json({
          message: "Order item not found.",
        });
      }

      const quantity = Number(item.quantity || 0);

      if (quantity <= 0) {
        await connection.rollback();

        return res.status(400).json({
          message: "Invalid product quantity.",
        });
      }

      const lineTotal = quantity * unitPrice;

      // Your table uses price + line_total
      await connection.query(
        `
        UPDATE wholesale_catalog_order_items
        SET
          price = ?,
          line_total = ?
        WHERE id = ?
          AND order_id = ?
        `,
        [
          unitPrice,
          lineTotal,
          itemId,
          orderId,
        ]
      );

      // Recalculate complete order total
      const [[totals]] = await connection.query(
        `
        SELECT
          COALESCE(SUM(line_total), 0) AS total_amount
        FROM wholesale_catalog_order_items
        WHERE order_id = ?
        `,
        [orderId]
      );

      const totalAmount = Number(
        totals?.total_amount || 0
      );

      await connection.query(
        `
        UPDATE wholesale_catalog_orders
        SET
          total_amount = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND wholesaler_id = ?
        `,
        [
          totalAmount,
          orderId,
          req.user.id,
        ]
      );

      await connection.commit();

      return res.json({
        message: "Quoted price saved successfully.",
        item_id: itemId,
        unit_price: unitPrice,
        line_total: lineTotal,
        total_amount: totalAmount,
      });
    } catch (error) {
      await connection.rollback();

      logFailure("UPDATE ORDER ITEM PRICE ERROR:", error);

      next(error);
    } finally {
      connection.release();
    }
  })
);
// ======================================================
// RETAILER: GET FULL ORDER DETAILS
// GET /api/retailer/orders/:id
// Add BEFORE final 404 handler and app.listen()
// ======================================================

app.get(
  "/api/retailer/orders/:id",
  auth,
  allow("retailer"),
  asyncHandler(async (req, res, next) => {
    try {
      const orderId = Number(req.params.id);
      const retailerId = Number(req.user.id);

      if (!Number.isInteger(orderId) || orderId <= 0) {
        return res.status(400).json({
          message: "Invalid order ID.",
        });
      }

      const orders = await q(
        `
        SELECT
          o.id,
          o.order_no,
          o.retailer_id,
          o.wholesaler_id,
          o.delivery_address,
          o.required_date,
          o.notes,
          o.status,
          o.total_amount,
          o.created_at,
          o.updated_at,

          w.business_name AS wholesaler_name,
          w.name AS wholesaler_contact,
          w.phone AS wholesaler_phone,
          w.email AS wholesaler_email,
          w.location AS wholesaler_location

        FROM purchase_orders o

        INNER JOIN users w
          ON w.id = o.wholesaler_id
          AND w.role = 'wholesaler'

        WHERE o.id = ?
          AND o.retailer_id = ?

        LIMIT 1
        `,
        [orderId, retailerId]
      );

      if (!orders.length) {
        return res.status(404).json({
          message: "Order not found.",
        });
      }

      const order = orders[0];

      const items = await q(
        `
        SELECT
          id,
          order_id,
          product_name,
          quantity,
          unit,
          unit_price,
          notes,

          CASE
            WHEN unit_price IS NULL THEN NULL
            ELSE quantity * unit_price
          END AS line_total

        FROM purchase_order_items

        WHERE order_id = ?

        ORDER BY id ASC
        `,
        [orderId]
      );

      let invoice = null;
      let delivery = null;

      // Invoice lookup — supports your existing purchase-order invoice table
      try {
        const invoiceRows = await q(
          `
          SELECT *
          FROM invoices
          WHERE order_id = ?
            AND retailer_id = ?
          ORDER BY id DESC
          LIMIT 1
          `,
          [orderId, retailerId]
        );

        invoice = invoiceRows[0] || null;
      } catch (invoiceError) {
        // Keep order details usable even if invoice table/columns differ.
        logFailure("RETAILER ORDER INVOICE LOOKUP SKIPPED:", invoiceError.message);
      }

      // Delivery lookup — purchase order delivery records
      try {
        const deliveryRows = await q(
          `
          SELECT *
          FROM wholesale_deliveries
          WHERE order_id = ?
          ORDER BY id DESC
          LIMIT 1
          `,
          [orderId]
        );

        delivery = deliveryRows[0] || null;
      } catch (deliveryError) {
        logFailure("RETAILER ORDER DELIVERY LOOKUP SKIPPED:", deliveryError.message);
      }

      return res.json({
        order,
        items,
        invoice,
        delivery,
      });
    } catch (error) {
      logFailure("LOAD RETAILER ORDER DETAILS ERROR:", error);
      next(error);
    }
  })
);




// ============================================================
// RETAILER INVOICE DETAILS + PAYMENT WORKFLOW
// Add BEFORE your final 404 handler and app.listen()
// Requires: auth, allow(), q(), pool
// Tables:
//   invoices (canonical purchase-order and storefront invoices)
//   purchase_orders
//   purchase_order_items
//   payments
// ============================================================

// ------------------------------------------------------------
// RETAILER: INVOICE DETAILS
// GET /api/retailer/invoices/:id
// ------------------------------------------------------------
app.get(
  "/api/retailer/invoices/:id",
  auth,
  allow("retailer"),
  asyncHandler(async (req, res, next) => {
    try {
      const retailerId = Number(req.user.id);
      const invoiceId = Number(req.params.id);

      if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
        return res.status(400).json({
          message: "Invalid invoice ID.",
        });
      }

      const invoices = await q(
        `
        SELECT
          i.id,
          i.invoice_no,
          i.source_type,
          i.order_id,
          i.catalog_order_id,
          i.wholesaler_id,
          COALESCE(r.name, i.customer_name) AS customer_name,
          COALESCE(r.business_name, i.business_name) AS business_name,
          COALESCE(r.phone, i.customer_phone) AS phone,
          COALESCE(r.email, i.customer_email) AS email,
          i.total_amount,
          i.payment_type,
          i.status AS payment_status,
          i.due_date AS payment_due_date,
          NULL AS paid_at,
          i.status,
          i.created_at,
          NULL AS updated_at,

          COALESCE(po.order_no, co.order_no) AS order_no,
          i.retailer_id,
          COALESCE(po.delivery_address, co.delivery_address) AS delivery_address,
          COALESCE(po.required_date, co.required_date) AS required_date,
          COALESCE(po.notes, co.notes) AS order_notes,
          COALESCE(po.status, co.status) AS order_status,
          i.subtotal,
          i.tax_amount,
          i.total_amount AS order_total_amount,
          po.delivered_at,

          w.business_name AS wholesaler_name,
          w.name AS wholesaler_contact_name,
          w.phone AS wholesaler_phone,
          w.email AS wholesaler_email,
          w.location AS wholesaler_location,
          w.address AS wholesaler_address,
          w.logo_url AS wholesaler_logo_url

        FROM invoices i

        LEFT JOIN purchase_orders po ON po.id = i.order_id
        LEFT JOIN wholesale_catalog_orders co ON co.id = i.catalog_order_id

        LEFT JOIN users r ON r.id = i.retailer_id

        INNER JOIN users w
          ON w.id = i.wholesaler_id
         AND w.role = 'wholesaler'

        WHERE i.id = ?
          AND i.retailer_id = ?

        LIMIT 1
        `,
        [invoiceId, retailerId]
      );

      const invoice = invoices[0];

      if (!invoice) {
        return res.status(404).json({
          message: "Invoice not found.",
        });
      }

      const items = invoice.source_type === "catalog_order"
        ? await q(
        `SELECT id, order_id, product_name, quantity, unit, price AS unit_price,
                NULL AS notes, line_total
         FROM wholesale_catalog_order_items
         WHERE order_id = ? ORDER BY id ASC`,
        [invoice.catalog_order_id]
      ) : await q(
        `
        SELECT
          id,
          order_id,
          product_name,
          quantity,
          unit,
          unit_price,
          notes,
          ROUND(
            COALESCE(quantity, 0) * COALESCE(unit_price, 0),
            2
          ) AS line_total
        FROM purchase_order_items
        WHERE order_id = ?
        ORDER BY id ASC
        `,
        [invoice.order_id]
      );

      const payments = await q(
        `
        SELECT
          id,
          payment_no,
          invoice_id,
          retailer_id,
          wholesaler_id,
          amount,
          method,
          reference_no,
          status,
          paid_at,
          created_at
        FROM payments
        WHERE invoice_id = ?
          AND retailer_id = ?
        ORDER BY id DESC
        `,
        [invoiceId, retailerId]
      );

      const paidAmount = payments.reduce(
        (sum, payment) =>
          payment.status === "paid"
            ? sum + Number(payment.amount || 0)
            : sum,
        0
      );

      const pendingAmount = payments.reduce(
        (sum, payment) =>
          payment.status === "pending"
            ? sum + Number(payment.amount || 0)
            : sum,
        0
      );

      const totalAmount = Number(invoice.total_amount || 0);
      const outstandingAmount = Math.max(
        totalAmount - paidAmount,
        0
      );

      let calculatedPaymentStatus =
        String(invoice.payment_status || "pending").toLowerCase();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dueDate = invoice.payment_due_date
        ? new Date(invoice.payment_due_date)
        : null;

      if (outstandingAmount <= 0 && totalAmount > 0) {
        calculatedPaymentStatus = "paid";
      } else if (paidAmount > 0) {
        calculatedPaymentStatus = "partial";
      } else if (
        dueDate &&
        !Number.isNaN(dueDate.getTime()) &&
        dueDate < today
      ) {
        calculatedPaymentStatus = "overdue";
      } else {
        calculatedPaymentStatus = "pending";
      }

      return res.json({
        invoice: {
          ...invoice,
          paid_amount: Number(paidAmount.toFixed(2)),
          pending_payment_amount: Number(
            pendingAmount.toFixed(2)
          ),
          outstanding_amount: Number(
            outstandingAmount.toFixed(2)
          ),
          calculated_payment_status: calculatedPaymentStatus,
        },
        items,
        payments,
      });
    } catch (error) {
      logFailure("LOAD RETAILER INVOICE DETAILS ERROR:", error);
      next(error);
    }
  })
);

// ------------------------------------------------------------
// RETAILER: SUBMIT PAYMENT FOR VERIFICATION
// POST /api/retailer/invoices/:id/payments
// body:
// {
//   amount: 772,
//   method: "bank_transfer",
//   reference_no: "TRX-123"
// }
// ------------------------------------------------------------
app.post(
  "/api/retailer/invoices/:id/payments",
  auth,
  allow("retailer"),
  asyncHandler(async (req, res, next) => {
    let connection;

    try {
      const retailerId = Number(req.user.id);
      const invoiceId = Number(req.params.id);

      const amount = Number(req.body?.amount);
      const method = String(req.body?.method || "")
        .trim()
        .toLowerCase();

      const referenceNo =
        String(req.body?.reference_no || "")
          .trim()
          .slice(0, 120) || null;
      const idempotencyKey = paymentIdempotencyKey(req.get('Idempotency-Key'));

      const allowedMethods = [
        "cash",
        "bank_transfer",
        "upi",
        "card",
        "credit",
      ];

      if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
        return res.status(400).json({
          message: "Invalid invoice ID.",
        });
      }

      if (!validPaymentAmount(amount)) {
        return res.status(400).json({
          message: "Enter a valid payment amount.",
        });
      }

      if (!allowedMethods.includes(method)) {
        return res.status(400).json({
          message: "Select a valid payment method.",
        });
      }

      if (
        ["bank_transfer", "upi", "card"].includes(method) &&
        !referenceNo
      ) {
        return res.status(400).json({
          message:
            "Payment reference is required for bank transfer, UPI, or card payment.",
        });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [[invoice]] = await connection.query(
        `
        SELECT
          i.id,
          i.invoice_no,
          i.wholesaler_id,
          i.total_amount,
          i.status,
          i.retailer_id
        FROM invoices i
        WHERE i.id = ?
          AND i.retailer_id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [invoiceId, retailerId]
      );

      if (!invoice) {
        await connection.rollback();
        return res.status(404).json({
          message: "Invoice not found.",
        });
      }

      if (invoice.status === "cancelled") {
        await connection.rollback();
        return res.status(409).json({
          message: "Payments cannot be submitted for a cancelled invoice.",
        });
      }

      if (idempotencyKey) {
        const [[existingPayment]] = await connection.query(
          `SELECT id, payment_no, invoice_id, amount, method, reference_no, status
           FROM payments
           WHERE retailer_id = ? AND idempotency_key = ?
           LIMIT 1`,
          [retailerId, idempotencyKey]
        );
        if (existingPayment) {
          const sameRequest = Number(existingPayment.invoice_id) === invoiceId
            && Number(existingPayment.amount) === amount
            && existingPayment.method === method
            && (existingPayment.reference_no || null) === referenceNo;
          await connection.rollback();
          if (!sameRequest) return res.status(409).json({ message: "Idempotency-Key was already used for a different payment." });
          return res.json({ message: "Payment was already submitted.", payment: existingPayment, idempotent_replay: true });
        }
      }

      const [[paymentTotals]] = await connection.query(
        `
        SELECT
          COALESCE(
            SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END),
            0
          ) AS paid_amount,
          COALESCE(
            SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END),
            0
          ) AS pending_amount
        FROM payments
        WHERE invoice_id = ?
          AND retailer_id = ?
        `,
        [invoiceId, retailerId]
      );

      const totalAmount = Number(invoice.total_amount || 0);
      const paidAmount = Number(paymentTotals?.paid_amount || 0);
      const pendingAmount = Number(
        paymentTotals?.pending_amount || 0
      );

      const availableOutstanding = availableInvoiceBalance(
        totalAmount,
        paidAmount,
        pendingAmount
      );

      if (availableOutstanding <= 0) {
        await connection.rollback();
        return res.status(409).json({
          message:
            pendingAmount > 0
              ? "The remaining invoice balance already has a payment awaiting verification."
              : "This invoice has already been fully paid.",
        });
      }

      if (amount > availableOutstanding + 0.001) {
        await connection.rollback();
        return res.status(400).json({
          message: `Payment cannot exceed the available outstanding amount of INR ${availableOutstanding.toFixed(
            2
          )}.`,
        });
      }

      const paymentNo = recordNumber('PAY');

      const [result] = await connection.query(
        `
        INSERT INTO payments
        (
          payment_no,
          invoice_id,
          retailer_id,
          wholesaler_id,
          amount,
          method,
          reference_no,
          idempotency_key,
          status,
          paid_at,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, CURRENT_TIMESTAMP)
        `,
        [
          paymentNo,
          invoiceId,
          retailerId,
          Number(invoice.wholesaler_id),
          amount,
          method,
          referenceNo,
          idempotencyKey,
        ]
      );

      await connection.commit();

      return res.status(201).json({
        message:
          "Payment submitted. It will be reflected in the invoice after wholesaler verification.",
        payment: {
          id: result.insertId,
          payment_no: paymentNo,
          invoice_id: invoiceId,
          amount,
          method,
          reference_no: referenceNo,
          status: "pending",
        },
      });
    } catch (error) {
      if (connection) await connection.rollback();
      logFailure("SUBMIT RETAILER PAYMENT ERROR:", error);
      next(error);
    } finally {
      if (connection) connection.release();
    }
  })
);

// ------------------------------------------------------------
// WHOLESALER: VERIFY / REJECT RETAILER PAYMENT
// PATCH /api/wholesaler/payments/:id/verify
// body: { action: "approve" | "reject" }
// ------------------------------------------------------------
app.patch(
  "/api/wholesaler/payments/:id/verify",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    let connection;

    try {
      const wholesalerId = Number(req.user.id);
      const paymentId = Number(req.params.id);
      const action = String(req.body?.action || "")
        .trim()
        .toLowerCase();

      if (!Number.isInteger(paymentId) || paymentId <= 0) {
        return res.status(400).json({
          message: "Invalid payment ID.",
        });
      }

      if (!["approve", "reject"].includes(action)) {
        return res.status(400).json({
          message: "Action must be approve or reject.",
        });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [[payment]] = await connection.query(
        `
        SELECT *
        FROM payments
        WHERE id = ?
          AND wholesaler_id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [paymentId, wholesalerId]
      );

      if (!payment) {
        await connection.rollback();
        return res.status(404).json({
          message: "Payment not found.",
        });
      }

      if (payment.status !== "pending") {
        await connection.rollback();
        return res.status(409).json({
          message: "This payment has already been processed.",
        });
      }

      const [[invoice]] = await connection.query(
        `
        SELECT id, total_amount, status
        FROM invoices
        WHERE id = ?
          AND wholesaler_id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [payment.invoice_id, wholesalerId]
      );

      if (!invoice) {
        await connection.rollback();
        return res.status(409).json({
          message: "Payment is not attached to a valid invoice.",
        });
      }

      if (invoice.status === "cancelled" && action === "approve") {
        await connection.rollback();
        return res.status(409).json({
          message: "Payments cannot be approved for a cancelled invoice.",
        });
      }

      const nextPaymentStatus =
        action === "approve" ? "paid" : "failed";

      await connection.query(
        `
        UPDATE payments
        SET
          status = ?,
          paid_at = CASE WHEN ? = 'paid' THEN CURRENT_TIMESTAMP ELSE NULL END
        WHERE id = ?
          AND wholesaler_id = ?
        `,
        [nextPaymentStatus, nextPaymentStatus, paymentId, wholesalerId]
      );

      {
        const [[totals]] = await connection.query(
          `
          SELECT
            COALESCE(
              SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END),
              0
            ) AS paid_amount
          FROM payments
          WHERE invoice_id = ?
          `,
          [invoice.id]
        );

        const paidAmount = Number(totals?.paid_amount || 0);
        const invoiceTotal = Number(invoice.total_amount || 0);

        const nextInvoice = invoiceState(
          invoiceTotal,
          paidAmount,
          invoice.status
        );

        await connection.query(
          `
          UPDATE invoices
          SET
            paid_amount = ?,
            status = ?
          WHERE id = ?
            AND wholesaler_id = ?
          `,
          [
            nextInvoice.paidAmount,
            nextInvoice.status,
            invoice.id,
            wholesalerId,
          ]
        );
      }

      await connection.commit();

      return res.json({
        message:
          action === "approve"
            ? "Payment verified successfully."
            : "Payment rejected.",
        payment_id: paymentId,
        status: nextPaymentStatus,
      });
    } catch (error) {
      if (connection) await connection.rollback();
      logFailure("VERIFY PAYMENT ERROR:", error);
      next(error);
    } finally {
      if (connection) connection.release();
    }
  })
);

// ============================================================
// RETAILER: SEARCH VERIFIED WHOLESALERS
// GET /api/retailer/wholesalers/search?q=
// ============================================================

app.get(
  "/api/retailer/wholesalers/search",
  auth,
  allow("retailer"),
  asyncHandler(async (req, res, next) => {
    try {
      const retailerId = Number(req.user.id);
      const search = String(req.query.q || "").trim();

      const like = `%${search}%`;

      const wholesalers = await q(
        `
        SELECT
          u.id,
          u.business_name,
          u.name,
          u.phone,
          u.email,
          u.location,
          u.address,
          u.logo_url,
          u.business_category,
          u.shop_type,
          u.description,

          wr.id AS connection_id,
          wr.status AS connection_status,
          wr.requested_by,
          wr.request_message,
          wr.created_at AS requested_at,
          wr.responded_at

        FROM users u

        LEFT JOIN wholesaler_retailers wr
          ON wr.wholesaler_id = u.id
         AND wr.retailer_id = ?

        WHERE u.role = 'wholesaler'
          AND u.status = 'active' AND u.role = 'wholesaler' AND u.verification_status = 'verified'

          AND (
            ? = ''
            OR u.business_name LIKE ?
            OR u.name LIKE ?
            OR u.location LIKE ?
            OR u.business_category LIKE ?
            OR u.shop_type LIKE ?
          )

        ORDER BY
          CASE
            WHEN wr.status = 'active' THEN 0
            WHEN wr.status = 'pending' THEN 1
            ELSE 2
          END,
          u.business_name ASC

        LIMIT 100
        `,
        [
          retailerId,
          search,
          like,
          like,
          like,
          like,
          like,
        ]
      );

      return res.json({
        wholesalers,
      });
    } catch (error) {
      logFailure("SEARCH RETAILER WHOLESALERS ERROR:", error);

      next(error);
    }
  })
);
// ============================================================
// RETAILER: SEND CONNECTION REQUEST
// POST /api/retailer/wholesalers/:id/request
// ============================================================

app.post(
  "/api/retailer/wholesalers/:id/request",
  auth,
  allow("retailer"),
  asyncHandler(async (req, res, next) => {
    const connection = await pool.getConnection();

    try {
      const retailerId = Number(req.user.id);
      const wholesalerId = Number(req.params.id);

      const message =
        String(req.body?.message || "")
          .trim()
          .slice(0, 500) || null;

      if (
        !Number.isInteger(wholesalerId) ||
        wholesalerId <= 0
      ) {
        return res.status(400).json({
          message: "Invalid wholesaler.",
        });
      }

      await connection.beginTransaction();

      const [[wholesaler]] = await connection.query(
        `
        SELECT
          id,
          business_name
        FROM users
        WHERE id = ?
          AND role = 'wholesaler'
          AND status = 'active' AND verification_status = 'verified'
        LIMIT 1
        FOR UPDATE
        `,
        [wholesalerId]
      );

      if (!wholesaler) {
        await connection.rollback();

        return res.status(404).json({
          message: "Wholesaler not found.",
        });
      }

      const [[existing]] = await connection.query(
        `
        SELECT
          id,
          status
        FROM wholesaler_retailers
        WHERE wholesaler_id = ?
          AND retailer_id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [
          wholesalerId,
          retailerId,
        ]
      );

      if (existing?.status === "active") {
        await connection.rollback();

        return res.status(409).json({
          message:
            "You are already connected with this wholesaler.",
        });
      }

      if (existing?.status === "pending") {
        await connection.rollback();

        return res.status(409).json({
          message:
            "Connection request is already pending.",
        });
      }

      let connectionId;

      if (existing) {
        await connection.query(
          `
          UPDATE wholesaler_retailers
          SET
            status = 'pending',
            requested_by = 'retailer',
            request_message = ?,
            source = 'retailer_request',
            responded_at = NULL,
            created_at = CURRENT_TIMESTAMP
          WHERE id = ?
          `,
          [
            message,
            existing.id,
          ]
        );

        connectionId = existing.id;
      } else {
        const [result] = await connection.query(
          `
          INSERT INTO wholesaler_retailers
          (
            wholesaler_id,
            retailer_id,
            source,
            credit_limit,
            payment_terms,
            notes,
            status,
            requested_by,
            request_message,
            responded_at,
            created_at
          )
          VALUES
          (
            ?,
            ?,
            'retailer_request',
            0,
            'Cash / immediate',
            NULL,
            'pending',
            'retailer',
            ?,
            NULL,
            CURRENT_TIMESTAMP
          )
          `,
          [
            wholesalerId,
            retailerId,
            message,
          ]
        );

        connectionId = result.insertId;
      }

      await connection.commit();

      return res.status(201).json({
        message:
          "Connection request sent successfully.",
        connection_id: connectionId,
        status: "pending",
      });
    } catch (error) {
      await connection.rollback();

      logFailure("SEND WHOLESALER CONNECTION REQUEST ERROR:", error);

      next(error);
    } finally {
      connection.release();
    }
  })
);
// ============================================================
// RETAILER: VIEW WHOLESALER CONNECTION REQUESTS
// GET /api/retailer/wholesaler-requests
// ============================================================

app.get(
  "/api/retailer/wholesaler-requests",
  auth,
  allow("retailer"),
  asyncHandler(async (req, res, next) => {
    try {
      const retailerId = Number(req.user.id);

      const requests = await q(
        `
        SELECT
          wr.id AS connection_id,
          wr.wholesaler_id,
          wr.status,
          wr.requested_by,
          wr.request_message,
          wr.created_at AS requested_at,
          wr.responded_at,

          u.business_name,
          u.name,
          u.phone,
          u.email,
          u.location,
          u.logo_url,
          u.business_category,
          u.shop_type

        FROM wholesaler_retailers wr

        INNER JOIN users u
          ON u.id = wr.wholesaler_id
         AND u.role = 'wholesaler'

        WHERE wr.retailer_id = ?
          AND u.status = 'active'
          AND u.verification_status = 'verified'

        ORDER BY wr.created_at DESC
        `,
        [retailerId]
      );

      return res.json({
        requests,
      });
    } catch (error) {
      logFailure("LOAD RETAILER WHOLESALER REQUESTS ERROR:", error);

      next(error);
    }
  })
);
// ============================================================
// RETAILER: CANCEL PENDING CONNECTION REQUEST
// DELETE /api/retailer/wholesaler-requests/:id
// ============================================================

app.delete(
  "/api/retailer/wholesaler-requests/:id",
  auth,
  allow("retailer"),
  asyncHandler(async (req, res, next) => {
    try {
      const retailerId = Number(req.user.id);
      const connectionId = Number(req.params.id);

      if (
        !Number.isInteger(connectionId) ||
        connectionId <= 0
      ) {
        return res.status(400).json({
          message: "Invalid connection request ID.",
        });
      }

      const result = await q(
        `
        DELETE FROM wholesaler_retailers
        WHERE id = ?
          AND retailer_id = ?
          AND status = 'pending'
          AND requested_by = 'retailer'
        `,
        [
          connectionId,
          retailerId,
        ]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          message:
            "Pending connection request not found.",
        });
      }

      return res.json({
        message: "Connection request cancelled.",
      });
    } catch (error) {
      logFailure("CANCEL WHOLESALER REQUEST ERROR:", error);

      next(error);
    }
  })
);

// ============================================================
// WHOLESALER: VIEW PENDING RETAILER CONNECTION REQUESTS
// GET /api/wholesaler/retailer-requests
// ============================================================

app.get(
  "/api/wholesaler/retailer-requests",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const wholesalerId = Number(req.user.id);

      const requests = await q(
        `
        SELECT
          wr.id AS connection_id,
          wr.retailer_id,
          wr.status,
          wr.requested_by,
          wr.request_message,
          wr.created_at AS requested_at,

          u.business_name,
          u.name,
          u.phone,
          u.email,
          u.location,
          u.address,
          u.logo_url,
          u.business_category,
          u.shop_type

        FROM wholesaler_retailers wr

        INNER JOIN users u
          ON u.id = wr.retailer_id
         AND u.role = 'retailer'

        WHERE wr.wholesaler_id = ?
          AND wr.status = 'pending'
          AND wr.requested_by = 'retailer'

        ORDER BY wr.created_at DESC
        `,
        [wholesalerId]
      );

      return res.json({ requests });
    } catch (error) {
      logFailure("LOAD WHOLESALER RETAILER REQUESTS ERROR:", error);
      next(error);
    }
  })
);

// ============================================================
// WHOLESALER: ACCEPT OR REJECT RETAILER CONNECTION REQUEST
// PATCH /api/wholesaler/retailer-requests/:id
// body: { action: "accept" | "reject" }
// ============================================================

app.patch(
  "/api/wholesaler/retailer-requests/:id",
  auth,
  allow("wholesaler"),
  asyncHandler(async (req, res, next) => {
    try {
      const wholesalerId = Number(req.user.id);
      const connectionId = Number(req.params.id);
      const action = String(req.body?.action || "").trim().toLowerCase();

      if (!Number.isInteger(connectionId) || connectionId <= 0) {
        return res.status(400).json({
          message: "Invalid connection request ID.",
        });
      }

      if (!["accept", "reject"].includes(action)) {
        return res.status(400).json({
          message: "Action must be accept or reject.",
        });
      }

      const nextStatus = action === "accept" ? "active" : "rejected";
      const result = await q(
        `
        UPDATE wholesaler_retailers
        SET
          status = ?,
          responded_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND wholesaler_id = ?
          AND status = 'pending'
          AND requested_by = 'retailer'
        `,
        [nextStatus, connectionId, wholesalerId]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          message: "Pending retailer request not found.",
        });
      }

      return res.json({
        message:
          action === "accept"
            ? "Retailer connection request accepted."
            : "Retailer connection request rejected.",
        connection_id: connectionId,
        status: nextStatus,
      });
    } catch (error) {
      logFailure("UPDATE WHOLESALER RETAILER REQUEST ERROR:", error);
      next(error);
    }
  })
);

// ============================================================
// PUBLIC B2B MARKETPLACE
// Browse verified wholesalers, categories and products.
// No login is required for discovery. Existing catalog storefront
// and authenticated retailer connection-request routes remain unchanged.
// ============================================================

const MARKETPLACE_CATEGORIES = [
  "Grocery & FMCG",
  "Food & Beverage",
  "Pharmacy & Medical",
  "Restaurant Supplies",
  "Hotel Supplies",
  "Building Materials",
  "Construction",
  "Industrial",
  "Electronics",
  "Automotive",
  "Fashion & Apparel",
  "Office Supplies",
  "Cleaning & Hygiene",
  "Packaging",
  "Other",
];

function mergeMarketplaceCategories(rows = []) {
  const counts = new Map(
    rows.map((row) => [
      String(row.name || "").trim(),
      {
        product_count: Number(row.product_count || 0),
        wholesaler_count: Number(row.wholesaler_count || 0),
      },
    ])
  );

  const known = MARKETPLACE_CATEGORIES.map((name) => ({
    name,
    product_count: counts.get(name)?.product_count || 0,
    wholesaler_count: counts.get(name)?.wholesaler_count || 0,
  }));

  const extras = rows
    .filter(
      (row) =>
        row?.name &&
        !MARKETPLACE_CATEGORIES.includes(
          String(row.name).trim()
        )
    )
    .map((row) => ({
      name: String(row.name).trim(),
      product_count: Number(row.product_count || 0),
      wholesaler_count: Number(row.wholesaler_count || 0),
    }));

  return [...known, ...extras];
}

function marketplaceLimit(value, fallback = 12, maximum = 48) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function marketplaceOffset(page, limit) {
  const parsed = Number(page);
  const safePage = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  return { page: safePage, offset: (safePage - 1) * limit };
}

const MARKETPLACE_WHOLESALER_SELECT = `
  SELECT
    u.id,
    u.business_name,
    u.name,
    u.location,
    u.business_category,
    u.shop_type,
    u.description,
    u.website,
    u.logo_url,
    u.created_at,
    c.id AS catalog_id,
    c.slug AS catalog_slug,
    c.catalog_title,
    c.catalog_description,
    c.cover_image_url,
    COALESCE(ps.product_count, 0) AS product_count,
    COALESCE(ps.category_count, 0) AS category_count,
    COALESCE(os.order_count, 0) AS order_count,
    COALESCE(os.order_value, 0) AS order_value
  FROM users u
  INNER JOIN wholesale_catalogs c
    ON c.wholesaler_id = u.id
   AND c.is_published = 1
  LEFT JOIN (
    SELECT
      wholesaler_id,
      COUNT(*) AS product_count,
      COUNT(DISTINCT category_name) AS category_count
    FROM wholesale_products
    WHERE is_active = 1
    GROUP BY wholesaler_id
  ) ps ON ps.wholesaler_id = u.id
  LEFT JOIN (
    SELECT
      wholesaler_id,
      COUNT(*) AS order_count,
      COALESCE(SUM(total_amount), 0) AS order_value
    FROM wholesale_catalog_orders
    WHERE status <> 'cancelled'
    GROUP BY wholesaler_id
  ) os ON os.wholesaler_id = u.id
  WHERE u.role = 'wholesaler'
    AND u.status = 'active' AND u.role = 'wholesaler' AND u.verification_status = 'verified'
`;

// Marketplace homepage data in one request.
app.get(
  "/api/public/marketplace/home",
  asyncHandler(async (_req, res, next) => {
    try {
      await ensureMarketplaceCatalogsForApprovedWholesalers();
      const [categoryRows, featured, trending, newest, popularProducts, stats] =
        await Promise.all([
          q(`
            SELECT
              category_name AS name,
              COUNT(*) AS product_count,
              COUNT(DISTINCT wholesaler_id) AS wholesaler_count
            FROM wholesale_products
            WHERE is_active = 1
              AND category_name IS NOT NULL
              AND TRIM(category_name) <> ''
            GROUP BY category_name
            ORDER BY wholesaler_count DESC, product_count DESC, category_name ASC
            LIMIT 12
          `),
          q(`${MARKETPLACE_WHOLESALER_SELECT}
            ORDER BY
              COALESCE(os.order_count, 0) DESC,
              COALESCE(ps.product_count, 0) DESC,
              u.business_name ASC
            LIMIT 8
          `),
          q(`${MARKETPLACE_WHOLESALER_SELECT}
            ORDER BY
              COALESCE(os.order_count, 0) DESC,
              COALESCE(os.order_value, 0) DESC,
              c.updated_at DESC
            LIMIT 8
          `),
          q(`${MARKETPLACE_WHOLESALER_SELECT}
            ORDER BY u.created_at DESC, u.id DESC
            LIMIT 8
          `),
          q(`
            SELECT
              p.id,
              p.wholesaler_id,
              p.name,
              p.brand,
              p.category_name,
              p.description,
              p.image_url,
              p.unit,
              p.pack_size,
              p.minimum_order,
              p.price_mode,
              p.price,
              p.compare_price,
              p.stock_quantity,
              u.business_name,
              u.logo_url AS wholesaler_logo_url,
              u.location,
              c.slug AS catalog_slug
            FROM wholesale_products p
            INNER JOIN users u
              ON u.id = p.wholesaler_id
             AND u.role = 'wholesaler'
             AND u.status = 'active' AND u.role = 'wholesaler' AND u.verification_status = 'verified'
            INNER JOIN wholesale_catalogs c
              ON c.wholesaler_id = p.wholesaler_id
             AND c.is_published = 1
            WHERE p.is_active = 1
            ORDER BY p.updated_at DESC, p.id DESC
            LIMIT 12
          `),
          q(`
            SELECT
              (SELECT COUNT(*)
                 FROM users u
                 INNER JOIN wholesale_catalogs c
                   ON c.wholesaler_id = u.id AND c.is_published = 1
                WHERE u.role = 'wholesaler' AND u.status = 'active' AND u.role = 'wholesaler' AND u.verification_status = 'verified') AS wholesalers,
              (SELECT COUNT(*)
                 FROM wholesale_products p
                 INNER JOIN users u ON u.id = p.wholesaler_id
                 INNER JOIN wholesale_catalogs c
                   ON c.wholesaler_id = p.wholesaler_id AND c.is_published = 1
                WHERE p.is_active = 1
                  AND u.role = 'wholesaler'
                  AND u.status = 'active' AND u.role = 'wholesaler' AND u.verification_status = 'verified') AS products,
              (SELECT COUNT(DISTINCT p.category_name)
                 FROM wholesale_products p
                 INNER JOIN users u ON u.id = p.wholesaler_id
                WHERE p.is_active = 1
                  AND u.role = 'wholesaler'
                  AND u.status = 'active' AND u.role = 'wholesaler' AND u.verification_status = 'verified'
                  AND p.category_name IS NOT NULL
                  AND TRIM(p.category_name) <> '') AS categories
          `),
        ]);

      const categories =
        mergeMarketplaceCategories(categoryRows);

      return res.json({
        stats: stats[0] || { wholesalers: 0, products: 0, categories: 0 },
        categories,
        featured_wholesalers: featured,
        trending_wholesalers: trending,
        new_wholesalers: newest,
        popular_products: popularProducts,
      });
    } catch (error) {
      logFailure("LOAD PUBLIC MARKETPLACE HOME ERROR:", error);
      next(error);
    }
  })
);

// Search/browse published wholesaler storefronts.
app.get(
  "/api/public/marketplace/wholesalers",
  asyncHandler(async (req, res, next) => {
    try {
      await ensureMarketplaceCatalogsForApprovedWholesalers();
      const search = String(req.query.q || "").trim();
      const category = String(req.query.category || "").trim();
      const location = String(req.query.location || "").trim();
      const sort = String(req.query.sort || "featured").toLowerCase();
      const limit = marketplaceLimit(req.query.limit, 12, 48);
      const { page, offset } = marketplaceOffset(req.query.page, limit);

      const searchLike = `%${search}%`;
      const categoryLike = `%${category}%`;
      const locationLike = `%${location}%`;

      const filters = `
        AND (
          ? = ''
          OR u.business_name LIKE ?
          OR u.name LIKE ?
          OR u.description LIKE ?
          OR u.business_category LIKE ?
          OR u.shop_type LIKE ?
          OR u.location LIKE ?
          OR EXISTS (
            SELECT 1
            FROM wholesale_products sp
            WHERE sp.wholesaler_id = u.id
              AND sp.is_active = 1
              AND (
                sp.name LIKE ?
                OR sp.brand LIKE ?
                OR sp.category_name LIKE ?
              )
          )
        )
        AND (? = '' OR u.business_category LIKE ? OR EXISTS (
          SELECT 1
          FROM wholesale_products cp
          WHERE cp.wholesaler_id = u.id
            AND cp.is_active = 1
            AND cp.category_name LIKE ?
        ))
        AND (? = '' OR u.location LIKE ?)
      `;

      const params = [
        search,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        category,
        categoryLike,
        categoryLike,
        location,
        locationLike,
      ];

      const orderBy = {
        newest: "u.created_at DESC, u.id DESC",
        name: "u.business_name ASC",
        products: "COALESCE(ps.product_count, 0) DESC, u.business_name ASC",
        trending: "COALESCE(os.order_count, 0) DESC, COALESCE(os.order_value, 0) DESC",
        featured: "COALESCE(os.order_count, 0) DESC, COALESCE(ps.product_count, 0) DESC, u.business_name ASC",
      }[sort] || "COALESCE(os.order_count, 0) DESC, COALESCE(ps.product_count, 0) DESC, u.business_name ASC";

      const wholesalers = await q(
        `${MARKETPLACE_WHOLESALER_SELECT}
         ${filters}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      const [countRow] = await q(
        `SELECT COUNT(*) AS total
         FROM users u
         INNER JOIN wholesale_catalogs c
           ON c.wholesaler_id = u.id
          AND c.is_published = 1
         WHERE u.role = 'wholesaler'
           AND u.status = 'active' AND u.role = 'wholesaler' AND u.verification_status = 'verified'
         ${filters}`,
        params
      );

      const total = Number(countRow?.total || 0);

      return res.json({
        wholesalers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
        filters: { q: search, category, location, sort },
      });
    } catch (error) {
      logFailure("SEARCH PUBLIC MARKETPLACE WHOLESALERS ERROR:", error);
      next(error);
    }
  })
);

// Categories used by marketplace navigation/filter chips.
app.get(
  "/api/public/marketplace/categories",
  asyncHandler(async (_req, res, next) => {
    try {
      const categoryRows = await q(`
        SELECT
          p.category_name AS name,
          COUNT(*) AS product_count,
          COUNT(DISTINCT p.wholesaler_id) AS wholesaler_count
        FROM wholesale_products p
        INNER JOIN users u
          ON u.id = p.wholesaler_id
         AND u.role = 'wholesaler'
         AND u.status = 'active' AND u.role = 'wholesaler' AND u.verification_status = 'verified'
        INNER JOIN wholesale_catalogs c
          ON c.wholesaler_id = p.wholesaler_id
         AND c.is_published = 1
        WHERE p.is_active = 1
          AND p.category_name IS NOT NULL
          AND TRIM(p.category_name) <> ''
        GROUP BY p.category_name
        ORDER BY wholesaler_count DESC, product_count DESC, p.category_name ASC
      `);

      const categories = mergeMarketplaceCategories(categoryRows);

      return res.json({ categories });
    } catch (error) {
      logFailure("LOAD PUBLIC MARKETPLACE CATEGORIES ERROR:", error);
      next(error);
    }
  })
);

// Search products across all published wholesaler catalogs.
app.get(
  "/api/public/marketplace/products",
  asyncHandler(async (req, res, next) => {
    try {
      const search = String(req.query.q || "").trim();
      const category = String(req.query.category || "").trim();
      const limit = marketplaceLimit(req.query.limit, 24, 48);
      const { page, offset } = marketplaceOffset(req.query.page, limit);
      const like = `%${search}%`;
      const categoryLike = `%${category}%`;

      const products = await q(
        `SELECT
           p.id,
           p.wholesaler_id,
           p.name,
           p.sku,
           p.brand,
           p.category_name,
           p.description,
           p.image_url,
           p.unit,
           p.pack_size,
           p.minimum_order,
           p.price_mode,
           p.price,
           p.compare_price,
           p.stock_quantity,
           u.business_name,
           u.logo_url AS wholesaler_logo_url,
           u.location,
           c.slug AS catalog_slug
         FROM wholesale_products p
         INNER JOIN users u
           ON u.id = p.wholesaler_id
          AND u.role = 'wholesaler'
          AND u.status = 'active' AND u.role = 'wholesaler' AND u.verification_status = 'verified'
         INNER JOIN wholesale_catalogs c
           ON c.wholesaler_id = p.wholesaler_id
          AND c.is_published = 1
         WHERE p.is_active = 1
           AND (
             ? = ''
             OR p.name LIKE ?
             OR p.brand LIKE ?
             OR p.category_name LIKE ?
             OR u.business_name LIKE ?
           )
           AND (? = '' OR p.category_name LIKE ?)
         ORDER BY p.updated_at DESC, p.id DESC
         LIMIT ? OFFSET ?`,
        [
          search,
          like,
          like,
          like,
          like,
          category,
          categoryLike,
          limit,
          offset,
        ]
      );

      return res.json({
        products,
        pagination: { page, limit },
        filters: { q: search, category },
      });
    } catch (error) {
      logFailure("SEARCH PUBLIC MARKETPLACE PRODUCTS ERROR:", error);
      next(error);
    }
  })
);

app.get('/api/ready', asyncHandler(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, release: releaseId });
}));
app.use((req, res) => res.status(404).json({ message: 'Endpoint not found', request_id: req.requestId }));
app.use(errorHandler);
