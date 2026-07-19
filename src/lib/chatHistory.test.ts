import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_ARCHIVED_TOPICS,
  archiveTopic,
  deleteArchived,
  readArchive,
  readClosed,
  setClosed,
  topicTitle,
} from './chatHistory';
import type { ChatMessage } from './types';

const U = 'user-1';
const msg = (role: 'user' | 'assistant', text: string, ts = 1): ChatMessage => ({ role, text, ts });

function archive(over: Partial<Parameters<typeof archiveTopic>[1]> = {}, now = 1000) {
  return archiveTopic(
    U,
    {
      messages: [msg('user', 'كيف أجدد الإقامة؟')],
      media: [],
      subject: 'residency',
      booked: false,
      title: 'كيف أجدد الإقامة؟',
      ...over,
    },
    now,
  );
}

beforeEach(() => localStorage.clear());

describe('topicTitle', () => {
  it('labels a topic by the first user message', () => {
    const title = topicTitle([msg('assistant', 'مرحباً'), msg('user', 'أريد تجديد الإقامة')], 'fallback');
    expect(title).toBe('أريد تجديد الإقامة');
  });

  it('collapses whitespace and truncates long openers', () => {
    const title = topicTitle([msg('user', `${'ا'.repeat(200)}`)], 'fallback');
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith('…')).toBe(true);
  });

  it('falls back when the user never spoke', () => {
    expect(topicTitle([msg('assistant', 'مرحباً')], 'محادثة')).toBe('محادثة');
    expect(topicTitle([], 'محادثة')).toBe('محادثة');
  });
});

describe('archiveTopic', () => {
  it('stores a finished topic and reads it back', () => {
    archive();
    const list = readArchive(U);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('كيف أجدد الإقامة؟');
    expect(list[0].booked).toBe(false);
  });

  it('drops empty topics so abandoning the chat leaves no litter', () => {
    archive({ messages: [] });
    expect(readArchive(U)).toHaveLength(0);
  });

  it('puts the newest topic first', () => {
    archive({ title: 'first' }, 1000);
    archive({ title: 'second' }, 2000);
    expect(readArchive(U).map((t) => t.title)).toEqual(['second', 'first']);
  });

  it('caps the history so localStorage can never fill up', () => {
    for (let i = 0; i < MAX_ARCHIVED_TOPICS + 5; i++) archive({ title: `t${i}` }, 1000 + i);
    const list = readArchive(U);
    expect(list).toHaveLength(MAX_ARCHIVED_TOPICS);
    // the oldest ones are the ones dropped
    expect(list[0].title).toBe(`t${MAX_ARCHIVED_TOPICS + 4}`);
  });

  it('keeps each user’s history separate', () => {
    archive();
    expect(readArchive('someone-else')).toHaveLength(0);
  });

  it('records that a topic ended with an appointment', () => {
    archive({ booked: true });
    expect(readArchive(U)[0].booked).toBe(true);
  });
});

describe('deleteArchived', () => {
  it('removes only the requested topic', () => {
    archive({ title: 'keep' }, 1000);
    archive({ title: 'drop' }, 2000);
    const target = readArchive(U).find((t) => t.title === 'drop')!;
    const left = deleteArchived(U, target.id);
    expect(left.map((t) => t.title)).toEqual(['keep']);
  });
});

describe('closed flag', () => {
  it('defaults to open', () => {
    expect(readClosed(U)).toBe(false);
  });

  it('persists across reads and clears again', () => {
    setClosed(U, true);
    expect(readClosed(U)).toBe(true);
    setClosed(U, false);
    expect(readClosed(U)).toBe(false);
  });

  it('is per user', () => {
    setClosed(U, true);
    expect(readClosed('other')).toBe(false);
  });
});

describe('corrupt storage', () => {
  it('survives unparseable history without throwing', () => {
    localStorage.setItem(`rafiq_chat_archive_${U}`, '{not json');
    expect(readArchive(U)).toEqual([]);
  });

  it('survives history that is not an array', () => {
    localStorage.setItem(`rafiq_chat_archive_${U}`, '{"a":1}');
    expect(readArchive(U)).toEqual([]);
  });
});
