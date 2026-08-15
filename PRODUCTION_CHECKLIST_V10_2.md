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
