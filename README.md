# Tofado Merchant

A complete B2B grocery procurement MVP for verified retail shops and wholesale dealers.

## Main workflows

- Retailer or wholesaler submits a verification request.
- Admin reviews and approves/rejects the business.
- Approved retailers create grocery purchase lists and send them to verified wholesalers.
- Wholesalers manage retailers, orders, delivery states, invoices and payment records.
- Admin monitors merchants, orders and finance.

## Technology

- Frontend: React, Vite, React Router, Axios, Lucide icons
- Backend: Node.js, Express, JWT authentication
- Database: MySQL 8+
- Password security: Node.js scrypt with per-user salt

## Setup

### 1. Create database

```bash
mysql -u root -p < database/schema.sql
```

### 2. Configure backend

```bash
cd server
cp .env.example .env
```

Edit `.env` with your MySQL details and a strong JWT secret.

### 3. Install and run

From the project root:

```bash
npm install
npm run install:all
npm run dev
```

Frontend: http://localhost:5173  
API: http://localhost:5000/api

## Demo accounts

- Admin: `admin@tofado.com` / `Admin@123`
- Retailer: `retailer@tofado.com` / `Retailer@123`
- Wholesaler: `wholesaler@tofado.com` / `Wholesale@123`

## Production notes

Before production, add file upload storage for license documents, email/SMS approval messages, invoice PDF generation, audit logs, rate limiting, backups, HTTPS, payment gateway integration, and strict accounting/tax validation for the deployment country.
