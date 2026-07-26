import { Navigate, useLocation } from 'react-router-dom';

/**
 * Redirect-only route components for paths we used to serve a real page on.
 *
 * These exist because mounting the same page under two paths silently doubles
 * the maintenance surface — a fix applied to one copy of the route (a new
 * mobile screen, a new guard) quietly misses the other. A redirect keeps the
 * old URL working for bookmarks and outbound links while leaving exactly one
 * implementation to maintain.
 */

/**
 * /chat -> /premium (the AI assistant).
 *
 * The query string has to survive the hop: /chat?topic=<serviceId> is how the
 * service pages hand a subject to the assistant, and Premium reads it with
 * useSearchParams to seed the first message. A bare
 * `<Navigate to="/premium" replace />` would drop ?topic and land the user on
 * an empty conversation.
 */
export function ChatRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/premium', search }} replace />;
}
