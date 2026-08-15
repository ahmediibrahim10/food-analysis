# Health OS V5 — Smart Personal Health OS

Local-first Next.js PWA designed for personal use on iPhone.

## Included
- Gemini food photo scanner + database nutrition resolver.
- USDA FoodData Central + Open Food Facts search/barcode.
- Egyptian Arabic + English UI with RTL.
- Local IndexedDB storage with Dexie.
- Personalized BMR/TDEE + cut/maintain/bulk calorie and macro targets.
- Daily health score + smart rule-based recommendations.
- Meal planner based on remaining calories/protein and local staples.
- Workout logging, exercises, PR/best-set hints, and reusable programs.
- Weight trend and 7/30-day reports.
- JSON backup restore + CSV meal export.
- Apple Health XML import for weight, steps and sleep records.
- Offline-first core logging; AI/database search still need internet.
- No analytics, ads, or cloud health database.

## Environment
Create `.env.local`:

```env
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=your_working_gemini_model
USDA_FDC_API_KEY=your_usda_data_gov_key
NUTRITION_DATABASE_ENABLED=true
```

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and on iPhone use **Add to Home Screen**.

## Apple Health limitation
A browser/PWA cannot directly access HealthKit. V5 therefore supports importing the extracted `export.xml` from an Apple Health export. Native HealthKit sync would require an iOS native companion/wrapper and is intentionally not faked as a web capability.

## Nutrition accuracy
Gemini identifies food and estimates portion size. When a strong reference match exists, nutrition is recalculated from the database per 100g. Composite dishes and ambiguous matches remain estimates and should be reviewed before saving.
