/**
 * The site-knowledge block of the assistant's system prompt: every page and
 * every service it may send a visitor to, with the exact link id to use.
 *
 * Built from the same SITE_MAP and service index the front end renders link
 * buttons from, so the assistant can only ever offer a page that exists.
 */

import { SITE_MAP } from '../../src/lib/siteMap.js';
import { CATEGORY_INDEX, SERVICE_INDEX } from '../../src/lib/serviceIndex.generated.js';

export function siteKnowledgeBlock(): string {
  const pages = SITE_MAP.map(
    (d) => `- ${d.id} — ${d.label.en} / ${d.label.ar}${d.needsAuth ? ' (needs sign-in)' : ''} — ${d.about}`,
  );

  const categories = CATEGORY_INDEX.map((c) => {
    const services = SERVICE_INDEX.filter((s) => s.category === c.id).map((s) => `    service:${s.id} — ${s.en}`);
    return [`  category:${c.id} (also guide:${c.id}) — ${c.en} / ${c.ar}`, ...services].join('\n');
  });

  return [
    'PAGES YOU CAN SEND PEOPLE TO (link id — page title — what they find there):',
    ...pages,
    '',
    'SERVICES, BY CATEGORY. service:<id> opens the REQUEST FORM for that service (the person starts their request right there — use it when they want this done for them). category:<id> opens that category of the services catalogue (use it to browse or compare). guide:<id> opens the free information guide for that category (use it when they want to read and understand first):',
    ...categories,
  ].join('\n');
}
