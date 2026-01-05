
import { GoogleGenAI, Type } from "@google/genai";
import { 
  StartupRecord, 
  PartnerProfile, 
  MatchResult,
  ApplicantProfile,
  AnalyticalQuestion,
  ProjectEvaluationResult,
  FailureSimulation,
  GovStats
} from "../types";

const callGemini = async (params: { prompt: string; systemInstruction?: string; json?: boolean; schema?: any }) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const config: any = {
    temperature: 0.3,
    topP: 0.95,
  };

  if (params.systemInstruction) {
    config.systemInstruction = params.systemInstruction;
  }

  if (params.json && params.schema) {
    config.responseMimeType = "application/json";
    config.responseSchema = params.schema;
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: params.prompt,
    config,
  });

  if (params.json) {
    try {
      return JSON.parse(response.text || "{}");
    } catch (e) {
      console.error("JSON parse failed", response.text);
      throw e;
    }
  }

  return response.text;
};

// --- New Educational Functions ---

export const generateLevelMaterial = async (levelId: number, levelTitle: string, userContext: any) => {
  const prompt = `
    أنت موجه ريادي محترف في مسرعة أعمال نخبوية.
    المرحلة: ${levelTitle} (رقم ${levelId}).
    المشروع: ${userContext.startupName || 'مشروع ناشئ'}.
    القطاع: ${userContext.industry || 'عام'}.
    
    المطلوب: توليد مادة تدريبية موجزة وعملية (Actionable) لهذه المرحلة. 
    يجب أن تشمل:
    1. فلسفة المرحلة بأسلوب ملهم (فقرة واحدة).
    2. 4 محاور أساسية للتنفيذ مع شرح بسيط لكل منها.
    3. نصيحة ذهبية للمؤسس.
    
    اللغة: العربية الفصحى، نبرة مهنية.
  `;

  return callGemini({
    prompt,
    systemInstruction: "أنت نظام خبير في تعليم ريادة الأعمال وتطوير المشاريع الناشئة. قدم مادة علمية احترافية بتنسيق JSON.",
    json: true,
    schema: {
      type: Type.OBJECT,
      properties: {
        philosophy: { type: Type.STRING },
        axes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              icon: { type: Type.STRING }
            },
            required: ["title", "description", "icon"]
          }
        },
        expertTip: { type: Type.STRING }
      },
      required: ["philosophy", "axes", "expertTip"]
    }
  });
};

export const generateLevelQuiz = async (levelId: number, levelTitle: string) => {
  const prompt = `
    أنت مختص تقييم ريادي. ولد اختباراً قصيراً مكوناً من 3 أسئلة اختيار من متعدد لمرحلة: ${levelTitle}.
    يجب أن تقيس الأسئلة الفهم الاستراتيجي العميق لمتطلبات هذه المرحلة.
  `;

  return callGemini({
    prompt,
    systemInstruction: "أنت مسؤول التقييم في المسرعة. ولد أسئلة اختيار من متعدد ذكية في تنسيق JSON.",
    json: true,
    schema: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.NUMBER },
          explanation: { type: Type.STRING }
        },
        required: ["question", "options", "correctIndex", "explanation"]
      }
    }
  });
};

// --- Existing Functions Updated to handle imports/logic ---

export const runPartnerMatchAI = async (startup: StartupRecord, partners: PartnerProfile[]): Promise<MatchResult[]> => {
  const prompt = `Match startup ${startup.name} with top partners. Data: ${JSON.stringify(partners)}`;
  return callGemini({ 
    prompt, 
    json: true, 
    schema: { 
      type: Type.ARRAY, 
      items: { 
        type: Type.OBJECT, 
        properties: { 
          id: { type: Type.STRING }, 
          name: { type: Type.STRING }, 
          role: { type: Type.STRING }, 
          avatar: { type: Type.STRING },
          partnerUid: { type: Type.STRING },
          scores: { type: Type.OBJECT, properties: { roleFit: { type: Type.NUMBER }, experienceFit: { type: Type.NUMBER }, industryFit: { type: Type.NUMBER }, styleFit: { type: Type.NUMBER } } }, 
          totalScore: { type: Type.NUMBER }, 
          reason: { type: Type.STRING },
          reasoning: { type: Type.ARRAY, items: { type: Type.STRING } },
          risk: { type: Type.STRING }
        } 
      } 
    } 
  });
};

export const runSmartMatchingAlgorithmAI = async (startup: StartupRecord, partners: PartnerProfile[]): Promise<MatchResult[]> => {
  return runPartnerMatchAI(startup, partners);
};

export const reviewDeliverableAI = async (title: string, desc: string, context: string) => {
  const prompt = `Review Deliverable: ${title}\nDescription: ${desc}\nContext: ${context}`;
  return callGemini({
    prompt,
    systemInstruction: "Review the startup deliverable and return a JSON score and critical feedback.",
    json: true,
    schema: {
      type: Type.OBJECT,
      