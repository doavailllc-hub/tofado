# Tofado Merchant Landing Website

Google-inspired B2B SaaS marketing website built with React and Vite.

## Run locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Configure merchant application links

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set:

```env
VITE_MERCHANT_APP_URL=https://merchant.tofado.com/login
```

For local development:

```env
VITE_MERCHANT_APP_URL=http://localhost:5173/login
```

## Replace the sample logo

Replace:

```text
src/assets/tofado-logo.svg
```

with your real logo file, then update imports in:

```text
src/components/Navbar.jsx
src/components/Footer.jsx
```

## Build

```bash
npm run build
```

Production files are generated in:

```text
dist/
```
