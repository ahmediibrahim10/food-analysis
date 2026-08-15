# V10 — Stability & Production

- Added server-side rate limiting for AI/food/nutrition endpoints.
- Added request timeouts and safer server error messages.
- Added SFDA OAuth token caching and expiry handling.
- Added short-lived server cache for food search responses.
- Added nutrition sanity/quality validation.
- Added strict workout validation for names, dates, sets, reps, weights and calories.
- Backup exports are version 9 and imports reject future versions while accepting older schemas.
- Added core automated tests.
- Added an online/offline status banner.
- Kept the existing iPhone barcode solution untouched.
