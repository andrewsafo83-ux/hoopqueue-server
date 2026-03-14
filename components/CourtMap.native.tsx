
import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import { usePlayerCounts } from "@/context/PlayerCountsContext";
import { Court } from "@/data/courts";
import Colors from "@/constants/colors";

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function openDirections(court: Court) {
  const label = encodeURIComponent(court.name);
  const { latitude, longitude } = court;
  const url =
    Platform.OS === "ios"
      ? `maps://?q=${label}&ll=${latitude},${longitude}`
      : `geo:${latitude},${longitude}?q=${label}`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    );
  });
}

function NearbyCard({
  court,
  count,
  distanceMiles,
}: {
  court: Court;
  count: number;
  distanceMiles: number | null;
}) {
  const isFull = count >= court.maxPlayers;
  const isEmpty = count === 0;
  const statusColor = isFull ? Colors.red : isEmpty ? Colors.textTertiary : Colors.green;
  const statusLabel = isFull ? "Full" : isEmpty ? "Empty" : "Active";

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.75}
      onPress={() => router.push({ pathname: "/court/[id]", params: { id: court.id } })}
    >
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.cardName} numberOfLines={1}>{court.shortName}</Text>
          <Text style={styles.cardCity}>{court.city}, {court.stateAbbr}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
          <View style={[styles.badgeDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons
            name={court.type === "indoor" ? "business-outline" : "partly-sunny-outline"}
            size={13}
            color={Colors.textSecondary}
          />
          <Text style={styles.statText}>
            {court.type === "indoor" ? "Indoor" : "Outdoor"}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="basketball-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.statText}>{count}/{court.maxPlayers} playing</Text>
        </View>
        {distanceMiles !== null && (
          <View style={styles.statItem}>
            <Ionicons name="navigate-outline" size={13} color={Colors.accent} />
            <Text style={[styles.statText, { color: Colors.accent }]}>
              {distanceMiles < 0.1 ? "Nearby" : `${distanceMiles.toFixed(1)} mi`}
            </Text>
          </View>
        )}
      </View>

      {/* Action row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.directionsBtn}
          onPress={(e) => { e.stopPropagation(); openDirections(court); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="navigate" size={14} color={Colors.accent} />
          <Text style={styles.directionsBtnText}>Directions</Text>
        </TouchableOpacity>
        <View style={styles.progressBarWrap}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.round((count / court.maxPlayers) * 100)}%` as any,
                backgroundColor: statusColor,
              },
            ]}
          />
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}

export default function NearbyScreen() {
  const insets = useSafeAreaInsets();
  const {
    allCourts,
    courtFilter,
    setCourtFilter,
    userLocation,
    getDistanceMiles,
    refetchCourts,
  } = useApp();
  const { playerCounts } = usePlayerCounts();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchCourts();
    setRefreshing(false);
  }, [refetchCourts]);

  const nearbyCourts = useMemo(() => {
    let filtered = allCourts.filter(
      (c) => courtFilter === "all" || c.type === courtFilter
    );

    if (userLocation) {
      filtered = filtered
        .slice()
        .sort((a, b) => {
          const da = getDistanceKm(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude);
          const db = getDistanceKm(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude);
          return da - db;
        })
        .slice(0, 100); // show closest 100
    } else {
      // No location — show active courts first
      filtered = [
        ...filtered.filter((c) => (playerCounts[c.id] ?? 0) > 0),
        ...filtered.filter((c) => (playerCounts[c.id] ?? 0) === 0),
      ].slice(0, 100);
    }

    return filtered;
  }, [allCourts, courtFilter, userLocation, playerCounts]);

  const activeCourts = nearbyCourts.filter((c) => (playerCounts[c.id] ?? 0) > 0).length;

  const renderItem = useCallback(
    ({ item }: { item: Court }) => (
      <NearbyCard
        court={item}
        count={playerCounts[item.id] ?? 0}
        distanceMiles={getDistanceMiles(item)}
      />
    ),
    [playerCounts, getDistanceMiles]
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Nearby</Text>
          <Text style={styles.headerSub}>
            {userLocation ? "Sorted by distance" : "Allow location for nearby courts"} ·{" "}
            {activeCourts} active
          </Text>
        </View>
        <View style={[styles.liveBadge]}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {(["all", "outdoor", "indoor"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, courtFilter === f && styles.filterBtnActive]}
            onPress={() => setCourtFilter(f)}
          >
            <Text style={[styles.filterText, courtFilter === f && styles.filterTextActive]}>
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={nearbyCourts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={15}
        windowSize={8}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="basketball-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No courts found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.greenDim,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.green,
  },
  liveText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: Colors.green,
    letterSpacing: 1,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  filterText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.background,
    fontFamily: "Inter_600SemiBold",
  },
  list: {
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  cardName: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.text,
    marginBottom: 2,
  },
  cardCity: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.accent,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  statsRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.accent + "18",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.accent + "44",
  },
  directionsBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.accent,
  },
  progressBarWrap: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 10,
  },
  emptyText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
