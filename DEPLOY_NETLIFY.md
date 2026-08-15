# Netlify deployment

Set these environment variables in Netlify (Project configuration → Environment variables):

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `USDA_FDC_API_KEY`
- `NUTRITION_DATABASE_ENABLED=true`

Do not use `NEXT_PUBLIC_` for API keys. After changing environment variables, trigger a new deploy.

Build command: `npm run build`

The app does not require a Hugging Face Transformers package. The AI food scanner uses the server-side Gemini route and the nutrition resolver uses USDA/Open Food Facts.
