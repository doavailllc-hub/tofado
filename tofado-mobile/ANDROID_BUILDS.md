# Android Studio builds

Open the `android` folder in Android Studio and allow Gradle sync to finish.

Use **Build > Select Build Variant** to choose one of these variants:

- `retailerDebug` — Tofado Retailer (`com.tofado.app`)
- `wholesalerDebug` — Tofado Wholesaler (`com.tofado.business`)

Select a connected device or emulator and press **Run** to debug. Both apps have
different application IDs, so they can remain installed together.

## App bundles

From the project root, build both Android App Bundles with:

```powershell
npm run aab:all
```

The output files are:

- `android/app/build/outputs/bundle/retailerRelease/app-retailer-release.aab`
- `android/app/build/outputs/bundle/wholesalerRelease/app-wholesaler-release.aab`

Release builds require TOFADO_UPLOAD_STORE_FILE (absolute path), TOFADO_UPLOAD_STORE_PASSWORD, TOFADO_UPLOAD_KEY_ALIAS and TOFADO_UPLOAD_KEY_PASSWORD in the environment. They fail if signing is absent; there is no debug fallback.

Use the existing upload identity for published apps. If the apps use different upload keys, build each flavor separately with its matching environment. Keep keys/passwords in a secret manager.

Run npm test for shared session regression tests. JS export does not validate native signing; install and test both signed flavors before release.
