
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const optimizeSchedule = async (userInput: string) => {
  const prompt = `Based on the following request, create a structured daily schedule divided into periods. 
  User request: "${userInput}"
  
  Please provide a logical sequence of periods with startTime, endTime, and a descriptive name.
  Ensure times are in 24-hour format (HH:mm).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error optimizing schedule:", error);
    throw error;
  }
};
