import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AI_FREE_PERIOD, ApiError, auth, config as configApi, notifications, profileApi, referrals } from '../lib/api';
import { supabase } from '../lib/supabase';
import { setAnalyticsUser, track } from '../lib/analytics';
import type { AppConfig, PlanTier, Profile, Subscription, User } from '../lib/types';
import { EMPTY_PROFILE } from '../lib/types';

const PROFILE_KEY = 'rafiq_profile';
const CHAT_KEY_PREFIX = 'rafiq_chat_history';
// Set right before the full-page redirect to Google, so refresh() — called
// from onAuthStateChange when the redirect lands back here — knows this
// particular "user went from null to non-null" transition is the OAuth
// return leg, not an ordinary session restore on some unrelated page load.
const GOOGLE_AUTH_PENDING_KEY = 'rafiq_google_auth_pending';
// Generous window between the profile row being created and the redirect
// landing back here — real round-trips are a few seconds; this just needs to
// comfortably clear network jitter, not be tight.
const GOOGLE_SIGNUP_WINDOW_MS = 2 * 60_000;

/** Exported for AppContext.test.ts — the one piece of judgement in the
 *  login-vs-signup call, isolated from everything else refresh() does. */
export function isFreshAccount(createdAt: string, now: number = Date.now()): boolean {
  return now - new Date(createdAt).getTime() < GOOGLE_SIGNUP_WINDOW_MS;
}

function loadLocalProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return EMPTY_PROFILE;
    return { ...EMPTY_PROFILE, ...JSON.parse(raw) };
  } catch {
    return EMPTY_PROFILE;
  }
}

function clearLocalUserData() {
  localStorage.removeItem(PROFILE_KEY);
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(CHAT_KEY_PREFIX)) localStorage.removeItem(key);
  }
}

interface AppState {
  user: User | null;
  /** true until the first session lookup finishes — guards must wait on it */
  authLoading: boolean;
  tier: PlanTier;
  subscription: Subscription | null;
  profile: Profile;
  /**
   * Whether this account finished onboarding. Sourced from the server only
   * (`profiles.onboarding_completed`, with the server-returned answers as a
   * pre-migration fallback) — never from localStorage, so a stale local blob
   * can neither skip nor re-trigger the flow.
   */
  onboardingCompleted: boolean;
  /**
   * Set when the session is valid but the account is unusable — today only
   * `profile_missing`. It must be surfaced, not swallowed: the OAuth return path
   * has no form to show an error on, so without this a Google user is dropped
   * silently onto the guest home page and has no idea why they are signed out.
   */
  authError: string | null;
  langSelected: boolean;
  unread: number;
  appConfig: AppConfig;
  setLangSelected: (v: boolean) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<{ needsConfirmation: boolean }>;
  googleSignIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [tier, setTier] = useState<PlanTier>('free');
  const [profile, setProfile] = useState<Profile>(loadLocalProfile);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [appConfig, setAppConfig] = useState<AppConfig>({
    googleClientId: null,
    freeChatMessages: 3,
    aiFreePeriod: AI_FREE_PERIOD,
  });
  const [langSelected, setLangSelectedState] = useState(
    () => localStorage.getItem('rafiq_lang_selected') === 'true',
  );
  const refAttributed = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const me = await auth.me();
      setAuthError(null);
      setUser(me.user);
      setSubscription(me.subscription ?? null);
      setTier(me.tier ?? 'free');
      setUnread(me.unread ?? 0);
      // Canonical column first; `me.profile.situation` only covers accounts
      // saved before the journey migration added the column. Both come off the
      // server response — the local blob is deliberately not consulted.
      setOnboardingCompleted(Boolean(me.user?.onboardingCompleted) || Boolean(me.profile?.situation));
      if (me.user) {
        // Resolve the Google login-vs-signup question we couldn't answer
        // before the redirect: the profile row's own created_at tells us
        // whether this account existed already or was just created by
        // handle_new_user() moments ago.
        if (sessionStorage.getItem(GOOGLE_AUTH_PENDING_KEY)) {
          sessionStorage.removeItem(GOOGLE_AUTH_PENDING_KEY);
          track(isFreshAccount(me.user.createdAt) ? 'signup' : 'login', { target: 'google' });
        }
        // attribute a stored referral code once (works for email + Google signups)
        const ref = localStorage.getItem('rafiq_ref');
        if (ref && !refAttributed.current) {
          refAttributed.current = true;
          referrals.attributeSelf(ref).catch(() => {});
        }
        if (me.profile?.path) {
          // server copy wins so the plan follows the account across devices
          const merged = { ...EMPTY_PROFILE, ...me.profile };
          setProfile(merged);
          localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
        } else {
          // first login on this device: push the locally collected answers up
          const local = loadLocalProfile();
          if (local.path) profileApi.save(local).catch(() => {});
        }
      }
    } catch (e) {
      // A broken account is not the same as being signed out. Every other
      // failure here legitimately means "no session", but profile_missing means
      // the session is fine and the account is not — the user must be told,
      // whichever route they arrived on (OAuth return included).
      setAuthError(e instanceof ApiError && e.code === 'profile_missing' ? e.code : null);
      sessionStorage.removeItem(GOOGLE_AUTH_PENDING_KEY);
      setUser(null);
      setSubscription(null);
      setTier('free');
      setUnread(0);
      setOnboardingCompleted(false);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // A stalled session lookup must not pin every guard on its spinner — that
    // would turn a brief flash into the freeze it was meant to fix. After this
    // the guards fall back to the signed-out view; a late `refresh()` still
    // corrects them.
    const bail = setTimeout(() => setAuthLoading(false), 3000);
    configApi
      .get()
      .then(setAppConfig)
      .catch(() => {});
    // react to Supabase auth changes (OAuth redirect return, token refresh, sign-out)
    const sub = supabase?.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => {
      clearTimeout(bail);
      sub?.data.subscription.unsubscribe();
    };
  }, [refresh]);

  // Events fired after this point carry user_id; earlier ones in the same
  // browser session (and sign-out) keep it null, but all share session_id.
  useEffect(() => {
    setAnalyticsUser(user?.id ?? null);
  }, [user]);

  // Notifications are created by DB triggers while the tab sits open, so the
  // bell polls its badge instead of waiting for the next full page load.
  useEffect(() => {
    if (!user) return;
    const tick = () =>
      notifications
        .unreadCount()
        .then(setUnread)
        .catch(() => {});
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [user]);

  const updateProfile = useCallback(
    (patch: Partial<Profile>) => {
      setProfile((prev) => {
        const next: Profile = {
          ...prev,
          ...patch,
          has: { ...prev.has, ...(patch.has ?? {}) },
          completed: { ...prev.completed, ...(patch.completed ?? {}) },
          renewals: { ...prev.renewals, ...(patch.renewals ?? {}) },
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
        if (user) profileApi.save(next).catch(() => {});
        return next;
      });
    },
    [user],
  );

  const setLangSelected = useCallback((v: boolean) => {
    setLangSelectedState(v);
    if (v) localStorage.setItem('rafiq_lang_selected', 'true');
    else localStorage.removeItem('rafiq_lang_selected');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      await auth.login(email, password);
      track('login', { target: 'email' });
      await refresh();
    },
    [refresh],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const refCode = localStorage.getItem('rafiq_ref') ?? undefined;
      const res = await auth.register(email, password, name, refCode);
      track('signup', { target: 'email' });
      await refresh();
      return { needsConfirmation: res.needsConfirmation };
    },
    [refresh],
  );

  const googleSignIn = useCallback(async () => {
    // Full-page redirect to Google — there is no synchronous "it worked"
    // moment here to track() from. The flag lets the refresh() that runs when
    // the redirect lands back (via onAuthStateChange) tell login and signup
    // apart, using the profile's own created_at once it has one to check.
    sessionStorage.setItem(GOOGLE_AUTH_PENDING_KEY, '1');
    await auth.loginGoogle();
  }, []);

  const signOut = useCallback(async () => {
    await auth.logout().catch(() => {});
    refAttributed.current = false;
    // a shared device must not leak the previous user's answers or chat
    clearLocalUserData();
    setProfile(EMPTY_PROFILE);
    await refresh();
  }, [refresh]);

  const value = useMemo<AppState>(
    () => ({
      user,
      authLoading,
      tier,
      subscription,
      profile,
      onboardingCompleted,
      authError,
      langSelected,
      unread,
      appConfig,
      setLangSelected,
      updateProfile,
      login,
      register,
      googleSignIn,
      signOut,
      refresh,
    }),
    [user, authLoading, tier, subscription, profile, onboardingCompleted, authError, langSelected, unread, appConfig, setLangSelected, updateProfile, login, register, googleSignIn, signOut, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
