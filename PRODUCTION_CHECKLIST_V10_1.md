# Production checklist

1. Set GEMINI_API_KEY, USDA_FDC_API_KEY and SFDA credentials in Netlify environment variables.
2. Rotate any API keys previously exposed in chat/logs.
3. Configure Upstash REST URL/token for distributed rate limiting/cache.
4. Run `npm run test:core`.
5. Run `npm run typecheck`.
6. Run `npm run build`.
7. Test a real Saudi barcode and an Egyptian packaged product.
8. Test offline mode and cached food.
9. Test workout create/edit/delete and program edit/delete.
10. Test backup from an older version and restore into V10.1.
11. Verify Huawei Health import with real exported data on the target phone.
12. Monitor Netlify logs for provider errors without logging secrets or image payloads.
