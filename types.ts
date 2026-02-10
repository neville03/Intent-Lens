
export enum UrgencyLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High'
}

export type RecommendationStatus = 'pending' | 'implemented' | 'declined';

export interface Recommendation {
  id: string;
  description: string;
  confidence: number;
  urgency: UrgencyLevel;
  status: RecommendationStatus;
}

export interface IntentInsight {
  id: string;
  summary: string;
  signals: string[];
  recommendations: Recommendation[];
  timestamp: Date;
}

export interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  body: string;
  timestamp: Date;
}

export interface EmailInsight extends IntentInsight {
  sentiment: 'positive' | 'neutral' | 'negative';
  intent: string;
  urgency: UrgencyLevel;
  originalEmail: EmailMessage;
}

export interface AudioProcessingState {
  isActive: boolean;
  transcription: string;
}

export interface ChatMessage {
  id: string;
  sender: 'Customer' | 'Agent' | string;
  text: string;
  timestamp: Date;
}