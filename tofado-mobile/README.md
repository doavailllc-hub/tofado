# Tofado Merchant Mobile — Stage 1

React Native + Expo mobile foundation built from the supplied Tofado Merchant web/backend project.

## Included now

- Tofado branding/logo from the current web project.
- Same backend authentication: `POST /api/auth/login`.
- Session validation: `GET /api/auth/me`.
- Token stored with Expo SecureStore.
- Automatic role routing.
- Retailer bottom navigation:
  - Home
  - Vendors
  - Orders
  - Invoices
  - Profile
- Wholesaler bottom navigation:
  - Home
  - Orders
  - Retailers
  - Deliveries
  - More
- Live retailer dashboard using `/api/retailer/dashboard`.
- Live wholesaler dashboard using `/api/wholesaler/dashboard`.
- Pull-to-refresh.
- Profile + sign out.
- Production-style loading and API error states.
- Stage placeholders for the next modules.

## Requirements

Expo SDK 57 targets React Native 0.86 / React 19.2.3 and requires Node 22.13+.

## 1. Install

```powershell
cd tofado-merchant-mobile
npm install
npx expo install --fix
```

If Expo asks to align native package versions, accept it.

## 2. Configure API URL

Copy:

```text
.env.example
```

to:

```text
.env
```

### Physical Android/iPhone on same Wi-Fi

Use your PC LAN IP, NOT localhost:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:5000/api
```

Find the Windows PC IP using:

```powershell
ipconfig
```

Look for IPv4 Address.

### Android emulator

You can use:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api
```

### Production

Use:

```env
EXPO_PUBLIC_API_URL=https://api.tofado.com/api
```

## 3. Backend LAN access

Your Express backend must be running:

```powershell
cd D:\tofado-production\merchant-server
npm run dev
```

If your phone cannot connect, ensure Windows Firewall allows Node.js / port 5000 on the private network.

## 4. Start mobile app

```powershell
npm start
```

Then scan the Expo QR code with Expo Go or launch Android/iOS.

## API source mapping

The supplied web project uses:

```text
POST /api/auth/login
GET  /api/auth/me
GET  /api/retailer/dashboard
GET  /api/wholesaler/dashboard
GET  /api/profile
```

The mobile project uses those same APIs.

## Next stages

Stage 2:
Retailer Vendors — connected wholesalers, find/search wholesalers, send request, request status.

Stage 3:
Retailer Orders — new purchase list, order details, quotation, fulfilment timeline.

Stage 4:
Retailer Invoices — invoice details, payment submission/history, print/share.

Stage 5:
Wholesaler Orders + Retailer Requests.

Stage 6:
Wholesaler Catalog + Deliveries + Invoice/Payment verification.

Stage 7:
Push notifications, EAS builds, release configuration, production hardening.

## Security

Do not place MySQL, AWS, JWT, or other server credentials in this mobile project.
Only `EXPO_PUBLIC_API_URL` belongs in the mobile `.env`.


# Stage 1 v2 — Android Expo Go notes

This v2 includes:
- Web-safe token storage fallback.
- Native Android/iOS still uses Expo SecureStore.
- Expo SDK 57 dependency versions aligned to the expected React Native / native module versions.

## Android phone with Expo Go

1. Connect the Windows PC and Android phone to the same Wi-Fi.
2. Start the Tofado backend on the PC:

```powershell
cd D:\tofado-production\merchant-server
npm run dev
```

3. Find the PC IPv4 address:

```powershell
ipconfig
```

Example:

```text
192.168.1.57
```

4. In the mobile project create `.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.57:5000/api
```

Do NOT use localhost on the Android phone.

5. Install and align packages:

```powershell
npm install
npx expo install --fix
```

6. Start Expo:

```powershell
npm start
```

7. Open Expo Go on Android and scan the QR code.

## If the phone cannot reach the API

Test this URL in Chrome on the Android phone:

```text
http://192.168.1.57:5000/api/auth/me
```

A `401 Authentication required` response is good because it proves the phone can reach the backend.

If it cannot connect:
- allow Node.js through Windows Defender Firewall on Private networks,
- confirm both devices are on the same Wi-Fi,
- confirm the backend is still running on port 5000.

## Production API later

```env
EXPO_PUBLIC_API_URL=https://api.tofado.com/api
```


# Stage 2 — Retailer Vendor Network

Stage 2 adds a fully functional retailer wholesaler network:

- Vendor tab home.
- Connected wholesalers from `GET /api/retailer/wholesalers`.
- Search verified wholesalers using `GET /api/retailer/wholesalers/search`.
- Send connection request using `POST /api/retailer/wholesalers/:id/request`.
- Request history using `GET /api/retailer/wholesaler-requests`.
- Cancel pending request using `DELETE /api/retailer/wholesaler-requests/:id`.
- Connected / Pending / Rejected status badges.
- Connected wholesaler can be selected for the Stage 3 purchase-order builder.
- Pull-to-refresh and production error/empty states.

Required backend routes must already exist in the web backend.

## Test Stage 2

1. Login to Expo Go as a retailer.
2. Tap Vendors.
3. Tap Find wholesalers.
4. Search and send a connection request.
5. Login to the web app as the wholesaler and accept the retailer.
6. Return to the mobile app and pull to refresh.
7. The wholesaler should appear in Connected wholesalers.
8. Tap Create purchase order to confirm the selected wholesaler flows into Stage 3.
