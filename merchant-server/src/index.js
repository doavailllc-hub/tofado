import crypto from "node:crypto";
import path from "node:path";

import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import multer from "multer";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import "dotenv/config";
import { pool } from "./db.js";
import { auth, allow } from "./middleware/auth.js";
import {
  hashPassword,
  verifyPassword,
} from "./utils/password.js";
const app = express(); app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || '*' })); app.use(express.json({ limit: '1mb' }));
const q = async (sql, p = []) => {
  const [rows] = await pool.query(sql, p);
  return rows;
};

const sign = (user) =>
  jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "7d" }
  );

const s3 = new S3Client({
  region: process.env.AWS_REGION,
});

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
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

  if (
    body.website &&
    !/^https?:\/\/.+/i.test(String(body.website).trim())
  ) {
    return "Website must start with http:// or https://.";
  }

  return "";
}
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'tofado-merchant-api' }));
app.post('/api/applications', async (req, res, next) => { try { const { role, name, business_name, email, phone, location, address, tax_number, license_number, password } = req.body; if (!['retailer', 'wholesaler'].includes(role)) return res.status(400).json({ message: 'Invalid business type' }); if (!name || !business_name || !email || !phone || !location || !address || !password) return res.status(400).json({ message: 'Complete all required fields' }); const ex = await q('SELECT id FROM users WHERE email=? UNION SELECT id FROM merchant_applications WHERE email=?', [email, email]); if (ex.length) return res.status(409).json({ message: 'Email already registered or under review' }); const hash = hashPassword(password); await q('INSERT INTO merchant_applications(role,name,business_name,email,phone,location,address,tax_number,license_number,password_hash,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)', [role, name, business_name, email, phone, location, address, tax_number || null, license_number || null, hash, 'pending']); res.status(201).json({ message: 'Verification request submitted' }) } catch (e) { next(e) } });
app.post('/api/auth/login', async (req, res, next) => { try { const rows = await q('SELECT * FROM users WHERE email=? LIMIT 1', [req.body.email]); const u = rows[0]; if (!u || u.status !== 'active' || !verifyPassword(req.body.password || '', u.password_hash)) return res.status(401).json({ message: 'Invalid credentials or account not approved' }); const user = {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      business_name: u.business_name,
      location: u.location,
      logo_url: u.logo_url || null,
      business_category: u.business_category || null,
      shop_type: u.shop_type || null,
    }; res.json({ token: sign(user), user }) } catch (e) { next(e) } });
app.get('/api/auth/me', auth, async (req, res) => { const [u] = await q('SELECT id,name,email,role,business_name,phone,location,business_category,shop_type,logo_url,status FROM users WHERE id=?', [req.user.id]); res.json(u) });
app.get("/api/profile", auth, async (req, res, next) => {
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
});

app.put("/api/profile", auth, async (req, res, next) => {
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
        phone.trim(),
        location.trim(),
        address.trim(),
        tax_number.trim(),
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
});

app.post(
  "/api/profile/logo",
  auth,
  logoUpload.single("logo"),
  async (req, res, next) => {
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
          console.error(
            "Unable to delete previous merchant logo:",
            deleteError
          );
        });
      }

      return res.status(201).json({
        message: "Business logo uploaded successfully.",
        logo_url: logoUrl,
      });
    } catch (error) {
      next(error);
    }
  }
);

app.delete(
  "/api/profile/logo",
  auth,
  async (req, res, next) => {
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
  }
);
app.get('/api/retailer/wholesalers', auth, allow('retailer'), async (req, res) => res.json(await q("SELECT id,business_name,location,phone FROM users WHERE role='wholesaler' AND status='active' ORDER BY business_name")));
app.post('/api/retailer/orders', auth, allow('retailer'), async (req, res, next) => { const c = await pool.getConnection(); try { const { wholesaler_id, delivery_address, required_date, notes, items } = req.body; if (!wholesaler_id || !delivery_address || !Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Wholesaler, delivery address and items are required' }); await c.beginTransaction(); const orderNo = `PO-${Date.now().toString().slice(-8)}`; const [r] = await c.query('INSERT INTO purchase_orders(order_no,retailer_id,wholesaler_id,delivery_address,required_date,notes,status,total_amount) VALUES(?,?,?,?,?,?,?,0)', [orderNo, req.user.id, wholesaler_id, delivery_address, required_date || null, notes || null, 'pending']); for (const i of items) await c.query('INSERT INTO purchase_order_items(order_id,product_name,quantity,unit,notes) VALUES(?,?,?,?,?)', [r.insertId, i.product_name, Number(i.quantity), i.unit, i.notes || null]); await c.commit(); res.status(201).json({ id: r.insertId, order_no: orderNo }) } catch (e) { await c.rollback(); next(e) } finally { c.release() } });
app.get('/api/retailer/orders', auth, allow('retailer'), async (req, res) => res.json(await q(`SELECT o.id,o.order_no,w.business_name wholesaler_name,o.created_at,o.status,o.total_amount FROM purchase_orders o JOIN users w ON w.id=o.wholesaler_id WHERE o.retailer_id=? ORDER BY o.id DESC`, [req.user.id])));
app.get('/api/retailer/invoices', auth, allow('retailer'), async (req, res) => res.json(await q(`SELECT i.id,i.invoice_no,w.business_name wholesaler_name,o.order_no,i.total_amount,i.paid_amount,i.due_date,i.status FROM invoices i JOIN purchase_orders o ON o.id=i.order_id JOIN users w ON w.id=i.wholesaler_id WHERE i.retailer_id=? ORDER BY i.id DESC`, [req.user.id])));
app.get('/api/retailer/dashboard', auth, allow('retailer'), async (req, res) => { const [s] = await q(`SELECT COUNT(*) total_orders,SUM(status='pending') pending_orders,COALESCE(SUM(total_amount),0) purchase_value FROM purchase_orders WHERE retailer_id=?`, [req.user.id]); const [inv] = await q(`SELECT COALESCE(SUM(total_amount-paid_amount),0) outstanding FROM invoices WHERE retailer_id=?`, [req.user.id]); const recent = await q(`SELECT o.id,o.order_no,w.business_name,o.created_at,o.status,o.total_amount FROM purchase_orders o JOIN users w ON w.id=o.wholesaler_id WHERE o.retailer_id=? ORDER BY o.id DESC LIMIT 8`, [req.user.id]); res.json({ stats: { total_orders: s.total_orders, pending_orders: s.pending_orders, purchase_value: `SAR ${Number(s.purchase_value).toFixed(2)}`, outstanding: `SAR ${Number(inv.outstanding).toFixed(2)}` }, recent }) });
app.get('/api/wholesaler/orders', auth, allow('wholesaler'), async (req, res) => res.json(await q(`SELECT o.id,o.order_no,r.business_name retailer_name,o.created_at,o.required_date,o.status,o.total_amount FROM purchase_orders o JOIN users r ON r.id=o.retailer_id WHERE o.wholesaler_id=? ORDER BY o.id DESC`, [req.user.id])));
app.patch('/api/wholesaler/orders/:id/status', auth, allow('wholesaler'), async (req, res) => { const allowed = ['pending', 'confirmed', 'packed', 'dispatched', 'delivered', 'cancelled']; if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'Invalid status' }); await q('UPDATE purchase_orders SET status=?, delivered_at=IF(?="delivered",NOW(),delivered_at) WHERE id=? AND wholesaler_id=?', [req.body.status, req.body.status, req.params.id, req.user.id]); res.json({ message: 'Updated' }) });
app.get('/api/wholesaler/invoices', auth, allow('wholesaler'), async (req, res) => res.json(await q(`SELECT i.id,i.invoice_no,r.business_name retailer_name,o.order_no,i.total_amount,i.paid_amount,i.due_date,i.status FROM invoices i JOIN users r ON r.id=i.retailer_id JOIN purchase_orders o ON o.id=i.order_id WHERE i.wholesaler_id=? ORDER BY i.id DESC`, [req.user.id])));
app.get('/api/wholesaler/payments', auth, allow('wholesaler'), async (req, res) => res.json(await q(`SELECT p.id,p.payment_no,r.business_name retailer_name,i.invoice_no,p.amount,p.method,p.paid_at,p.status FROM payments p JOIN invoices i ON i.id=p.invoice_id JOIN users r ON r.id=p.retailer_id WHERE p.wholesaler_id=? ORDER BY p.id DESC`, [req.user.id])));
app.get('/api/wholesaler/dashboard', auth, allow('wholesaler'), async (req, res) => { const [s] = await q(`SELECT COUNT(*) total_orders,SUM(status='pending') pending_orders,SUM(status='delivered') delivered_orders,COUNT(DISTINCT retailer_id) retailers FROM purchase_orders WHERE wholesaler_id=?`, [req.user.id]); const [i] = await q(`SELECT COALESCE(SUM(total_amount-paid_amount),0) outstanding FROM invoices WHERE wholesaler_id=?`, [req.user.id]); const recent = await q(`SELECT o.id,o.order_no,r.business_name,o.created_at,o.status,o.total_amount FROM purchase_orders o JOIN users r ON r.id=o.retailer_id WHERE o.wholesaler_id=? ORDER BY o.id DESC LIMIT 8`, [req.user.id]); res.json({ stats: { total_orders: s.total_orders, pending_orders: s.pending_orders, delivered_orders: s.delivered_orders, retailers: s.retailers, outstanding: `SAR ${Number(i.outstanding).toFixed(2)}` }, recent }) });
app.get('/api/admin/applications', auth, allow('admin'), async (req, res) => res.json(await q('SELECT id,role,name,business_name,email,phone,location,address,tax_number,license_number,status,created_at FROM merchant_applications ORDER BY id DESC')));
app.patch('/api/admin/applications/:id', auth, allow('admin'), async (req, res, next) => { const c = await pool.getConnection(); try { const status = req.body.status; if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status' }); await c.beginTransaction(); const [[a]] = await c.query('SELECT * FROM merchant_applications WHERE id=? FOR UPDATE', [req.params.id]); if (!a) return res.status(404).json({ message: 'Request not found' }); if (a.status !== 'pending') return res.status(409).json({ message: 'Already processed' }); if (status === 'approved') await c.query('INSERT INTO users(role,name,business_name,email,phone,location,address,tax_number,license_number,password_hash,status,verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,NOW())', [a.role, a.name, a.business_name, a.email, a.phone, a.location, a.address, a.tax_number, a.license_number, a.password_hash, 'active']); await c.query('UPDATE merchant_applications SET status=?,reviewed_by=?,reviewed_at=NOW() WHERE id=?', [status, req.user.id, req.params.id]); await c.commit(); res.json({ message: status }) } catch (e) { await c.rollback(); next(e) } finally { c.release() } });
app.get('/api/admin/users', auth, allow('admin'), async (req, res) => res.json(await q("SELECT id,business_name,role,name,phone,location,status,created_at FROM users WHERE role!='admin' ORDER BY id DESC")));
app.get('/api/admin/orders', auth, allow('admin'), async (req, res) => res.json(await q(`SELECT o.id,o.order_no,r.business_name retailer_name,w.business_name wholesaler_name,o.status,o.total_amount,o.created_at FROM purchase_orders o JOIN users r ON r.id=o.retailer_id JOIN users w ON w.id=o.wholesaler_id ORDER BY o.id DESC`)));
app.get('/api/admin/finance', auth, allow('admin'), async (req, res) => res.json(await q(`SELECT i.id,i.invoice_no,r.business_name retailer_name,w.business_name wholesaler_name,i.total_amount,i.paid_amount,i.status,i.due_date FROM invoices i JOIN users r ON r.id=i.retailer_id JOIN users w ON w.id=i.wholesaler_id ORDER BY i.id DESC`)));
app.get('/api/admin/dashboard', auth, allow('admin'), async (req, res) => { const [[u]] = await pool.query(`SELECT SUM(role='retailer') retailers,SUM(role='wholesaler') wholesalers FROM users WHERE status='active'`); const [[a]] = await pool.query(`SELECT COUNT(*) pending_verifications FROM merchant_applications WHERE status='pending'`); const [[o]] = await pool.query(`SELECT COUNT(*) total_orders,COALESCE(SUM(total_amount),0) order_value FROM purchase_orders`); const recent = await q(`SELECT o.id,o.order_no,CONCAT(r.business_name,' → ',w.business_name) business_name,o.created_at,o.status,o.total_amount FROM purchase_orders o JOIN users r ON r.id=o.retailer_id JOIN users w ON w.id=o.wholesaler_id ORDER BY o.id DESC LIMIT 8`); res.json({ stats: { retailers: u.retailers || 0, wholesalers: u.wholesalers || 0, pending_verifications: a.pending_verifications, total_orders: o.total_orders, order_value: `SAR ${Number(o.order_value).toFixed(2)}` }, recent }) });


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

app.get(
  "/api/wholesaler/catalog",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
      console.error(
        "LOAD WHOLESALER CATALOG ERROR:",
        error
      );

      next(error);
    }
  }
);
// Get products belonging to the logged-in wholesaler
app.get(
  "/api/wholesaler/catalog/products",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
  }
);

// Upload product image to S3
app.post(
  "/api/wholesaler/catalog/product-image",
  auth,
  allow("wholesaler"),
  productImageUpload.single("image"),
  async (req, res) => {
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
      console.error("PRODUCT IMAGE UPLOAD ERROR:", {
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
  }
);
// Create a wholesaler product
app.post(
  "/api/wholesaler/catalog/products",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
        price = 0,
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

      const productPrice = Number(price);

      if (!Number.isFinite(productPrice) || productPrice < 0) {
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
          price,
          compare_price,
          stock_quantity,
          low_stock_level,
          is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  }
);
// Get one product
app.get(
  "/api/wholesaler/catalog/products/:id",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
  }
);

// Update product
app.put(
  "/api/wholesaler/catalog/products/:id",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
        price = 0,
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
          Math.max(0, Number(price || 0)),
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
  }
);
// ======================================================
// UPDATE PRODUCT PUBLISH STATUS
// PATCH /api/wholesaler/catalog/products/:id/status
// ======================================================

app.patch(
  "/api/wholesaler/catalog/products/:id/status",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
        LIMIT 1
        `,
        [productId, wholesalerId]
      );

      return res.json(product);
    } catch (error) {
      console.error(
        "UPDATE PRODUCT STATUS ERROR:",
        error
      );

      next(error);
    }
  }
);
// Delete product
app.delete(
  "/api/wholesaler/catalog/products/:id",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
          console.error(
            "Unable to delete product image:",
            error
          );
        });
      }

      return res.json({
        message: "Product deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  }
);
// ======================================================
// PUBLIC CATALOG STOREFRONT
// GET /api/public/catalog/:slug
// ======================================================

app.get(
  "/api/public/catalog/:slug",
  async (req, res, next) => {
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
      console.error(
        "LOAD PUBLIC CATALOG ERROR:",
        error
      );

      next(error);
    }
  }
);
// Public catalog storefront
app.get(
  "/api/catalog/:slug",
  async (req, res, next) => {
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
           AND u.status = 'active'
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
  }
);
// Public catalog storefront
app.get(
  "/api/catalog/:slug",
  async (req, res, next) => {
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
           AND u.status = 'active'
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
        ...catalog,
        products,
      });
    } catch (error) {
      next(error);
    }
  }
);
app.post(
  "/api/public/catalog/:slug/orders",
  async (req, res, next) => {
    const connection = await pool.getConnection();

    try {
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
           AND u.status = 'active'
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          orderNo,
          catalog.id,
          catalog.wholesaler_id,
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
  }
);
app.patch(
  "/api/wholesaler/catalog/orders/:id/status",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
    try {
      const allowedStatuses = [
        "pending",
        "confirmed",
        "packed",
        "dispatched",
        "delivered",
        "cancelled",
      ];

      if (!allowedStatuses.includes(req.body.status)) {
        return res.status(400).json({
          message: "Invalid order status.",
        });
      }

      const result = await q(
        `UPDATE wholesale_catalog_orders
         SET status = ?
         WHERE id = ?
           AND wholesaler_id = ?`,
        [
          req.body.status,
          req.params.id,
          req.user.id,
        ]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          message: "Catalog order not found.",
        });
      }

      return res.json({
        message: "Order status updated.",
      });
    } catch (error) {
      next(error);
    }
  }
);
// Get public catalog orders for logged-in wholesaler
app.get(
  "/api/wholesaler/catalog/orders",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
  }
);
app.patch(
  "/api/wholesaler/catalog/orders/:id/status",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
    try {
      const allowedStatuses = [
        "pending",
        "confirmed",
        "packed",
        "dispatched",
        "delivered",
        "cancelled",
      ];

      const status = String(req.body.status || "").toLowerCase();

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          message: "Invalid catalog order status.",
        });
      }

      const result = await q(
        `UPDATE wholesale_catalog_orders
         SET
           status = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND wholesaler_id = ?`,
        [status, req.params.id, req.user.id]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          message: "Catalog order not found.",
        });
      }

      return res.json({
        message: "Catalog order status updated.",
      });
    } catch (error) {
      next(error);
    }
  }
);
app.get(
  "/api/wholesaler/catalog/orders",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
    try {
      const [orders] = await pool.query(`
        SELECT *
        FROM catalog_orders
        ORDER BY created_at DESC
      `);

      res.json(orders);
    } catch (err) {
      next(err);
    }
  }
);
// Get one catalog order with products, invoice, payment and delivery
app.get(
  "/api/wholesaler/catalog/orders/:id",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
           i.status AS invoice_status,
           i.payment_type,
           i.payment_status,
           i.payment_due_date,
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

         LEFT JOIN wholesale_catalog_invoices i
           ON i.order_id = o.id

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
  }
);
// Update catalog-order payment terms
app.patch(
  "/api/wholesaler/catalog/orders/:id/payment",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
        `UPDATE wholesale_catalog_invoices i
         INNER JOIN wholesale_catalog_orders o
           ON o.id = i.order_id
         SET
           i.payment_type = ?,
           i.payment_due_date = ?,
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
  }
);

// Update catalog-order payment status
app.patch(
  "/api/wholesaler/catalog/orders/:id/payment-status",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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

      const result = await q(
        `UPDATE wholesale_catalog_invoices i
         INNER JOIN wholesale_catalog_orders o
           ON o.id = i.order_id
         SET
           i.payment_status = ?,
           i.paid_at =
             CASE
               WHEN ? = 'paid'
               THEN CURRENT_TIMESTAMP
               ELSE i.paid_at
             END,
           i.updated_at = CURRENT_TIMESTAMP
         WHERE o.id = ?
           AND o.wholesaler_id = ?`,
        [
          paymentStatus,
          paymentStatus,
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
  }
);

// Create or update catalog-order delivery
app.post(
  "/api/wholesaler/catalog/orders/:id/delivery",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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

      if (order.status === "pending") {
        await connection.rollback();

        return res.status(409).json({
          message:
            "Confirm the order before creating delivery.",
        });
      }

      await connection.query(
        `INSERT INTO wholesale_catalog_deliveries
        (
          order_id,
          wholesaler_id,
          delivery_type,
          delivery_notes,
          status
        )
        VALUES (?, ?, ?, ?, 'ready')
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
  }
);
// ======================================================
// WHOLESALER: GET PUBLIC CATALOG ENQUIRIES
// GET /api/wholesaler/catalog/enquiries
// ======================================================

app.get(
  "/api/wholesaler/catalog/enquiries",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
  }
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

app.get(
  "/api/wholesaler/retailers",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
      console.error(
        "LOAD WHOLESALER RETAILERS ERROR:",
        error
      );

      next(error);
    }
  }
);

// ------------------------------------------------------
// CREATE OR CONNECT RETAILER MANUALLY
// POST /api/wholesaler/retailers
// ------------------------------------------------------

app.post(
  "/api/wholesaler/retailers",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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

      let retailerId;
      let temporaryPassword = null;
      let retailerWasCreated = false;

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

        LIMIT 1
        `,
        [
          cleanPhone,
          cleanEmail,
          cleanEmail,
        ]
      );

      const existingRetailer = existingRetailers[0];

      if (existingRetailer) {
        retailerId = existingRetailer.id;

        const [existingConnections] =
          await connection.query(
            `
            SELECT id
            FROM wholesaler_retailers
            WHERE wholesaler_id = ?
              AND retailer_id = ?
            LIMIT 1
            `,
            [wholesalerId, retailerId]
          );

        if (existingConnections.length) {
          await connection.rollback();

          return res.status(409).json({
            message:
              "This retailer is already connected to your business.",
          });
        }

        await connection.query(
          `
          UPDATE users
          SET
            business_name = ?,
            name = ?,
            email = ?,
            phone = ?,
            location = ?,
            address = ?,
            tax_number = ?,
            status = 'active',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND role = 'retailer'
          `,
          [
            cleanBusinessName,
            cleanName,
            cleanEmail || existingRetailer.email,
            cleanPhone,
            cleanLocation,
            cleanAddress || existingRetailer.address,
            cleanTaxNumber || existingRetailer.tax_number,
            retailerId,
          ]
        );
      } else {
        temporaryPassword = crypto
          .randomBytes(6)
          .toString("hex");

        const passwordHash =
          hashPassword(temporaryPassword);

        const [userResult] = await connection.query(
          `
          INSERT INTO users (
            role,
            name,
            business_name,
            email,
            phone,
            location,
            address,
            tax_number,
            password_hash,
            status,
            created_at,
            updated_at
          )
          VALUES (
            'retailer',
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            'active',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          `,
          [
            cleanName,
            cleanBusinessName,
            cleanEmail || null,
            cleanPhone,
            cleanLocation,
            cleanAddress || null,
            cleanTaxNumber || null,
            passwordHash,
          ]
        );

        retailerId = userResult.insertId;
        retailerWasCreated = true;
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
        message: retailerWasCreated
          ? "Retailer created and connected successfully."
          : "Existing retailer connected successfully.",

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

        temporary_password: temporaryPassword,
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error(
            "CREATE RETAILER ROLLBACK ERROR:",
            rollbackError
          );
        }
      }

      if (error?.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          message:
            "This retailer or connection already exists.",
        });
      }

      console.error(
        "CREATE WHOLESALER RETAILER ERROR:",
        error
      );

      next(error);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);
// ======================================================
// GET ONE CONNECTED RETAILER
// GET /api/wholesaler/retailers/:id
// ======================================================

app.get(
  "/api/wholesaler/retailers/:id",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
      console.error(
        "LOAD RETAILER DETAILS ERROR:",
        error
      );

      next(error);
    }
  }
);
// ======================================================
// RETAILER ORDERS
// GET /api/wholesaler/retailers/:id/orders
// ======================================================

app.get(
  "/api/wholesaler/retailers/:id/orders",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
      console.error(
        "LOAD RETAILER ORDERS ERROR:",
        error
      );

      next(error);
    }
  }
);

// ======================================================
// RETAILER INVOICES
// GET /api/wholesaler/retailers/:id/invoices
// ======================================================

app.get(
  "/api/wholesaler/retailers/:id/invoices",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
          i.order_id,
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
      console.error(
        "LOAD RETAILER INVOICES ERROR:",
        error
      );

      next(error);
    }
  }
);

// ======================================================
// RETAILER PAYMENTS
// GET /api/wholesaler/retailers/:id/payments
// ======================================================

app.get(
  "/api/wholesaler/retailers/:id/payments",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
      console.error(
        "LOAD RETAILER PAYMENTS ERROR:",
        error
      );

      next(error);
    }
  }
);
// ======================================================
// GET WHOLESALER DELIVERIES
// GET /api/wholesaler/deliveries
// ======================================================

app.get(
  "/api/wholesaler/deliveries",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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

          po.order_no,
          po.retailer_id,
          po.delivery_address,
          po.required_date,
          po.notes AS order_notes,
          po.total_amount,

          u.business_name,
          u.business_name AS retailer_name,
          u.name AS contact_name,
          u.phone AS contact_phone,
          u.phone AS retailer_phone,
          u.location

        FROM wholesale_catalog_deliveries d

        INNER JOIN purchase_orders po
          ON po.id = d.order_id

        INNER JOIN users u
          ON u.id = po.retailer_id
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
      console.error(
        "LOAD WHOLESALER DELIVERIES ERROR:",
        error
      );

      next(error);
    }
  }
);
// ======================================================
// GET ONE DELIVERY WITH ITEMS
// GET /api/wholesaler/deliveries/:id
// ======================================================

app.get(
  "/api/wholesaler/deliveries/:id",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
    try {
      const wholesalerId = Number(req.user.id);
      const deliveryId = Number(req.params.id);

      if (!deliveryId) {
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
          d.dispatched_at,
          d.delivered_at,
          d.created_at,
          d.updated_at,

          NULL AS packed_at,
          NULL AS ready_at,
          NULL AS out_for_delivery_at,

          po.order_no,
          po.retailer_id,
          po.delivery_address,
          po.required_date,
          po.notes AS order_notes,
          po.subtotal,
          po.tax_amount,
          po.total_amount,

          u.business_name,
          u.business_name AS retailer_name,
          u.name AS contact_name,
          u.phone AS contact_phone,
          u.phone AS retailer_phone,
          u.email AS retailer_email,
          u.location

        FROM wholesale_catalog_deliveries d

        INNER JOIN purchase_orders po
          ON po.id = d.order_id

        INNER JOIN users u
          ON u.id = po.retailer_id
          AND u.role = 'retailer'

        WHERE d.id = ?
          AND d.wholesaler_id = ?

        LIMIT 1
        `,
        [deliveryId, wholesalerId]
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
          poi.id,
          poi.order_id,
          poi.product_name,
          poi.quantity,
          poi.unit,
          poi.unit_price,
          poi.notes

        FROM purchase_order_items poi

        WHERE poi.order_id = ?

        ORDER BY poi.id ASC
        `,
        [delivery.order_id]
      );

      return res.json({
        delivery,
        items,
      });
    } catch (error) {
      console.error(
        "LOAD DELIVERY DETAILS ERROR:",
        error
      );

      next(error);
    }
  }
);
// ======================================================
// GET ONE WHOLESALER INVOICE
// GET /api/wholesaler/invoices/:id
// ======================================================

app.get(
  "/api/wholesaler/invoices/:id",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
          i.order_id,
          i.retailer_id,
          i.wholesaler_id,
          i.subtotal,
          i.tax_amount,
          i.total_amount,
          i.paid_amount,
          i.due_date,
          i.status,
          i.created_at,

          po.order_no,
          po.delivery_address,
          po.required_date,
          po.notes AS order_notes,

          retailer.business_name AS retailer_business_name,
          retailer.name AS retailer_name,
          retailer.email AS retailer_email,
          retailer.phone AS retailer_phone,
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

        INNER JOIN purchase_orders po
          ON po.id = i.order_id

        INNER JOIN users retailer
          ON retailer.id = i.retailer_id
          AND retailer.role = 'retailer'

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

      const items = await q(
        `
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
        [invoiceRow.order_id]
      );

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
          order_id: invoiceRow.order_id,
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
      console.error(
        "LOAD INVOICE DETAILS ERROR:",
        error
      );

      next(error);
    }
  }
);
// ======================================================
// WHOLESALER PAYMENTS MODULE
// Add before your final 404 handler and app.listen().
// Requires existing: app, auth, allow, q, pool.
// ======================================================

// GET /api/wholesaler/payments
app.get(
  "/api/wholesaler/payments",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
    try {
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

          i.invoice_no,
          i.total_amount AS invoice_total,
          i.paid_amount AS invoice_paid_amount,
          i.due_date,
          i.status AS invoice_status,

          u.business_name,
          u.business_name AS retailer_name,
          u.name AS retailer_contact,
          u.phone AS retailer_phone

        FROM payments p

        INNER JOIN invoices i
          ON i.id = p.invoice_id

        INNER JOIN users u
          ON u.id = p.retailer_id
          AND u.role = 'retailer'

        WHERE p.wholesaler_id = ?

        ORDER BY
          COALESCE(p.paid_at, p.created_at) DESC,
          p.id DESC
        `,
        [Number(req.user.id)]
      );

      return res.json({ payments });
    } catch (error) {
      console.error("LOAD WHOLESALER PAYMENTS ERROR:", error);
      next(error);
    }
  }
);

// GET /api/wholesaler/payments/:id
app.get(
  "/api/wholesaler/payments/:id",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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

          retailer.business_name AS retailer_business_name,
          retailer.name AS retailer_name,
          retailer.email AS retailer_email,
          retailer.phone AS retailer_phone,
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

        INNER JOIN users retailer
          ON retailer.id = p.retailer_id
          AND retailer.role = 'retailer'

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
      console.error("LOAD PAYMENT DETAILS ERROR:", error);
      next(error);
    }
  }
);

// POST /api/wholesaler/payments
app.post(
  "/api/wholesaler/payments",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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

      if (!paymentAmount || paymentAmount <= 0) {
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

      const outstanding = Math.max(
        Number(invoice.total_amount || 0) -
        Number(invoice.paid_amount || 0),
        0
      );

      if (paymentAmount > outstanding) {
        await connection.rollback();

        return res.status(400).json({
          message:
            "Payment amount cannot exceed the invoice balance.",
          outstanding,
        });
      }

      const [numberRows] = await connection.query(
        `
        SELECT COALESCE(MAX(id), 0) + 1 AS next_number
        FROM payments
        `
      );

      const paymentNo = `PAY-${String(
        numberRows[0].next_number
      ).padStart(5, "0")}`;

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
        const newPaidAmount =
          Number(invoice.paid_amount || 0) +
          paymentAmount;

        const newInvoiceStatus =
          newPaidAmount >= Number(invoice.total_amount)
            ? "paid"
            : "partial";

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
          console.error(
            "PAYMENT ROLLBACK ERROR:",
            rollbackError
          );
        }
      }

      console.error("RECORD PAYMENT ERROR:", error);
      next(error);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
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
  async (req, res) => {
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
      console.error(
        "CATALOG COVER UPLOAD ERROR:",
        {
          name: error?.name,
          message: error?.message,
          code: error?.Code || error?.code,
          status:
            error?.$metadata?.httpStatusCode,
          resource: error?.Resource,
          stack: error?.stack,
        }
      );

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
  }
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
  async (req, res, next) => {
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
      console.error(
        "UPDATE CATALOG SETTINGS ERROR:",
        error
      );

      next(error);
    }
  }
);
// ======================================================
// REMOVE CATALOG COVER IMAGE
// DELETE /api/wholesaler/catalog/cover-image
// ======================================================

app.delete(
  "/api/wholesaler/catalog/cover-image",
  auth,
  allow("wholesaler"),
  async (req, res, next) => {
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
      console.error(
        "REMOVE CATALOG COVER ERROR:",
        error
      );

      next(error);
    }
  }
);
app.listen(process.env.PORT || 5000, () => console.log(`Tofado API running on ${process.env.PORT || 5000}`));