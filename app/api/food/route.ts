
import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const foodSchema={type:Type.OBJECT,properties:{name:{type:Type.STRING},items:{type:Type.ARRAY,items:{type:Type.OBJECT,properties:{name:{type:Type.STRING},estimated_grams:{type:Type.NUMBER},calories:{type:Type.NUMBER},protein_g:{type:Type.NUMBER},carbs_g:{type:Type.NUMBER},fat_g:{type:Type.NUMBER},identification_confidence:{type:Type.NUMBER},portion_confidence:{type:Type.NUMBER},nutrition_confidence:{type:Type.NUMBER}},required:["name","estimated_grams","calories","protein_g","carbs_g","fat_g","identification_confidence","portion_confidence","nutrition_confidence"]}},total:{type:Type.OBJECT,properties:{calories:{type:Type.NUMBER},protein_g:{type:Type.NUMBER},carbs_g:{type:Type.NUMBER},fat_g:{type:Type.NUMBER}},required:["calories","protein_g","carbs_g","fat_g"]}},required:["name","items","total"]};

export async function POST(request:Request){
 try{
  const apiKey=process.env.GEMINI_API_KEY;if(!apiKey)return NextResponse.json({error:"GEMINI_API_KEY is missing. Add it to .env.local."},{status:500});
  const body=await request.json();const imageDataUrl=String(body?.imageDataUrl||"");if(!imageDataUrl.startsWith("data:image/"))return NextResponse.json({error:"A food image is required."},{status:400});
  const match=imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);if(!match)return NextResponse.json({error:"Invalid image format."},{status:400});
  const [,mimeType,data]=match;const ai=new GoogleGenAI({apiKey});
  const prompt=`You are the food identification vision layer of a private nutrition tracker. Identify only visible foods. Estimate grams conservatively. Do not invent hidden oil, sauces, butter or ingredients. Return JSON only. identification_confidence = confidence food identity; portion_confidence = confidence grams; nutrition_confidence = confidence in your rough nutrition estimate. The nutrition estimate is only a temporary fallback because a separate nutrition database will be used after identification. Keep items concise.`;
  const response=await ai.models.generateContent({model:MODEL,contents:[{role:"user",parts:[{text:prompt},{inlineData:{mimeType,data}}]}],config:{responseMimeType:"application/json",responseSchema:foodSchema,temperature:.1}});
  if(!response.text)throw new Error("Gemini returned an empty response.");
  const result=JSON.parse(response.text);
  // Resolve nutrition against the reference databases. If no match is found,
  // the original Gemini nutrition estimate remains as fallback.
  try{
    const base=process.env.NUTRITION_DATABASE_ENABLED!=="false";
    if(base){
      const r=await fetch(new URL("/api/nutrition/resolve",request.url),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:result.items})});
      if(r.ok){const resolved=await r.json();result.items=resolved.items;result.total=resolved.total;}
    }
  }catch(e){console.warn("Nutrition DB enrichment skipped",e);}
  return NextResponse.json(result);
 }catch(error){console.error("Gemini food scan failed:",error);return NextResponse.json({error:error instanceof Error?error.message:"Gemini analysis failed."},{status:500});}
}
