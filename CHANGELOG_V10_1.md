# Health OS V10.1 — Hardening

- Added optional Upstash distributed rate limiting and shared response cache.
- Added request IDs and safer API error responses.
- Added request-size guards for AI/nutrition endpoints.
- Staged food provider search to reduce unnecessary API calls.
- Kept SFDA-first barcode strategy and cached SFDA OAuth token.
- Strengthened nutrition macro/calorie consistency checks.
- Strengthened workout input bounds.
- Added backup version 10 migration metadata.
- Added regression test for backup migration.
- No barcode/Safari scanner implementation was changed.

## Production environment

For multi-instance Netlify production, configure:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Without them, development/local memory limiting remains active; shared cache is disabled.
