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
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Court, SkillLevel, US_STATES } from "@/data/courts";
import { apiRequest, getApiUrl } from "@/lib/query-client";

export { Court, US_STATES };

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STORAGE_KEYS = {
  PROFILE: "rnl_profile_v2",
  WAITLISTS: "rnl_waitlists",
  PLAYER_COUNTS: "rnl_player_counts",
  DEVICE_ID: "rnl_device_id",
};

export interface UserProfile {
  userId: string;
  username: string;
  handle?: string;
  email: string;
  phone?: string;
  skillLevel: SkillLevel;
  avatarBase64?: string;
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

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface AppContextValue {
  profile: UserProfile | null;
  courts: Court[];
  allCourts: Court[];
  waitlists: Record<string, WaitlistEntry[]>;
  playerCounts: Record<string, number>;
  isLoaded: boolean;
  userLocation: UserLocation | null;
  updateProfile: (username: string, handle: string, email: string, phone: string, skillLevel: SkillLevel, forceUserId?: string) => Promise<void>;
  updateAvatar: (base64: string) => Promise<void>;
  refetchCourts: () => Promise<void>;
  fetchCourtWaitlist: (courtId: string) => Promise<void>;
  joinWaitlist: (courtId: string) => Promise<{ ok: boolean; error?: string; currentCourtId?: string }>;
  leaveWaitlist: (courtId: string) => Promise<void>;
  isOnWaitlist: (courtId: string) => boolean;
  getMyPosition: (courtId: string) => number | null;
  getDistanceMiles: (court: Court) => number | null;
  courtFilter: "all" | "indoor" | "outdoor";
  setCourtFilter: (f: "all" | "indoor" | "outdoor") => void;
  cityFilter: string;
  setCityFilter: (city: string) => void;
  stateFilter: string;
  setStateFilter: (state: string) => void;
  availableCities: string[];
  availableStates: { name: string; abbr: string }[];
}

const AppContext = createContext<AppContextValue | null>(null);

export function generateUserId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

async function getOrCreateDeviceId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (stored) return stored;
    const newId = "dev_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
    await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, newId);
    return newId;
  } catch {
    return "dev_" + Math.random().toString(36).substring(2, 15);
  }
}

function seedPlayerCounts(courtList: Court[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const court of courtList) {
    const variance = Math.floor(Math.random() * 3) - 1;
    counts[court.id] = Math.max(0, Math.min(court.maxPlayers, court.basePlayersPlaying + variance));
  }
  return counts;
}

async function fetchCourtsFromApi(): Promise<Court[]> {
  try {
    const url = new URL("/api/courts", getApiUrl());
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch courts");
    return await res.json();
  } catch {
    return [];
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [waitlists, setWaitlists] = useState<Record<string, WaitlistEntry[]>>({});
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [courtFilter, setCourtFilter] = useState<"all" | "indoor" | "outdoor">("all");
  const [cityFilter, setCityFilter] = useState<string>("All Cities");
  const [stateFilter, setStateFilter] = useState<string>("All States");
  const [allCourts, setAllCourts] = useState<Court[]>([]);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [profileStr, waitlistsStr, countsStr, fetchedCourts] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
          AsyncStorage.getItem(STORAGE_KEYS.WAITLISTS),
          AsyncStorage.getItem(STORAGE_KEYS.PLAYER_COUNTS),
          fetchCourtsFromApi(),
        ]);

        if (profileStr) setProfile(JSON.parse(profileStr));
        if (waitlistsStr) setWaitlists(JSON.parse(waitlistsStr));

        const courtList = fetchedCourts.length > 0 ? fetchedCourts : [];
        setAllCourts(courtList);

        if (countsStr) {
          const parsed = JSON.parse(countsStr);
          // Seed any new courts not yet in stored counts
          const updated = { ...parsed };
          for (const court of courtList) {
            if (!(court.id in updated)) {
              const variance = Math.floor(Math.random() * 3) - 1;
              updated[court.id] = Math.max(0, Math.min(court.maxPlayers, court.basePlayersPlaying + variance));
            }
          }
          setPlayerCounts(updated);
        } else {
          const seeded = seedPlayerCounts(courtList);
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

  // Register for push notifications
  useEffect(() => {
    async function registerPushToken() {
      if (Platform.OS === "web") return;
      if (!profile) return;
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") return;
        const tokenData = await Notifications.getExpoPushTokenAsync();
        const token = tokenData.data;
        await apiRequest("POST", `/api/users/${profile.userId}/push-token`, { token });
      } catch (err) {
        console.warn("Push token registration failed:", err);
      }
    }
    registerPushToken();
  }, [profile?.userId]);

  // Request location permission and get coordinates
  useEffect(() => {
    async function fetchLocation() {
      try {
        if (Platform.OS === "web") {
          navigator.geolocation?.getCurrentPosition(
            (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            () => {}
          );
          return;
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {}
    }
    fetchLocation();
  }, []);

  // Simulate activity
  useEffect(() => {
    if (allCourts.length === 0) return;
    const interval = setInterval(() => {
      setPlayerCounts((prev) => {
        const updated = { ...prev };
        const activeCourts = Object.keys(updated).filter((k) => (updated[k] ?? 0) > 0);
        if (activeCourts.length === 0) return updated;
        const randomKey = activeCourts[Math.floor(Math.random() * activeCourts.length)];
        const court = allCourts.find((c) => c.id === randomKey);
        if (court) {
          const delta = Math.random() < 0.5 ? 1 : -1;
          const newVal = Math.max(0, Math.min(court.maxPlayers, (updated[randomKey] ?? 0) + delta));
          updated[randomKey] = newVal;
        }
        return updated;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [allCourts]);

  const updateProfile = useCallback(async (username: string, handle: string, email: string, phone: string, skillLevel: SkillLevel, forceUserId?: string) => {
    const userId = profile?.userId ?? forceUserId ?? generateUserId();
    const newProfile: UserProfile = { userId, username, handle: handle || undefined, email, phone: phone || undefined, skillLevel };
    setProfile(newProfile);
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(newProfile));
    const deviceId = await getOrCreateDeviceId();
    const res = await fetch(new URL("/api/users", getApiUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, username, handle: handle || undefined, email, phone: phone || undefined, skillLevel, deviceId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.code === "device_exists") {
        throw new Error("DEVICE_EXISTS");
      }
      if (res.status === 409) {
        throw new Error(body.message || "Account error");
      }
    }
  }, [profile]);

  const refetchCourts = useCallback(async () => {
    const fetched = await fetchCourtsFromApi();
    if (fetched.length > 0) {
      setAllCourts(fetched);
      setPlayerCounts((prev) => {
        const updated = { ...prev };
        for (const court of fetched) {
          if (!(court.id in updated)) {
            const variance = Math.floor(Math.random() * 3) - 1;
            updated[court.id] = Math.max(0, Math.min(court.maxPlayers, court.basePlayersPlaying + variance));
          }
        }
        return updated;
      });
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refetchCourts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refetchCourts]);

  const updateAvatar = useCallback(async (base64: string) => {
    if (!profile) return;
    const newProfile = { ...profile, avatarBase64: base64 };
    setProfile(newProfile);
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(newProfile));
    try {
      await apiRequest("POST", `/api/users/${profile.userId}/avatar`, {
        base64,
        requesterId: profile.userId,
      });
    } catch (err) {
      console.warn("Could not sync avatar to server:", err);
    }
  }, [profile]);

  const fetchCourtWaitlist = useCallback(async (courtId: string) => {
    try {
      const url = new URL(`/api/waitlists/${courtId}`, getApiUrl());
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) return;
      const rows: Array<{ userId: string; username: string; skillLevel: string; timestamp: string; position: number }> = await res.json();
      const entries: WaitlistEntry[] = rows.map((r) => ({
        waitId: r.userId,
        courtId,
        userId: r.userId,
        username: r.username,
        skillLevel: r.skillLevel as SkillLevel,
        timestamp: new Date(r.timestamp).getTime(),
        position: r.position,
      }));
      setWaitlists((prev) => ({ ...prev, [courtId]: entries }));
    } catch (err) {
      console.warn("Waitlist fetch error:", err);
    }
  }, []);

  const joinWaitlist = useCallback(async (courtId: string): Promise<{ ok: boolean; error?: string; currentCourtId?: string }> => {
    if (!profile) return { ok: false, error: "No profile" };
    try {
      const url = new URL(`/api/waitlists/${courtId}/join`, getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.userId, username: profile.username, skillLevel: profile.skillLevel }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.message ?? "Could not join waitlist", currentCourtId: body.currentCourtId };
      }
      const rows: Array<{ userId: string; username: string; skillLevel: string; timestamp: string; position: number }> = await res.json();
      const entries: WaitlistEntry[] = rows.map((r) => ({
        waitId: r.userId,
        courtId,
        userId: r.userId,
        username: r.username,
        skillLevel: r.skillLevel as SkillLevel,
        timestamp: new Date(r.timestamp).getTime(),
        position: r.position,
      }));
      setWaitlists((prev) => ({ ...prev, [courtId]: entries }));
      return { ok: true };
    } catch (err) {
      console.warn("Join waitlist error:", err);
      return { ok: false, error: "Network error" };
    }
  }, [profile]);

  const leaveWaitlist = useCallback(async (courtId: string) => {
    if (!profile) return;
    try {
      const url = new URL(`/api/waitlists/${courtId}/leave`, getApiUrl());
      await fetch(url.toString(), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.userId }),
      });
      setWaitlists((prev) => {
        const filtered = (prev[courtId] ?? [])
          .filter((e) => e.userId !== profile.userId)
          .map((e, i) => ({ ...e, position: i + 1 }));
        return { ...prev, [courtId]: filtered };
      });
    } catch (err) {
      console.warn("Leave waitlist error:", err);
    }
  }, [profile]);

  const isOnWaitlist = useCallback((courtId: string): boolean => {
    if (!profile) return false;
    return (waitlists[courtId] ?? []).some((e) => e.userId === profile.userId);
  }, [profile, waitlists]);

  const getMyPosition = useCallback((courtId: string): number | null => {
    if (!profile) return null;
    const entry = (waitlists[courtId] ?? []).find((e) => e.userId === profile.userId);
    return entry?.position ?? null;
  }, [profile, waitlists]);

  const getDistanceMiles = useCallback((court: Court): number | null => {
    if (!userLocation) return null;
    const km = getDistanceKm(userLocation.latitude, userLocation.longitude, court.latitude, court.longitude);
    return km * 0.621371;
  }, [userLocation]);

  const courts = useMemo(() => {
    const filtered = allCourts.filter((c) => {
      const typeMatch = courtFilter === "all" || c.type === courtFilter;
      const stateMatch = stateFilter === "All States" || c.state === stateFilter;
      const cityMatch = cityFilter === "All Cities" || c.city === cityFilter;
      return typeMatch && stateMatch && cityMatch;
    });
    if (userLocation) {
      return filtered.slice().sort((a, b) => {
        const da = getDistanceKm(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude);
        const db = getDistanceKm(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude);
        return da - db;
      });
    }
    return filtered;
  }, [allCourts, courtFilter, stateFilter, cityFilter, userLocation]);

  const availableCities = useMemo(() => {
    const source = stateFilter === "All States" ? allCourts : allCourts.filter((c) => c.state === stateFilter);
    return ["All Cities", ...Array.from(new Set(source.map((c) => c.city))).sort()];
  }, [allCourts, stateFilter]);

  const availableStates = useMemo(() => {
    return US_STATES;
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    profile,
    courts,
    allCourts,
    waitlists,
    playerCounts,
    isLoaded,
    userLocation,
    updateProfile,
    updateAvatar,
    refetchCourts,
    fetchCourtWaitlist,
    joinWaitlist,
    leaveWaitlist,
    isOnWaitlist,
    getMyPosition,
    getDistanceMiles,
    courtFilter,
    setCourtFilter,
    cityFilter,
    setCityFilter,
    stateFilter,
    setStateFilter,
    availableCities,
    availableStates,
  }), [profile, courts, allCourts, waitlists, playerCounts, isLoaded, userLocation, updateProfile, updateAvatar, refetchCourts, fetchCourtWaitlist, joinWaitlist, leaveWaitlist, isOnWaitlist, getMyPosition, getDistanceMiles, courtFilter, setCourtFilter, cityFilter, setCityFilter, stateFilter, setStateFilter, availableCities, availableStates]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
