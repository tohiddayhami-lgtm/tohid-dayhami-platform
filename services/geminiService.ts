
import { GoogleGenAI, Type } from "@google/genai";
import { FormField } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface AnalysisResult {
  summary: string;
  priority: 'Low' | 'Medium' | 'High';
  suggestedAction: string;
}

/**
 * Analyzes a ticket description and suggests basic metadata using gemini-3-flash-preview.
 */
export const analyzeTicket = async (description: string, serviceName: string): Promise<AnalysisResult> => {
  try {
    const prompt = `
      به عنوان مدیر یک پلتفرم خدمات صادراتی و بازرگانی، متن درخواست مشتری زیر را برای سرویس "${serviceName}" تحلیل کن.
      
      متن مشتری: "${description}"

      خروجی باید شامل موارد زیر باشد:
      1. خلاصه کوتاه و رسمی درخواست (مناسب برای ثبت در سیستم بازرگانی).
      2. اولویت (High, Medium, Low) بر اساس پتانسیل صادراتی و فوریت.
      3. پیشنهاد اقدام بعدی برای کارشناس (مثلاً: بررسی کاتالوگ، جلسه مشاوره، ارسال پروپوزال).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
            suggestedAction: { type: Type.STRING }
          },
          required: ["summary", "priority", "suggestedAction"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as AnalysisResult;

  } catch (error) {
    console.error("AI Analysis Failed:", error);
    // Fallback if AI fails
    return {
      summary: description.substring(0, 50) + "...",
      priority: 'Medium',
      suggestedAction: 'بررسی توسط کارشناس مربوطه'
    };
  }
};

/**
 * Maps CSV headers to the expected database schema using gemini-3-flash-preview.
 */
export const mapCsvHeaders = async (headers: string[]): Promise<Record<string, string>> => {
  try {
    const prompt = `
      I have a CSV file with the following headers: ${JSON.stringify(headers)}.
      I need to map these headers to my database schema fields:
      - fullName (Name of the person)
      - companyName (Name of the company)
      - location (Country or City)
      - phoneNumber (Mobile number)
      - whatsappNumber (Whatsapp contact)
      - email (Email address)
      - businessType (Type of business e.g. Manufacturing, Trading)

      Return a JSON object where the keys are my schema fields (fullName, companyName, etc.) and the values are the EXACT string from the provided CSV headers that best matches. 
      If no match is found for a field, exclude it from the JSON.
      
      Example Input Headers: ["Name", "Tel", "City"]
      Example Output: { "fullName": "Name", "phoneNumber": "Tel", "location": "City" }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return {};
    return JSON.parse(text);

  } catch (error) {
    console.error("AI Mapping Failed", error);
    return {};
  }
};

export interface KPISuggestion {
  title: string;
  unit: 'percent' | 'count' | 'currency';
  description: string;
}

/**
 * Suggests KPIs for a specific organizational role using gemini-3-flash-preview.
 */
export const suggestKPIs = async (role: string): Promise<KPISuggestion[]> => {
  try {
    const prompt = `
      As an expert HR manager for an Export/Trading company, suggest 5 Key Performance Indicators (KPIs) for the role of "${role}".
      
      Return a JSON array where each item has:
      - title: A short, professional title for the KPI (in Farsi).
      - unit: One of 'percent', 'count', or 'currency'.
      - description: A brief explanation of how it's measured (in Farsi).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              unit: { type: Type.STRING, enum: ['percent', 'count', 'currency'] },
              description: { type: Type.STRING }
            },
            required: ["title", "unit", "description"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);

  } catch (error) {
    console.error("AI KPI Suggestion Failed", error);
    return [];
  }
};

/**
 * Generates dynamic form fields based on a description using gemini-3-flash-preview.
 */
export const generateFormFields = async (description: string): Promise<FormField[]> => {
  try {
    const prompt = `
      You are an expert business analyst and form builder.
      Create a comprehensive list of form fields for the following purpose: "${description}".
      
      The fields should be suitable for a professional business application (e.g., ISO standards, HR forms, Customer Intake).
      Use Farsi for labels and placeholders.
      
      Return a JSON array of objects. Each object must have:
      - label: String (in Farsi)
      - type: String (one of: 'text', 'textarea', 'email', 'tel', 'select', 'header', 'date', 'checkbox')
      - required: Boolean
      - placeholder: String (in Farsi, optional)
      - options: Array of Strings (only if type is 'select')
      
      Example Input: "فرم استخدام"
      Example Output: [
        { "label": "اطلاعات فردی", "type": "header", "required": false },
        { "label": "نام و نام خانوادگی", "type": "text", "required": true, "placeholder": "مثال: علی رضایی" },
        { "label": "تاریخ تولد", "type": "date", "required": true },
        { "label": "جنسیت", "type": "select", "required": true, "options": ["آقا", "خانم"] }
      ]
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['text', 'textarea', 'email', 'tel', 'select', 'header', 'date', 'checkbox'] },
              required: { type: Type.BOOLEAN },
              placeholder: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["label", "type", "required"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const rawFields = JSON.parse(text);
    
    // Post-process to add IDs and Keys
    return rawFields.map((f: any, index: number) => ({
        ...f,
        id: `field-${Date.now()}-${index}`,
        key: `f_${Date.now()}_${index}`,
        order: index,
        isSystem: false
    }));

  } catch (error) {
    console.error("AI Form Generation Failed", error);
    return [];
  }
};
