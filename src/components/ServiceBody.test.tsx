import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SERVICE_SEO_AR } from '../data/serviceSeoAr';
import { SERVICE_SEO_EN } from '../data/serviceSeoEn';
import { SERVICE_SEO_RU } from '../data/serviceSeoRu';
import { SERVICE_SEO_FA } from '../data/serviceSeoFa';
import { ServiceBody, sectionKind, splitSections } from './ServiceBody';

vi.mock('./AppIcon', () => ({ AppIcon: () => null }));

const labels = { contents: 'في هذه الصفحة', readMore: 'المزيد', readLess: 'أقل' };

describe('sectionKind', () => {
  it.each([
    ['من يحق له الحصول على إقامة طالب؟', 'who'],
    ['Who is entitled to a student residence permit?', 'who'],
    ['المستندات والمتطلبات العامة', 'documents'],
    ['Документы и общие требования', 'documents'],
    ['نقاط مهمة يجب معرفتها', 'important'],
    ['Важные моменты, которые стоит знать', 'important'],
    ['نکات مهمی که باید بدانید', 'important'],
    ['المدة والصلاحية', 'duration'],
    ['Expected timeline and validity', 'duration'],
    ['أكثر الأسباب شيوعاً للرفض أو التأخير', 'rejection'],
    ['Most common reasons for rejection or delay', 'rejection'],
    ['رایج‌ترین دلایل رد یا تأخیر درخواست', 'rejection'],
    ['أسئلة شائعة', 'faq'],
    ['Frequently asked questions', 'faq'],
    ['Часто задаваемые вопросы', 'faq'],
    ['سوالات متداول', 'faq'],
  ])('%s → %s', (heading, kind) => {
    expect(sectionKind(heading)).toBe(kind);
  });

  it('classifies the great majority of real headings into a coloured kind', () => {
    const all = [SERVICE_SEO_AR, SERVICE_SEO_EN, SERVICE_SEO_RU, SERVICE_SEO_FA].flatMap((seo) =>
      Object.values(seo).flatMap((s) => splitSections(s.body ?? '').map((x) => x.heading).filter((h): h is string => !!h)),
    );
    const other = all.filter((h) => sectionKind(h) === 'other');
    expect(all.length).toBeGreaterThan(300);
    expect(other.length / all.length).toBeLessThan(0.05);
  });
});

describe('splitSections', () => {
  it('splits on ## headings and keeps the text before the first one', () => {
    const s = splitSections('intro\n\n## من يحق له؟\n\npara\n\n- a\n- b\n\n## أسئلة شائعة\n\n**س؟**\nج.');
    expect(s.map((x) => [x.heading, x.kind, x.blocks.length])).toEqual([
      [null, 'other', 1],
      ['من يحق له؟', 'who', 2],
      ['أسئلة شائعة', 'faq', 1],
    ]);
  });
});

describe('ServiceBody', () => {
  const body = SERVICE_SEO_AR['res-student'].body!;

  it('renders every section as its own coloured card, with a jump list', () => {
    render(<ServiceBody body={body} serviceId="res-student" isRtl labels={labels} />);
    const cards = screen.getAllByTestId('service-section');
    expect(cards.length).toBeGreaterThanOrEqual(5);
    const kinds = cards.map((c) => c.getAttribute('data-kind'));
    expect(kinds).toContain('who');
    expect(kinds).toContain('documents');
    expect(kinds).toContain('rejection');
    expect(kinds).toContain('faq');
    const nav = screen.getByRole('navigation', { name: labels.contents });
    expect(nav.querySelectorAll('button')).toHaveLength(cards.length);
  });

  it('keeps the whole text in the DOM while folded, and unfolds on "read more"', () => {
    render(<ServiceBody body={body} serviceId="res-student" isRtl labels={labels} />);
    // the last FAQ answer is present even before expanding
    expect(screen.getByText(/هل يمكنني العمل أثناء الدراسة/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(labels.readMore));
    expect(screen.getByText(labels.readLess)).toBeInTheDocument();
  });

  it('renders the documents table and FAQ questions', () => {
    render(<ServiceBody body={body} serviceId="res-student" isRtl labels={labels} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('هل تشمل إقامتي كطالب زوجتي وأطفالي؟')).toBeInTheDocument();
  });
});
