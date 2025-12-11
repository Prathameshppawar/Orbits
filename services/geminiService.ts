import { GoogleGenAI, Type } from "@google/genai";
import { PlaceCategory } from "../types";

// Initialize Gemini
// Note: In a real production app, you might proxy this through a backend to protect the key,
// or use the ephemeral token pattern if using client-side only.
// The prompt instructions specify process.env.API_KEY usage.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const suggestCategoryAndNotes = async (placeName: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `I am adding a location bookmark named "${placeName}" to my map app. 
      Please suggest a category from this list: [Generic, Work, Home, Shop, Food, Health, Travel]
      and a short, helpful default note for this place (max 10 words).
      Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, enum: Object.values(PlaceCategory) },
            suggestedNote: { type: Type.STRING },
          },
          required: ["category", "suggestedNote"],
        },
      },
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as { category: PlaceCategory; suggestedNote: string };
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return { category: PlaceCategory.Generic, suggestedNote: "" };
  }
};

export const optimizeItineraryRoute = async (
  currentLocationName: string,
  places: { name: string; id: string }[]
) => {
  try {
    const placeList = places.map((p) => p.name).join(", ");
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `I am at ${currentLocationName}. I need to visit these places: ${placeList}.
      Order them in the most logical order to visit starting from my location.
      Return a JSON object with an array of the original place names in the optimized order.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            optimizedOrder: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            reasoning: { type: Type.STRING },
          },
        },
      },
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return null;
  }
};
