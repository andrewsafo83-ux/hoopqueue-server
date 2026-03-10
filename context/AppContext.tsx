import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COURTS, Court, SkillLevel, CITIES } from "@/data/courts";
import { apiRequest } from "@/lib/query-client";

const STORAGE_KEYS = {
  PROFILE: "rnl_profile_v2",
  WAITLISTS: "rnl_waitlists",
  PLAYER_COUNTS: "rnl_player_counts",
};

export interface UserProfile {
  userId: string;
  username: string;
  email: string;
  skillLevel: SkillLevel;
}

export interface WaitlistEntry {
  waitId: string;
  courtId: string;
  userId: string;
  username: string;
  skillLevel: SkillLevel;
  timestamp: number;
  position: number;
}

interface AppContextValue {
  profile: UserProfile | null;
  courts: Court[];
  waitlists: Record<string, WaitlistEntry[]>;
  playerCounts: Record<string, number>;
  isLoaded: boolean;
  updateProfile: (username: string, email: string, skillLevel: SkillLevel) => Promise<void>;
  joinWaitlist: (courtId: string) => Promise<void>;
  leaveWaitlist: (courtId: string) => Promise<void>;
  isOnWaitlist: (courtId: string) => boolean;
  getMyPosition: (courtId: string) => number | null;
  courtFilter: "all" | "indoor" | "outdoor";
  setCourtFilter: (f: "all" | "indoor" | "outdoor") => void;
  cityFilter: string;
  setCityFilter: (city: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function generateUserId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

function seedPlayerCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const court of COURTS) {
    const variance = Math.floor(Math.random() * 3) - 1;
    counts[court.id] = Math.max(0, Math.min(court.maxPlayers, court.basePlayersPlaying + variance));
  }
  return counts;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [waitlists, setWaitlists] = useState<Record<string, WaitlistEntry[]>>({});
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>(seedPlayerCounts());
  const [isLoaded, setIsLoaded] = useState(false);
  const [courtFilter, setCourtFilter] = useState<"all" | "indoor" | "outdoor">("all");
  const [cityFilter, setCityFilter] = useState<string>("All Cities");

  useEffect(() => {
    async function loadData() {
      try {
        const [profileStr, waitlistsStr, countsStr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
          AsyncStorage.getItem(STORAGE_KEYS.WAITLISTS),
          AsyncStorage.getItem(STORAGE_KEYS.PLAYER_COUNTS),
        ]);

        if (profileStr) {
          setProfile(JSON.parse(profileStr));
        }
        if (waitlistsStr) {
          setWaitlists(JSON.parse(waitlistsStr));
        }
        if (countsStr) {
          setPlayerCounts(JSON.parse(countsStr));
        } else {
          const seeded = seedPlayerCounts();
          setPlayerCounts(seeded);
          await AsyncStorage.setItem(STORAGE_KEYS.PLAYER_COUNTS, JSON.stringify(seeded));
        }
      } catch (e) {
        console.error("Load error:", e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadData();
  }, []);

  // Only simulate activity for courts that already have players
  useEffect(() => {
    const interval = setInterval(() => {
      setPlayerCounts((prev) => {
        const updated = { ...prev };
        // Only pick courts that currently have players
        const activeCourts = Object.keys(updated).filter((k) => (updated[k] ?? 0) > 0);
        if (activeCourts.length === 0) return updated;
        const randomKey = activeCourts[Math.floor(Math.random() * activeCourts.length)];
        const court = COURTS.find((c) => c.id === randomKey);
        if (court) {
          const delta = Math.random() < 0.5 ? 1 : -1;
          const newVal = Math.max(0, Math.min(court.maxPlayers, (updated[randomKey] ?? 0) + delta));
          updated[randomKey] = newVal;
        }
        return updated;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const updateProfile = useCallback(async (username: string, email: string, skillLevel: SkillLevel) => {
    const userId = profile?.userId ?? generateUserId();
    const newProfile: UserProfile = { userId, username, email, skillLevel };
    setProfile(newProfile);
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(newProfile));
    // Persist to backend database
    try {
      await apiRequest("POST", "/api/users", { userId, username, email, skillLevel });
    } catch (err) {
      console.warn("Could not sync profile to server:", err);
    }
  }, [profile]);

  const joinWaitlist = useCallback(async (courtId: string) => {
    if (!profile) return;
    const existing = waitlists[courtId] ?? [];
    const alreadyOn = existing.some((e) => e.userId === profile.userId);
    if (alreadyOn) return;

    const newEntry: WaitlistEntry = {
      waitId: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      courtId,
      userId: profile.userId,
      username: profile.username,
      skillLevel: profile.skillLevel,
      timestamp: Date.now(),
      position: existing.length + 1,
    };

    const updated = { ...waitlists, [courtId]: [...existing, newEntry] };
    setWaitlists(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.WAITLISTS, JSON.stringify(updated));
  }, [profile, waitlists]);

  const leaveWaitlist = useCallback(async (courtId: string) => {
    if (!profile) return;
    const existing = waitlists[courtId] ?? [];
    const filtered = existing
      .filter((e) => e.userId !== profile.userId)
      .map((e, i) => ({ ...e, position: i + 1 }));

    const updated = { ...waitlists, [courtId]: filtered };
    setWaitlists(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.WAITLISTS, JSON.stringify(updated));
  }, [profile, waitlists]);

  const isOnWaitlist = useCallback((courtId: string): boolean => {
    if (!profile) return false;
    return (waitlists[courtId] ?? []).some((e) => e.userId === profile.userId);
  }, [profile, waitlists]);

  const getMyPosition = useCallback((courtId: string): number | null => {
    if (!profile) return null;
    const entry = (waitlists[courtId] ?? []).find((e) => e.userId === profile.userId);
    return entry?.position ?? null;
  }, [profile, waitlists]);

  const courts = useMemo(() => {
    return COURTS.filter((c) => {
      const typeMatch = courtFilter === "all" || c.type === courtFilter;
      const cityMatch = cityFilter === "All Cities" || c.city === cityFilter;
      return typeMatch && cityMatch;
    });
  }, [courtFilter, cityFilter]);

  const value = useMemo<AppContextValue>(() => ({
    profile,
    courts,
    waitlists,
    playerCounts,
    isLoaded,
    updateProfile,
    joinWaitlist,
    leaveWaitlist,
    isOnWaitlist,
    getMyPosition,
    courtFilter,
    setCourtFilter,
    cityFilter,
    setCityFilter,
  }), [profile, courts, waitlists, playerCounts, isLoaded, updateProfile, joinWaitlist, leaveWaitlist, isOnWaitlist, getMyPosition, courtFilter, setCourtFilter, cityFilter, setCityFilter]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
