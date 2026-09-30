import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCatalog } from '../data/catalogStore';
import { resolveChatLinks } from '../lib/chatLinks';
import { AppIcon, DirArrow } from './AppIcon';

/**
 * The shortcut buttons under an assistant reply — "Real estate page →",
 * "News page →". The assistant says in words where something is; these just
 * take the visitor there in one tap. Ids the site no longer knows are dropped.
 */
export function ChatLinks({ ids }: { ids?: string[] }) {
  const { i18n, t } = useTranslation();
  const catalog = useCatalog();
  const links = resolveChatLinks(ids, i18n.language, catalog);
  if (links.length === 0) return null;

  return (
    <div className="animate-pop self-start flex max-w-[92%] flex-wrap gap-2" data-testid="chat-links">
      {links.map((l) => (
        <Link
          key={l.id}
          to={l.to}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-navy/25 bg-white px-4 py-2 text-[13.5px] font-bold text-navy shadow-sm transition-colors hover:bg-navy hover:text-white active:bg-navy active:text-white"
        >
          <AppIcon name={l.icon} className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-anywhere">{l.kind === 'guide' ? t('chat.links.guide', { name: l.label }) : l.label}</span>
          <DirArrow className="h-4 w-4 shrink-0" />
        </Link>
      ))}
    </div>
  );
}
