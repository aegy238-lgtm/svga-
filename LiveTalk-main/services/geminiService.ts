
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Circuit breaker state for API usage
let isQuotaExceeded = false;
let quotaResetTime = 0;

const checkQuota = () => {
  if (isQuotaExceeded) {
    if (Date.now() > quotaResetTime) {
      isQuotaExceeded = false;
    } else {
      return false;
    }
  }
  return true;
};

const handleApiError = (error: any) => {
  const msg = error?.toString() || '';
  // Check for common quota error codes/messages
  if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
    if (!isQuotaExceeded) {
       console.warn("Gemini API Quota Exceeded. Switching to offline mode for 1 minute.");
    }
    isQuotaExceeded = true;
    quotaResetTime = Date.now() + 60000; // 1 minute cooldown
  } else {
    console.error("Gemini API Error:", error);
  }
};

const FALLBACK_MESSAGES = [
  "منورين يا شباب",
  "أهلا بالجميع 🌹",
  "يا هلا والله",
  "يسعد مساكم",
  "كيف الحال؟",
  "الغرفة نار 🔥",
  "حي الله الجميع",
  "منورين الحتة",
  "مساء الخير",
  "شو الأخبار؟",
  "هلا وغلا"
];

const getRandomFallback = () => FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];

/**
 * Simulates active chat participants in the room.
 */
export const generateSimulatedChat = async (roomTitle: string, lastMessages: string[]): Promise<string> => {
  // If no key or quota exceeded, return fallback immediately without calling API
  if (!process.env.API_KEY) return "مرحبا بكم في الغرفة!";
  if (!checkQuota()) return getRandomFallback();
  
  try {
    // Creating a new instance right before the call as per best practices
    const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
    const prompt = `
      You are simulating a lively Arab voice chat room user.
      Room Title: "${roomTitle}"
      Context: People are talking, sending gifts, and having fun.
      Task: Generate a ONE short, casual chat message in Arabic (Gulf, Egyptian, or Levantine dialect).
      Do not repeat previous messages: ${lastMessages.slice(-3).join(', ')}.
      Keep it very short (max 6 words). E.g., "منورين", "يا هلا", "صوتك حلو", "شكرا على الهدية".
    `;

    // Using gemini-3-flash-preview for basic text tasks
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        // Disable thinking for faster response latency in a real-time chat context
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 0.9,
      }
    });

    // response.text is a property getter
    return response.text?.trim() || getRandomFallback();
  } catch (error) {
    handleApiError(error);
    return getRandomFallback();
  }
};

/**
 * AI Assistant that welcomes high level users or comments on gifts.
 */
export const generateSystemAnnouncement = async (action: string, userName: string): Promise<string> => {
  if (!process.env.API_KEY) return `${userName} ${action}`;
  if (!checkQuota()) return `${userName} ${action}`;

  try {
    // Creating a new instance right before the call
    const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
    const prompt = `
      Create a hype announcement for a voice chat app.
      User: ${userName}
      Action: ${action} (e.g., entered the room, sent a Dragon gift).
      Tone: Exciting, VIP style, Arabic.
      Max 10 words.
    `;
    
    // Using gemini-3-flash-preview for basic text generation
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        // Disable thinking for faster response latency
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    
    // response.text is a property getter
    return response.text?.trim() || `رحبوا بالملك ${userName}!`;
  } catch (error) {
    handleApiError(error);
    return `${userName} وصل!`;
  }
};
