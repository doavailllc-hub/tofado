# Tofado Merchant Mobile — Production Redesign

This project is an Expo React Native application for Android, iOS, tablets, and web.

## Run

```bash
npm install
npx expo start
```

Press `a` for Android, `i` for iOS on macOS, or scan the QR code with Expo Go.

## API URL

Set the backend in `.env`:

```env
EXPO_PUBLIC_API_URL=https://your-domain.com/api
```

For an Android emulator calling a backend on the same PC, use:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api
```

## Production verification completed

- Expo Doctor: 21/21 checks passed
- Android Metro/Hermes production bundle: passed
- Existing authentication, retailer, wholesaler, order, invoice, payment, delivery, catalog, profile, and partner API flows preserved
- Native safe areas and role-based bottom navigation preserved
- Reusable button, field, skeleton, error, empty-state, and error-boundary components added
- App icon configuration corrected for Android and iOS requirements

## Build

```bash
npx expo prebuild
npx expo run:android
```

For an installable production build, use your configured EAS/Android signing workflow.
