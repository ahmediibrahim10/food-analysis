import { pipeline } from "@huggingface/transformers";

const MODEL = "HuggingFaceTB/SmolVLM-256M-Instruct";

let foodPipeline: any = null;

function hasWebGPU() {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export async function analyzeFoodImage(imageUrl: string) {
  if (!foodPipeline) {
    foodPipeline = await pipeline("image-text-to-text", MODEL, {
      device: hasWebGPU() ? "webgpu" : "wasm",
      dtype: hasWebGPU() ? "q4" : "q4"
    });
  }

  const prompt = `
You are a food logging assistant. Analyze the meal photo.
Return ONLY valid JSON, no markdown and no extra text.

Schema:
{
  "name": "short meal name",
  "items": [
    {
      "name": "food item",
      "estimated_grams": number,
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "confidence": number
    }
  ],
  "total": {
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number
  }
}

Rules:
- Estimate visible portions conservatively.
- If exact grams cannot be known from the image, make it an estimate.
- Do not invent hidden ingredients.
- Treat calories and macros as estimates, not medical measurements.
`;

  const messages = [{
    role: "user",
    content: [
      { type: "image", image: imageUrl },
      { type: "text", text: prompt }
    ]
  }];

  const output = await foodPipeline(messages, {
    max_new_tokens: 420,
    return_full_text: false
  });

  const raw = Array.isArray(output)
    ? output[0]?.generated_text ?? ""
    : String(output ?? "");

  return parseFoodJSON(raw);
}

function parseFoodJSON(raw: string) {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("The AI returned an unreadable result. Please try another photo.");
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  const total = parsed.total ?? {};

  return {
    name: String(parsed.name || "Scanned meal"),
    items: Array.isArray(parsed.items) ? parsed.items : [],
    calories: Math.max(0, Number(total.calories) || 0),
    protein: Math.max(0, Number(total.protein_g) || 0),
    carbs: Math.max(0, Number(total.carbs_g) || 0),
    fat: Math.max(0, Number(total.fat_g) || 0)
  };
}
