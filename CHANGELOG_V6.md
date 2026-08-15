# Health OS Changelog

## V6.3.0
- Replaced native-only barcode detection with ZXing browser camera scanning for iPhone/Safari compatibility.
- Added barcode normalization variants (UPC/EAN 12/13/14 digit forms).
- Added Middle East-aware Open Food Facts result labeling and Arabic product-name preference.
- Added barcode-not-found fallback to AI nutrition-label scanning.

# Health OS V6

## Huawei Health local bridge
- Replaced Apple Health import with a Huawei Health-oriented local sync center.
- Import JSON or CSV exports containing `date`, `type`, and `value` (or compatible aliases).
- Supported metrics: steps, sleep, water.
- Latest sync metadata is stored locally in IndexedDB.
- App refreshes local Huawei data on every open.
- No Huawei approval, App Store publishing, or cloud health database is required.

## Important platform limitation
A normal iPhone PWA cannot silently read Huawei Health's private app storage in the background. Therefore this version does **not** pretend to offer direct background Huawei sync. The bridge is intentionally local and permanent: you import/export the data source, and Health OS owns the normalized local copy.

## Workout progression
- Added progression insights based on completed workouts.
- Best load/reps per exercise are detected.
- Suggestions encourage small, conservative progression while preserving form.

## V6.2 — iPhone & Egyptian Arabic polish
- Added consistent Egyptian Arabic translations for remaining visible UI labels.
- Localized meal-type selectors and scanner actions.
- Added dynamic document language/direction for better iOS accessibility.
- Added iPhone safe-area support for the notch/home indicator.
- Increased touch targets for mobile controls.
- Prevented iOS input zoom by using mobile-safe form font sizes.
- Improved food-photo preview sizing so images are not unnecessarily cropped.
- Improved barcode camera sizing on small screens.
- Improved modal and bottom-navigation behavior on narrow iPhone screens.

## V6.4.0 — Stability & TypeScript cleanup
- Fixed `MiniChart` language prop error (`Cannot find name 'lang'`).
- Passed `lang` explicitly into chart rendering so Egyptian Arabic/English empty states remain localized.
- Kept ZXing barcode scanning and Middle East lookup flow from V6.3.
- Prepared the release for a clean TypeScript/production build.

## V6.4.0 — Stability, i18n & iPhone polish
- Fixed the `MiniChart` TypeScript error by passing `lang` explicitly.
- Localized remaining user-facing chart, scanner, image, and workout strings in Egyptian Arabic.
- Kept ZXing barcode scanning and Middle East product lookup from V6.3.
- Preserved local-first storage, Gemini food analysis, USDA/Open Food Facts lookup, Huawei Health import, workouts, progress, PWA, and bilingual UI.
