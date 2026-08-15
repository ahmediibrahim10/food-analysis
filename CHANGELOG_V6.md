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
