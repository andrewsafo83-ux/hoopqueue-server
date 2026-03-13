
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { Court, INITIAL_REGION } from "@/data/courts";
import Colors from "@/constants/colors";

// Keep well below what crashes — custom view markers are expensive
const MAX_MARKERS = 30;
const ZOOM_THRESHOLD = 8;

function LiveDot() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={styles.liveContainer}>
      <Animated.View style={[styles.livePulse, { transform: [{ scale: pulse }] }]} />
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

// Minimal marker — just a small circle with a player count number.
// Avoids Ionicons and complex layout which are very expensive at scale.
function CourtMarker({
  court,
  count,
  onPress,
}: {
  court: Court;
  count: number;
  onPress: () => void;
}) {
  const isFull = count >= court.maxPlayers;
  const hasPlayers = count > 0;
  const dotColor = isFull ? Colors.red : hasPlayers ? Colors.green : "#555566";
  return (
    <Marker
      coordinate={{ latitude: court.latitude, longitude: court.longitude }}
      onPress={onPress}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={[styles.dot, { borderColor: dotColor }]}>
        <Text style={[styles.dotCount, { color: dotColor }]}>{count}</Text>
      </View>
    </Marker>
  );
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0f0f1a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f0f1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1e2030" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d0d1a" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#111120" }] },
  { featureType: "transit", stylers: [{ color: "#2f3948" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
];

export default function CourtMap() {
  const insets = useSafeAreaInsets();
  const { allCourts, playerCounts, courtFilter, setCourtFilter, userLocation } = useApp();
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [region, setRegion] = useState<Region | null>(null);

  // Debounce region updates so markers don't remount on every animation frame
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRegionChange = useCallback((r: Region) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setRegion(r), 300);
  }, []);

  const visibleCourts = useMemo(() => {
    if (!region) return [];
    const { latitude, longitude, latitudeDelta, longitudeDelta } = region;
    if (latitudeDelta > ZOOM_THRESHOLD) return [];

    const minLat = latitude - latitudeDelta / 2;
    const maxLat = latitude + latitudeDelta / 2;
    const minLon = longitude - longitudeDelta / 2;
    const maxLon = longitude + longitudeDelta / 2;

    const inView = allCourts.filter((c) => {
      if (courtFilter !== "all" && c.type !== courtFilter) return false;
      return (
        c.latitude >= minLat &&
        c.latitude <= maxLat &&
        c.longitude >= minLon &&
        c.longitude <= maxLon
      );
    });

    // Active courts first, then cap hard at MAX_MARKERS
    const active = inView.filter((c) => (playerCounts[c.id] ?? 0) > 0);
    const inactive = inView.filter((c) => (playerCounts[c.id] ?? 0) === 0);
    return [...active, ...inactive].slice(0, MAX_MARKERS);
  }, [region, allCourts, courtFilter, playerCounts]);

  const tooZoomedOut = region ? region.latitudeDelta > ZOOM_THRESHOLD : true;

  const initialRegion = userLocation
    ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.3,
        longitudeDelta: 0.3,
      }
    : INITIAL_REGION;

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        customMapStyle={darkMapStyle}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={handleRegionChange}
      >
        {visibleCourts.map((court) => (
          <CourtMarker
            key={court.id}
            court={court}
            count={playerCounts[court.id] ?? 0}
            onPress={() => setSelectedCourt(court)}
          />
        ))}
      </MapView>

      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <View style={styles.topBarInner}>
          <Text style={styles.topTitle}>HoopQueue</Text>
          <LiveDot />
        </View>
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
      </View>

      {tooZoomedOut && (
        <View style={[styles.zoomHint, { bottom: insets.bottom + 110 }]}>
          <Ionicons name="search-outline" size={15} color={Colors.textSecondary} />
          <Text style={styles.zoomHintText}>Zoom in to see courts</Text>
        </View>
      )}

      {!tooZoomedOut && visibleCourts.length > 0 && (
        <View style={[styles.countBadge, { bottom: insets.bottom + 110 }]}>
          <Text style={styles.countBadgeText}>
            {visibleCourts.length} court{visibleCourts.length !== 1 ? "s" : ""} in view
          </Text>
        </View>
      )}

      {selectedCourt && (
        <View style={[styles.bottomCard, { bottom: insets.bottom + 90 }]}>
          <Pressable onPress={() => setSelectedCourt(null)} style={styles.dismissBtn}>
            <Ionicons name="close" size={18} color={Colors.textSecondary} />
          </Pressable>
          <Text style={styles.bottomCardName}>{selectedCourt.shortName}</Text>
          <Text style={styles.bottomCardAddress}>
            {selectedCourt.city}, {selectedCourt.state}
          </Text>
          <View style={styles.bottomCardStats}>
            <View style={styles.statPill}>
              <View
                style={[
                  styles.statDot,
                  {
                    backgroundColor:
                      (playerCounts[selectedCourt.id] ?? 0) >= selectedCourt.maxPlayers
                        ? Colors.red
                        : (playerCounts[selectedCourt.id] ?? 0) > 0
                        ? Colors.green
                        : Colors.textTertiary,
                  },
                ]}
              />
              <Text style={styles.statText}>
                {playerCounts[selectedCourt.id] ?? 0}/{selectedCourt.maxPlayers} playing
              </Text>
            </View>
            <View style={styles.statPill}>
              <Ionicons
                name={selectedCourt.type === "indoor" ? "business-outline" : "partly-sunny-outline"}
                size={13}
                color={Colors.textSecondary}
              />
              <Text style={styles.statText}>
                {selectedCourt.type === "indoor" ? "Indoor" : "Outdoor"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() =>
              router.push({ pathname: "/court/[id]", params: { id: selectedCourt.id } })
            }
          >
            <Text style={styles.viewBtnText}>View Court</Text>
            <Ionicons name="arrow-forward" size={15} color={Colors.background} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  // Minimal marker — small circle, just count text
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: "rgba(10,10,15,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  dotCount: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
  },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "rgba(10,10,15,0.92)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topBarInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  topTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.accent,
    letterSpacing: -0.5,
  },
  liveContainer: { flexDirection: "row", alignItems: "center", gap: 5 },
  livePulse: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.green,
    opacity: 0.4,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.green },
  liveText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: Colors.green,
    letterSpacing: 1,
  },
  filterRow: { flexDirection: "row", gap: 8 },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  filterTextActive: { color: Colors.background, fontFamily: "Inter_600SemiBold" },
  zoomHint: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(10,10,15,0.88)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  zoomHintText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  countBadge: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(10,10,15,0.88)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  bottomCard: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dismissBtn: { position: "absolute", top: 14, right: 14, padding: 4 },
  bottomCardName: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
    marginBottom: 4,
  },
  bottomCardAddress: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 14,
  },
  bottomCardStats: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statDot: { width: 7, height: 7, borderRadius: 3.5 },
  statText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  viewBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  viewBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.background,
  },
});
