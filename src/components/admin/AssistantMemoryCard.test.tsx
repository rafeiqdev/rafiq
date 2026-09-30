import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AssistantMemoryResult } from '../../lib/assistantMemoryTypes';

// `t` returns the key (plus any default), so assertions target keys, not copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) => {
      if (vars && 'defaultValue' in vars) return `${k}`;
      return vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k;
    },
    i18n: { language: 'ar' },
  }),
}));

const memoryMock = vi.fn();
vi.mock('../../lib/api', () => ({
  adminUsers: { assistantMemory: (...a: unknown[]) => memoryMock(...a) },
}));

import { AssistantMemoryCard } from './AssistantMemoryCard';

const ready = (memory: AssistantMemoryResult extends infer R ? R : never) => memoryMock.mockResolvedValue(memory);

beforeEach(() => {
  memoryMock.mockReset();
});

describe('AssistantMemoryCard (admin only)', () => {
  it('shows what the visitor told us and how they communicate', async () => {
    ready({
      state: 'ready',
      memory: {
        facts: {
          visitor_type: 'planning_move',
          summary: 'سوري يخطط للانتقال لإسطنبول',
          nationality: 'سوري',
          arrival_timeframe: 'بعد شهرين',
          interests: ['عقارات', 'إقامة'],
          open_questions: ['كم تكلفة الإقامة؟'],
          next_best_action: 'التواصل عبر واتساب',
        },
        style: {
          tempo: 'hurried',
          seriousness: 'high',
          social_style: 'driver',
          tone: ['direct', 'pressured'],
          urgency: 'high',
          intent_score: 82,
          signals: ['ذكر موعد سفر محددًا'],
          how_to_talk: 'اجعل الرد قصيرًا ومباشرًا',
          confidence: 'medium',
        },
        messageCount: 6,
        lastAnalyzedAt: '2026-10-01T10:00:00Z',
      },
    });
    render(<AssistantMemoryCard userId="u1" />);

    expect(await screen.findByText('سوري يخطط للانتقال لإسطنبول')).toBeTruthy();
    expect(screen.getByText('بعد شهرين')).toBeTruthy();
    expect(screen.getByText('عقارات، إقامة')).toBeTruthy();
    expect(screen.getByText('كم تكلفة الإقامة؟')).toBeTruthy();
    expect(screen.getByText('ذكر موعد سفر محددًا')).toBeTruthy();
    expect(screen.getByText('اجعل الرد قصيرًا ومباشرًا')).toBeTruthy();
    expect(screen.getByText('82%')).toBeTruthy();
    expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('82');
    expect(memoryMock).toHaveBeenCalledWith('u1');
  });

  it('says there is nothing yet, rather than showing an empty card', async () => {
    ready({ state: 'ready', memory: null });
    render(<AssistantMemoryCard userId="u2" />);
    expect(await screen.findByText('admin.assistant.empty')).toBeTruthy();
  });

  it('tells the admin the memory file has not been pasted in yet', async () => {
    ready({ state: 'not_installed' });
    render(<AssistantMemoryCard userId="u3" />);
    expect(await screen.findByText('admin.assistant.notInstalled')).toBeTruthy();
  });

  it('shows an error with retry, never a blank "nothing known"', async () => {
    memoryMock.mockImplementation(() => Promise.reject(new Error('boom')));
    render(<AssistantMemoryCard userId="u4" />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('admin.assistant.empty')).toBeNull();
  });
});
