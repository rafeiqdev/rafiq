/**
 * Shared shape of the assistant's private memory (see api/_lib/assistantMemory.ts).
 * Pure types + constant lists, no runtime dependencies, so the edge function
 * (which validates model output against the lists) and the admin screen (which
 * labels them) read one definition.
 */

export const VISITOR_TYPES = ['just_browsing', 'exploring', 'planning_move', 'needs_service', 'ready_to_act'] as const;
export const TEMPOS = ['hurried', 'normal', 'relaxed'] as const;
export const URGENCIES = ['low', 'medium', 'high', 'critical'] as const;
export const MESSAGE_LENGTHS = ['very_short', 'short', 'medium', 'long'] as const;
export const SOCIAL_STYLES = ['driver', 'analytical', 'expressive', 'amiable', 'mixed', 'unclear'] as const;
export const SERIOUSNESS = ['passing_time', 'low', 'medium', 'high'] as const;
export const DETAIL_PREFS = ['brief', 'detailed'] as const;
export const CONFIDENCES = ['low', 'medium', 'high'] as const;
export const TONE_TAGS = [
  'direct', 'polite', 'warm', 'chatty', 'playful', 'skeptical', 'anxious',
  'frustrated', 'pressured', 'curious', 'detached', 'demanding',
] as const;

export interface MemoryFacts {
  visitor_type?: (typeof VISITOR_TYPES)[number];
  summary?: string;
  nationality?: string;
  current_city?: string;
  in_turkey_now?: boolean;
  arrival_timeframe?: string;
  purpose?: string;
  family?: string;
  budget_note?: string;
  languages?: string[];
  interests?: string[];
  services_of_interest?: string[];
  open_questions?: string[];
  notes?: string[];
  next_best_action?: string;
}

export interface MemoryStyle {
  tempo?: (typeof TEMPOS)[number];
  urgency?: (typeof URGENCIES)[number];
  message_length?: (typeof MESSAGE_LENGTHS)[number];
  social_style?: (typeof SOCIAL_STYLES)[number];
  seriousness?: (typeof SERIOUSNESS)[number];
  detail_preference?: (typeof DETAIL_PREFS)[number];
  tone?: string[];
  intent_score?: number;
  signals?: string[];
  how_to_talk?: string;
  confidence?: (typeof CONFIDENCES)[number];
}

/** What the admin screen gets back for one visitor. */
export interface AssistantMemoryView {
  facts: MemoryFacts;
  style: MemoryStyle;
  /** how many of the visitor's messages have been read into this record */
  messageCount: number;
  lastAnalyzedAt: string | null;
}

/** `not_installed` = the migration has not been pasted into Supabase yet. */
export type AssistantMemoryResult =
  | { state: 'ready'; memory: AssistantMemoryView | null }
  | { state: 'not_installed' };
