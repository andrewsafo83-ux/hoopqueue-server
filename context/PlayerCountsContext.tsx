import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Court } from "@/data/courts";

const STORAGE_KEY = "rnl_player_counts";

interface PlayerCountsContextValue {
  playerCounts: Record<string, number>;
  setPlayerCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

const PlayerCountsContext = createContext<PlayerCountsContextValue | null>(null);

export function usePlayerCounts(): PlayerCountsContextValue {
  const ctx = useContext(PlayerCountsContext);
  if (!ctx) throw new Error("usePlayerCounts must be inside PlayerCountsProvider");
  return ctx;
}

interface Props {
  children: ReactNode;
  allCourts: Court[];
}

function seed(courts: Court[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const court of courts) {
    const variance = Math.floor(Math.random() * 3) - 1;
    counts[court.id] = Math.max(0, Math.min(court.maxPlayers, court.basePlayersPlaying + variance));
  }
  return counts;
}

export function PlayerCountsProvider({ children, allCourts }: Props) {
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);

  // Load from AsyncStorage once courts are available
  useEffect(() => {
    if (allCourts.length === 0) return;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        let counts: Record<string, number> = stored ? JSON.parse(stored) : {};
        // Add any new courts not yet seeded
        let changed = false;
        for (const court of allCourts) {
          if (!(court.id in counts)) {
            const variance = Math.floor(Math.random() * 3) - 1;
            counts[court.id] = Math.max(0, Math.min(court.maxPlayers, court.basePlayersPlaying + variance));
            changed = true;
          }
        }
        if (Object.keys(counts).length === 0) {
          counts = seed(allCourts);
          changed = true;
        }
        setPlayerCounts(counts);
        if (changed) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(counts)).catch(() => {});
        }
      } catch {
        setPlayerCounts(seed(allCourts));
      } finally {
        setReady(true);
      }
    })();
  }, [allCourts.length]);

  // Simulate realistic activity — every 30s, only ONE court changes
  useEffect(() => {
    if (!ready || allCourts.length === 0) return;
    const courtMap = new Map(allCourts.map((c) => [c.id, c]));
    const interval = setInterval(() => {
      setPlayerCounts((prev) => {
        const ids = Object.keys(prev);
        if (ids.length === 0) return prev;
        const key = ids[Math.floor(Math.random() * ids.length)];
        const court = courtMap.get(key);
        if (!court) return prev;
        const delta = Math.random() < 0.5 ? 1 : -1;
        const newVal = Math.max(0, Math.min(court.maxPlayers, (prev[key] ?? 0) + delta));
        if (newVal === (prev[key] ?? 0)) return prev;
        return { ...prev, [key]: newVal };
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [ready, allCourts]);

  const value = useMemo(() => ({ playerCounts, setPlayerCounts }), [playerCounts]);

  return (
    <PlayerCountsContext.Provider value={value}>
      {children}
    </PlayerCountsContext.Provider>
  );
}
