import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import { getApiUrl } from "@/lib/query-client";

interface PlayerCountsContextValue {
  playerCounts: Record<string, number>;
  setPlayerCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  refetchCounts: () => void;
}

const PlayerCountsContext = createContext<PlayerCountsContextValue | null>(null);

export function usePlayerCounts(): PlayerCountsContextValue {
  const ctx = useContext(PlayerCountsContext);
  if (!ctx) throw new Error("usePlayerCounts must be inside PlayerCountsProvider");
  return ctx;
}

interface Props {
  children: ReactNode;
}

export function PlayerCountsProvider({ children }: Props) {
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});

  const fetchCounts = async () => {
    try {
      const url = new URL("/api/waitlists/counts", getApiUrl());
      const res = await fetch(url.toString());
      if (!res.ok) return;
      const data: Record<string, number> = await res.json();
      setPlayerCounts(data);
    } catch {
    }
  };

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  const value = useMemo(
    () => ({ playerCounts, setPlayerCounts, refetchCounts: fetchCounts }),
    [playerCounts]
  );

  return (
    <PlayerCountsContext.Provider value={value}>
      {children}
    </PlayerCountsContext.Provider>
  );
}
