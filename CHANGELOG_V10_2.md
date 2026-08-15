# V10.2 — Production Hardening

- Production now requires Upstash Redis for distributed rate limiting and shared cache.
- SFDA OAuth token cache is shared through Redis.
- Added same-origin checks and post-parse body-size validation.
- Added safe structured provider logging with request IDs.
- Removed strict Open Food Facts country filtering; Egypt/Saudi are now relevance boosts.
- Added regional food ranking helper and tests.
- Added explicit backup row migrations to V10 schema.
- Added optional live integration smoke tests.
- Preserved the existing iPhone barcode solution and all V10 features.
- Added production environment template and QA checklist.
