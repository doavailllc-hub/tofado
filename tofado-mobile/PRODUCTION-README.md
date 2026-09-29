# Tofado Merchant Mobile — Production Final

This is a full replacement for Stage 1 / Stage 2.

## Retailer
- Login / secure session
- Home dashboard
- Connected wholesalers
- Find/search wholesalers
- Connection requests
- Create purchase order
- Multiple product items
- My Orders
- Order details + invoice/delivery status
- Invoice list
- Invoice detail
- Payment history
- Submit payment for wholesaler verification
- Profile / logout

## Wholesaler
- Home dashboard
- Retailer orders
- Order status workflow
- Connected retailers
- Retailer connection requests
- Accept / reject retailer
- Deliveries
- Packed / dispatched / delivered updates
- Product catalog list
- Invoice list
- Payment list
- Business profile / logout

## Android Expo Go

1. Extract this ZIP and use it as the whole mobile project.
2. Do not replace merchant-client or merchant-server.
3. Create `.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.57:5000/api
```

Use your current PC IPv4 address if it changes.

4. Install:

```powershell
npm install
npx expo install --fix
```

5. Backend:

```powershell
cd D:\tofado-production\merchant-server
npm run dev
```

6. Mobile:

```powershell
cd D:\tofado-production\tofado-merchant-mobile
npm start
```

7. Scan QR in Expo Go.

## Production API later

```env
EXPO_PUBLIC_API_URL=https://api.tofado.com/api
```

## Backend note
If your current backend does not have:
- GET /api/wholesaler/retailer-requests
- PATCH /api/wholesaler/retailer-requests/:id

copy the routes from BACKEND_REQUIRED_PATCH.txt into index.js before the final 404 handler/app.listen.

Never put AWS, MySQL, JWT, or other server secrets in this mobile app.
