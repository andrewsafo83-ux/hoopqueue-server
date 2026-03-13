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
import { Platform } from "react-native";
import { Court, SkillLevel, CITIES } from "@/data/courts";
import { apiRequest, getApiUrl } from "@/lib/query-client";

export { Court, CITIES };

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
};

export interface UserProfile {
  userId: string;
  username: string;
  email: string;
  phone?: string;
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
  updateProfile: (username: string, email: string, phone: string, skillLevel: SkillLevel, forceUserId?: string) => Promise<void>;
  joinWaitlist: (courtId: string) => Promise<void>;
  leaveWaitlist: (courtId: string) => Promise<void>;
  isOnWaitlist: (courtId: string) => boolean;
  getMyPosition: (courtId: string) => number | null;
  getDistanceMiles: (court: Court) => number | null;
  courtFilter: "all" | "indoor" | "outdoor";
  setCourtFilter: (f: "all" | "indoor" | "outdoor") => void;
  cityFilter: string;
  setCityFilter: (city: string) => void;
  availableCities: string[];
}

const AppContext = createContext<AppContextValue | null>(null);

export function generateUserId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
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
    const res = await fetch(url.toString());
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

  const updateProfile = useCallback(async (username: string, email: string, phone: string, skillLevel: SkillLevel, forceUserId?: string) => {
    const userId = profile?.userId ?? forceUserId ?? generateUserId();
    const newProfile: UserProfile = { userId, username, email, phone: phone || undefined, skillLevel };
    setProfile(newProfile);
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(newProfile));
    try {
      await apiRequest("POST", "/api/users", { userId, username, email, phone: phone || undefined, skillLevel });
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

  const getDistanceMiles = useCallback((court: Court): number | null => {
    if (!userLocation) return null;
    const km = getDistanceKm(userLocation.latitude, userLocation.longitude, court.latitude, court.longitude);
    return km * 0.621371;
  }, [userLocation]);

  const courts = useMemo(() => {
    const filtered = allCourts.filter((c) => {
      const typeMatch = courtFilter === "all" || c.type === courtFilter;
      const cityMatch = cityFilter === "All Cities" || c.city === cityFilter;
      return typeMatch && cityMatch;
    });
    if (userLocation) {
      return filtered.slice().sort((a, b) => {
        const da = getDistanceKm(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude);
        const db = getDistanceKm(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude);
        return da - db;
      });
    }
    return filtered;
  }, [allCourts, courtFilter, cityFilter, userLocation]);

  const availableCities = useMemo(() => {
    const cities = ["All Cities", ...Array.from(new Set(allCourts.map((c) => c.city))).sort()];
    return cities;
  }, [allCourts]);

  const value = useMemo<AppContextValue>(() => ({
    profile,
    courts,
    allCourts,
    waitlists,
    playerCounts,
    isLoaded,
    userLocation,
    updateProfile,
    joinWaitlist,
    leaveWaitlist,
    isOnWaitlist,
    getMyPosition,
    getDistanceMiles,
    courtFilter,
    setCourtFilter,
    cityFilter,
    setCityFilter,
    availableCities,
  }), [profile, courts, allCourts, waitlists, playerCounts, isLoaded, userLocation, updateProfile, joinWaitlist, leaveWaitlist, isOnWaitlist, getMyPosition, getDistanceMiles, courtFilter, setCourtFilter, cityFilter, setCityFilter, availableCities]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
