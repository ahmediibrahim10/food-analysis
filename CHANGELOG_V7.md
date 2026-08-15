# Health OS V7.0 — Regional Barcode Engine

- Multi-path barcode scanning: live camera, barcode photo, and manual entry.
- ZXing browser camera/image decoding fallback.
- Saudi/Gulf/North Africa market selector for product lookup.
- Open Food Facts v3 barcode lookup with country/language localization.
- GTIN/EAN/UPC normalization variants.
- Local IndexedDB product cache: products found once are reused offline.
- Local product cache included in backup/restore.
- Arabic/Egyptian UI additions for barcode flows.
- Huawei Health remains the supported health-data bridge.

- V7.2: narrowed regional focus to Saudi Arabia and Egypt.
- V7.2: added country-targeted remote Open Food Facts queries.
- V7.2: added optional server-side SFDA official registered-food adapter for Saudi barcode/keyword lookups.
- V7.2: kept regional product data remote-first; no giant product catalog is bundled into the PWA.
