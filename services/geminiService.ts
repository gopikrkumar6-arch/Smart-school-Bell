
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

export const optimizeSchedule = async (userInput: string) => {
  const prompt = `Based on the following request, create a structured daily schedule divided into periods. 
  User request: "${userInput}"
  
  Please provide a logical sequence of periods with startTime, endTime, and a descriptive name.
  Ensure times are in 24-hour format (HH:mm).`;

  console.log("Starting schedule optimization with Gemini...");
  if (!import.meta.env.VITE_API_KEY) {
    console.error("VITE_API_KEY is missing! Please restart your dev server and check .env");
    throw new Error("API Key not found");
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              startTime: { type: Type.STRING },
              endTime: { type: Type.STRING },
            },
            required: ["name", "startTime", "endTime"]
          }
        }
      }
    });

    console.log("Gemini response received successfully.");
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error optimizing schedule with Gemini:", error);
    throw error;
  }
};
