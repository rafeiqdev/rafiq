import type { BookingMedia, ChatMessage } from './types';

/**
 * Past conversations, kept per user in localStorage.
 *
 * A topic ends when the user books an appointment (the case moves to a human)
 * or when they explicitly start a new one. Before this, `startNewTopic` simply
 * deleted the transcript — so there was no history to show.
 */
export interface ArchivedTopic {
  id: string;
  /** first thing the user actually asked — used as the list label */
  title: string;
  subject: string | null;
  messages: ChatMessage[];
  media: BookingMedia[];
  closedAt: number;
  /** true when the topic ended with a confirmed appointment */
  booked: boolean;
}

const archiveKey = (userId: string) => `rafiq_chat_archive_${userId}`;
const closedKey = (userId: string) => `rafiq_chat_closed_${userId}`;

/** Bounded so a long-time user can never fill the localStorage quota. */
export const MAX_ARCHIVED_TOPICS = 20;
const MAX_TITLE = 60;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — history is a convenience, never block the chat for it */
  }
}

/** Label a topic by its first real user message. */
export function topicTitle(messages: ChatMessage[], fallback: string): string {
  const first = messages.find((m) => m.role === 'user' && m.text.trim());
  if (!first) return fallback;
  const line = first.text.trim().replace(/\s+/g, ' ');
  return line.length > MAX_TITLE ? `${line.slice(0, MAX_TITLE - 1)}…` : line;
}

export function readArchive(userId: string): ArchivedTopic[] {
  const list = read<ArchivedTopic[]>(archiveKey(userId), []);
  return Array.isArray(list) ? list : [];
}

/**
 * Prepend a finished topic. Empty topics are dropped rather than stored, so
 * opening and abandoning the chat never litters the history.
 */
export function archiveTopic(
  userId: string,
  topic: { messages: ChatMessage[]; media: BookingMedia[]; subject: string | null; booked: boolean; title: string },
  now: number,
): ArchivedTopic[] {
  if (topic.messages.length === 0) return readArchive(userId);
  const entry: ArchivedTopic = {
    id: `t${now}`,
    title: topic.title,
    subject: topic.subject,
    messages: topic.messages,
    media: topic.media,
    closedAt: now,
    booked: topic.booked,
  };
  const next = [entry, ...readArchive(userId)].slice(0, MAX_ARCHIVED_TOPICS);
  write(archiveKey(userId), next);
  return next;
}

export function deleteArchived(userId: string, id: string): ArchivedTopic[] {
  const next = readArchive(userId).filter((t) => t.id !== id);
  write(archiveKey(userId), next);
  return next;
}

/** A closed topic is read-only: the assistant stops replying until a new one starts. */
export function readClosed(userId: string): boolean {
  return localStorage.getItem(closedKey(userId)) === 'true';
}

export function setClosed(userId: string, closed: boolean): void {
  try {
    if (closed) localStorage.setItem(closedKey(userId), 'true');
    else localStorage.removeItem(closedKey(userId));
  } catch {
    /* ignore */
  }
}
