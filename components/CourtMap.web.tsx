import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import { Court } from "@/data/courts";
import Colors from "@/constants/colors";

function CourtCard({ court, count }: { court: Court; count: number }) {
  const isFull = count >= court.maxPlayers;
  const isEmpty = count === 0;
  const statusColor = isFull ? Colors.red : isEmpty ? Colors.textTertiary : Colors.green;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      onPress={() => router.push({ pathname: "/court/[id]", params: { id: court.id } })}
    >
      <View style={styles.cardRow}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>
            {court.shortName}
          </Text>
          <Text style={styles.cardAddress} numberOfLines={1}>
            {court.address}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.countNum}>{count}</Text>
          <Text style={styles.countMax}>/{court.maxPlayers}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </View>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.round((count / court.maxPlayers) * 100)}%`,
              backgroundColor: statusColor,
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

export default function CourtMap() {
  const insets = useSafeAreaInsets();
  const { courts, playerCounts, courtFilter, setCourtFilter } = useApp();
  const activeCourts = courts.filter((c) => (playerCounts[c.id] ?? 0) > 0).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 67 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>RunUp</Text>
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>
      <Text style={styles.subTitle}>{activeCourts} active courts near you</Text>

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

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {courts.map((court) => (
          <CourtCard key={court.id} court={court} count={playerCounts[court.id] ?? 0} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.accent,
    letterSpacing: -0.5,
  },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.green },
  liveText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: Colors.green,
    letterSpacing: 1,
  },
  subTitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  filterTextActive: { color: Colors.background, fontFamily: "Inter_600SemiBold" },
  list: { paddingHorizontal: 16, gap: 8 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
    gap: 12,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  cardInfo: { flex: 1 },
  cardName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  cardAddress: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cardRight: { flexDirection: "row", alignItems: "baseline" },
  countNum: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text },
  countMax: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary },
  progressBar: {
    height: 3,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2 },
});
