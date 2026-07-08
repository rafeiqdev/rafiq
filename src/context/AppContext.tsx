import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { auth, config as configApi, profileApi, referrals } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { AppConfig, PlanTier, Profile, Subscription, User } from '../lib/types';
import { EMPTY_PROFILE } from '../lib/types';

const PROFILE_KEY = 'rafiq_profile';
const CHAT_KEY_PREFIX = 'rafiq_chat_history';

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
  tier: PlanTier;
  subscription: Subscription | null;
  profile: Profile;
  onboarded: boolean;
  langSelected: boolean;
  unread: number;
  appConfig: AppConfig;
  setLangSelected: (v: boolean) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  resetOnboarding: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<{ needsConfirmation: boolean }>;
  googleSignIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [tier, setTier] = useState<PlanTier>('free');
  const [profile, setProfile] = useState<Profile>(loadLocalProfile);
  const [unread, setUnread] = useState(0);
  const [appConfig, setAppConfig] = useState<AppConfig>({ googleClientId: null, freeChatMessages: 3 });
  const [langSelected, setLangSelectedState] = useState(
    () => localStorage.getItem('rafiq_lang_selected') === 'true',
  );
  const refAttributed = useRef(false);

  const onboarded = profile.path !== null;

  const refresh = useCallback(async () => {
    try {
      const me = await auth.me();
      setUser(me.user);
      setSubscription(me.subscription ?? null);
      setTier(me.tier ?? 'free');
      setUnread(me.unread ?? 0);
      if (me.user) {
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
    } catch {
      setUser(null);
      setSubscription(null);
      setTier('free');
      setUnread(0);
    }
  }, []);

  useEffect(() => {
    refresh();
    configApi
      .get()
      .then(setAppConfig)
      .catch(() => {});
    // react to Supabase auth changes (OAuth redirect return, token refresh, sign-out)
    const sub = supabase?.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => sub?.data.subscription.unsubscribe();
  }, [refresh]);

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

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(PROFILE_KEY);
    setProfile(EMPTY_PROFILE);
    if (user) profileApi.save(EMPTY_PROFILE).catch(() => {});
  }, [user]);

  const setLangSelected = useCallback((v: boolean) => {
    setLangSelectedState(v);
    if (v) localStorage.setItem('rafiq_lang_selected', 'true');
    else localStorage.removeItem('rafiq_lang_selected');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      await auth.login(email, password);
      await refresh();
    },
    [refresh],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const refCode = localStorage.getItem('rafiq_ref') ?? undefined;
      const res = await auth.register(email, password, name, refCode);
      await refresh();
      return { needsConfirmation: res.needsConfirmation };
    },
    [refresh],
  );

  const googleSignIn = useCallback(async () => {
    // full-page redirect to Google; the session is detected on return
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
      tier,
      subscription,
      profile,
      onboarded,
      langSelected,
      unread,
      appConfig,
      setLangSelected,
      updateProfile,
      resetOnboarding,
      login,
      register,
      googleSignIn,
      signOut,
      refresh,
    }),
    [user, tier, subscription, profile, onboarded, langSelected, unread, appConfig, setLangSelected, updateProfile, resetOnboarding, login, register, googleSignIn, signOut, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
