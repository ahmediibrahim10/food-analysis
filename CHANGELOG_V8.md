# Health OS V8

- Unified Egypt + Saudi food discovery into one regional experience.
- SFDA barcode lookup now targets the documented `/product/barcode/{barcode}` endpoint before generic sources.
- Regional search runs SFDA + Open Food Facts (Egypt/Saudi) + USDA with source priority and deduplication.
- Kept the existing iPhone barcode camera implementation unchanged.
- Local food cache remains the fast path for previously resolved barcodes.
- Backup version bumped to V8 and destructive clear now includes cached food products.
- Nutrition/meal planner, favorites, Huawei local import, health score, progression, and bilingual UI retained.
