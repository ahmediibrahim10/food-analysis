# Health OS V10.2 — Production Hardened

Local-first Next.js PWA for personal nutrition, workouts, weight and health tracking.

## What V10.2 hardens

- Egypt + Saudi Arabia treated as one regional food market.
- SFDA → Open Food Facts → USDA → curated/AI fallback strategy.
- Barcode-first lookup without changing the existing iPhone scanner solution.
- Shared SFDA OAuth token cache through Upstash Redis in production.
- Distributed rate limiting through Upstash Redis in production.
- Shared food-result cache through Upstash Redis.
- Same-origin protection for POST APIs.
- Request size validation and safe server errors.
- Secret-free structured provider logs with request IDs.
- Nutrition sanity/quality checks and per-100g normalization.
- Explicit backup migrations from older schemas to V10.
- Workout input validation and derived progression calculated from current records.
- Huawei Health import validation/deduplication at the local-data layer.
- Core tests plus provider/ranking/backup validation.
- Offline-first core data; external databases and AI still require internet.

## Production requirements

In Netlify **Production**, configure these:

```env
GEMINI_API_KEY=...
GEMINI_MODEL=...
USDA_FDC_API_KEY=...
NUTRITION_DATABASE_ENABLED=true

SFDA_ENABLED=true
SFDA_CLIENT_ID=...
SFDA_CLIENT_SECRET=...
SFDA_TOKEN_URL=...
SFDA_FOOD_API_URL=https://apis.sfda.gov.sa:9002/v2/Food

UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

**Upstash Redis is intentionally required in production.** Local in-memory rate limiting/cache is only a development fallback, because serverless instances do not share memory.

Never expose `GEMINI_API_KEY`, `SFDA_CLIENT_SECRET`, or other secrets to the browser. Rotate any credentials previously pasted into chat or logs.

## Verification

```bash
npm install
npm run test:core
npm run typecheck
npm run build
```

For the full local verification:

```bash
npm run verify
```

## Real-world QA checklist

1. Search a real Saudi packaged product by barcode.
2. Search a real Egyptian packaged product by barcode/name.
3. Test SFDA credentials with a real registered product.
4. Turn off network and verify previously cached foods remain available.
5. Create/edit/delete a meal.
6. Create/edit/delete a workout and exercise.
7. Confirm progression changes after editing/deleting a workout.
8. Export a backup, clear data, then restore it.
9. Restore an older backup and confirm migration metadata.
10. Import real Huawei Health JSON/CSV data and confirm duplicate import does not double-count daily check-ins.
11. Test production rate limiting with Redis configured.
12. Review Netlify logs for provider failures; logs intentionally omit secrets, images and request bodies.

## Huawei Health limitation

A web/PWA cannot magically obtain private Huawei Health data just by knowing the account. V10.2 treats Huawei as a validated import/bridge layer. Automatic direct synchronization requires an actual Huawei-supported integration or native companion. The app does not fake direct access.
