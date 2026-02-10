
import { GoogleGenAI, Type } from "@google/genai";
import { IntentInsight, ChatMessage, UrgencyLevel, EmailMessage, EmailInsight } from "../types";

// Always initialize with named parameter apiKey from process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeConversation = async (messages: ChatMessage[]): Promise<IntentInsight | null> => {
  if (messages.length === 0) return null;
  const conversationLog = messages.map(m => `${m.sender}: ${m.text}`).join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze this conversation for intent shifts. Respond ONLY in JSON.
      Log:
      ${conversationLog}
      
      Schema:
      {
        "summary": "One sentence overview",
        "signals": ["signal"],
        "recommendations": [{"description": "action", "confidence": 0.9, "urgency": "Low" | "Medium" | "High"}]
      }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            signals: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  urgency: { type: Type.STRING }
                },
                required: ["description", "confidence", "urgency"]
              }
            }
          },
          required: ["summary", "signals", "recommendations"]
        }
      }
    });

    // Extract text using .text property
    const data = JSON.parse(response.text || '{}');
    return {
      id: Math.random().toString(36).substr(2, 9),
      summary: data.summary,
      signals: data.signals,
      recommendations: (data.recommendations || []).map((r: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        description: r.description,
        confidence: r.confidence,
        urgency: r.urgency as UrgencyLevel,
        status: 'pending' as const
      })),
      timestamp: new Date()
    };
  } catch (error) {
    console.error("Analysis Error:", error);
    return null;
  }
};

export const analyzeEmail = async (email: EmailMessage): Promise<EmailInsight | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze this incoming email for intent, sentiment, and urgency.
      From: ${email.from}
      Subject: ${email.subject}
      Body: ${email.body}
      
      Respond ONLY in JSON.
      Schema:
      {
        "summary": "Brief overview",
        "intent": "purchase | complaint | inquiry",
        "sentiment": "positive | neutral | negative",
        "urgency": "Low | Medium | High",
        "recommendations": [{"description": "Actionable suggestion", "confidence": 0.9, "urgency": "Low | Medium | High"}]
      }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            intent: { type: Type.STRING },
            sentiment: { type: Type.STRING },
            urgency: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  urgency: { type: Type.STRING }
                },
                required: ["description", "confidence", "urgency"]
              }
            }
          },
          required: ["summary", "intent", "sentiment", "urgency", "recommendations"]
        }
      }
    });

    // Use .text property to get the response string
    const data = JSON.parse(response.text || '{}');
    return {
      id: Math.random().toString(36).substr(2, 9),
      summary: data.summary,
      intent: data.intent,
      sentiment: data.sentiment as any,
      // Map top-level urgency from JSON response to EmailInsight
      urgency: data.urgency as UrgencyLevel,
      signals: [data.intent, data.sentiment],
      originalEmail: email,
      recommendations: (data.recommendations || []).map((r: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        description: r.description,
        confidence: r.confidence,
        urgency: r.urgency as UrgencyLevel,
        status: 'pending' as const
      })),
      timestamp: new Date()
    };
  } catch (error) {
    console.error("Email Analysis Error:", error);
    return null;
  }
};

export const transformRecommendationToMessage = async (recommendation: string, history: ChatMessage[] | EmailMessage): Promise<string> => {
  try {
    let log = '';
    if (Array.isArray(history)) {
      log = history.slice(-5).map(m => `${m.sender}: ${m.text}`).join('\n');
    } else {
      log = `Email from ${history.from}: ${history.body}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an elite customer agent. Convert this recommendation into a natural, first-person "I" message.
      MANDATORY: Use "I" instead of "we".
      
      Recommendation: ${recommendation}
      Context: ${log}
      
      Output ONLY the message text. No quotes.`
    });
    // response.text returns the generated content
    return response.text?.trim() || recommendation;
  } catch (e) {
    return recommendation;
  }
};

/**
 * Manual implementation of base64 encoding/decoding as required for raw PCM audio streams.
 */
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer.
 * For raw PCM streams, do not use native decodeAudioData.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}