import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
} from "react-native";
import { useRef, useEffect } from "react";
import MapView, { Marker } from "react-native-maps";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { Court, COURTS, INITIAL_REGION } from "@/data/courts";
import Colors from "@/constants/colors";

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
  const borderColor = isFull ? Colors.red : count > 0 ? Colors.green : Colors.textTertiary;
  return (
    <Marker
      coordinate={{ latitude: court.latitude, longitude: court.longitude }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View style={[styles.markerContainer, { borderColor }]}>
        <Text style={styles.markerCount}>{count}</Text>
        <Ionicons
          name={court.type === "indoor" ? "business" : "sunny"}
          size={9}
          color={borderColor}
        />
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
  const { playerCounts, courtFilter, setCourtFilter } = useApp();
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={INITIAL_REGION}
        customMapStyle={darkMapStyle}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {COURTS.map((court) => (
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
          <Text style={styles.topTitle}>RunUp</Text>
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

      {selectedCourt && (
        <View style={[styles.bottomCard, { bottom: insets.bottom + 90 }]}>
          <Pressable onPress={() => setSelectedCourt(null)} style={styles.dismissBtn}>
            <Ionicons name="close" size={18} color={Colors.textSecondary} />
          </Pressable>
          <Text style={styles.bottomCardName}>{selectedCourt.shortName}</Text>
          <Text style={styles.bottomCardAddress}>{selectedCourt.address}</Text>
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
  markerContainer: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 2,
  },
  markerCount: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.text,
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
