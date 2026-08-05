// server/src/routes/profileRoutes.js
import crypto from "node:crypto";
import path from "node:path";

import express from "express";
import multer from "multer";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import pool from "../config/db.js";
import auth from "../middleware/auth.js";

const router = express.Router();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(file.mimetype)) {
      callback(new Error("Only JPG, PNG, and WEBP images are allowed."));
      return;
    }

    callback(null, true);
  },
});

function getPublicS3Url(key) {
  if (process.env.S3_PUBLIC_BASE_URL) {
    return `${process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  }

  return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

function getS3KeyFromUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
}

router.get("/", auth, async (request, response) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         id,
         name,
         business_name,
         email,
         phone,
         location,
         address,
         tax_number,
         business_category,
         shop_type,
         description,
         website,
         logo_url,
         role,
         status,
         created_at,
         updated_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [request.user.id]
    );

    if (!rows.length) {
      return response.status(404).json({
        message: "Profile not found.",
      });
    }

    return response.json(rows[0]);
  } catch (error) {
    console.error("GET /profile failed:", error);

    return response.status(500).json({
      message: "Unable to load business profile.",
    });
  }
});

router.put("/", auth, async (request, response) => {
  try {
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
    } = request.body;

    if (
      !name?.trim() ||
      !business_name?.trim() ||
      !phone?.trim() ||
      !location?.trim() ||
      !business_category ||
      !shop_type
    ) {
      return response.status(400).json({
        message:
          "Contact name, business name, phone, location, category, and shop type are required.",
      });
    }

    await pool.query(
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
        phone.trim(),
        location.trim(),
        address.trim(),
        tax_number.trim(),
        business_category,
        shop_type,
        description.trim(),
        website.trim(),
        request.user.id,
      ]
    );

    const [rows] = await pool.query(
      `SELECT
         id,
         name,
         business_name,
         email,
         phone,
         location,
         address,
         tax_number,
         business_category,
         shop_type,
         description,
         website,
         logo_url,
         role,
         status,
         created_at,
         updated_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [request.user.id]
    );

    return response.json(rows[0]);
  } catch (error) {
    console.error("PUT /profile failed:", error);

    return response.status(500).json({
      message: "Unable to update business profile.",
    });
  }
});

router.post(
  "/logo",
  auth,
  upload.single("logo"),
  async (request, response) => {
    try {
      if (!request.file) {
        return response.status(400).json({
          message: "Select a logo image.",
        });
      }

      const [rows] = await pool.query(
        "SELECT logo_url FROM users WHERE id = ? LIMIT 1",
        [request.user.id]
      );

      if (!rows.length) {
        return response.status(404).json({
          message: "Profile not found.",
        });
      }

      const extension =
        path.extname(request.file.originalname).toLowerCase() ||
        `.${request.file.mimetype.split("/")[1]}`;

      const key = `merchant-logos/${request.user.id}/${crypto.randomUUID()}${extension}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: request.file.buffer,
          ContentType: request.file.mimetype,
          CacheControl: "public, max-age=31536000, immutable",
        })
      );

      const logoUrl = getPublicS3Url(key);
      const previousKey = getS3KeyFromUrl(rows[0].logo_url);

      await pool.query(
        `UPDATE users
         SET logo_url = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [logoUrl, request.user.id]
      );

      if (previousKey && previousKey.startsWith("merchant-logos/")) {
        s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: previousKey,
          })
        ).catch((error) => {
          console.error("Unable to delete previous logo:", error);
        });
      }

      return response.status(201).json({
        message: "Business logo uploaded successfully.",
        logo_url: logoUrl,
      });
    } catch (error) {
      console.error("POST /profile/logo failed:", error);

      return response.status(500).json({
        message: "Unable to upload business logo.",
      });
    }
  }
);

router.delete("/logo", auth, async (request, response) => {
  try {
    const [rows] = await pool.query(
      "SELECT logo_url FROM users WHERE id = ? LIMIT 1",
      [request.user.id]
    );

    if (!rows.length) {
      return response.status(404).json({
        message: "Profile not found.",
      });
    }

    const key = getS3KeyFromUrl(rows[0].logo_url);

    await pool.query(
      `UPDATE users
       SET logo_url = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [request.user.id]
    );

    if (key && key.startsWith("merchant-logos/")) {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
        })
      );
    }

    return response.json({
      message: "Business logo removed.",
    });
  } catch (error) {
    console.error("DELETE /profile/logo failed:", error);

    return response.status(500).json({
      message: "Unable to remove business logo.",
    });
  }
});

router.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    return response.status(400).json({
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Logo must be smaller than 5 MB."
          : error.message,
    });
  }

  return response.status(400).json({
    message: error.message || "Invalid upload.",
  });
});

export default router;
