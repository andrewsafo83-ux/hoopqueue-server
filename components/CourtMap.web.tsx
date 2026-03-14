
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import { usePlayerCounts } from "@/context/PlayerCountsContext";
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
          <Text style={styles.cardName} numberOfLines={1}>{court.shortName}</Text>
          <Text style={styles.cardCity}>{court.city}, {court.stateAbbr}</Text>
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

function StatePicker({
  visible, selected, onSelect, onClose, availableStates,
}: {
  visible: boolean; selected: string;
  onSelect: (s: string) => void; onClose: () => void;
  availableStates: { name: string; abbr: string }[];
}) {
  const insets = useSafeAreaInsets();
  const options = [{ name: "All States", abbr: "" }, ...availableStates];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + 34 }]}>
          <View style={styles.pickerHandle} />
          <Text style={styles.pickerTitle}>Filter by State</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {options.map((s) => (
              <TouchableOpacity
                key={s.abbr || "all"}
                style={styles.pickerItem}
                onPress={() => { onSelect(s.name); onClose(); }}
              >
                <Text style={[styles.pickerItemText, selected === s.name && { color: Colors.accent }]}>
                  {s.name}
                </Text>
                {selected === s.name && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

function CityPicker({
  visible, selected, onSelect, onClose, availableCities,
}: {
  visible: boolean; selected: string;
  onSelect: (c: string) => void; onClose: () => void;
  availableCities: string[];
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + 34 }]}>
          <View style={styles.pickerHandle} />
          <Text style={styles.pickerTitle}>Filter by City</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {availableCities.map((city) => (
              <TouchableOpacity
                key={city}
                style={styles.pickerItem}
                onPress={() => { onSelect(city); onClose(); }}
              >
                <Text style={[styles.pickerItemText, selected === city && { color: Colors.accent }]}>
                  {city}
                </Text>
                {selected === city && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function CourtMap() {
  const insets = useSafeAreaInsets();
  const {
    courts, courtFilter, setCourtFilter,
    cityFilter, setCityFilter, availableCities,
    stateFilter, setStateFilter, availableStates,
    allCourts,
  } = useApp();
  const { playerCounts } = usePlayerCounts();
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const activeCourts = courts.filter((c) => (playerCounts[c.id] ?? 0) > 0).length;
  const stateIsFiltered = stateFilter !== "All States";
  const cityIsFiltered = cityFilter !== "All Cities";
  const tooMany = courts.length > 200 && !stateIsFiltered;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 67 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>HoopQueue</Text>
          <Text style={styles.headerSub}>{activeCourts} active · {courts.length} courts</Text>
        </View>
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
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
        <TouchableOpacity
          style={[styles.cityBtn, stateIsFiltered && styles.filterBtnActive]}
          onPress={() => setShowStatePicker(true)}
        >
          <Ionicons name="map-outline" size={13} color={stateIsFiltered ? Colors.background : Colors.textSecondary} />
          <Text style={[styles.filterText, stateIsFiltered && styles.filterTextActive]} numberOfLines={1}>
            {stateIsFiltered ? stateFilter : "State"}
          </Text>
          <Ionicons name="chevron-down" size={12} color={stateIsFiltered ? Colors.background : Colors.textSecondary} />
        </TouchableOpacity>
        {stateIsFiltered && (
          <TouchableOpacity
            style={[styles.cityBtn, cityIsFiltered && styles.filterBtnActive]}
            onPress={() => setShowCityPicker(true)}
          >
            <Ionicons name="location-outline" size={13} color={cityIsFiltered ? Colors.background : Colors.textSecondary} />
            <Text style={[styles.filterText, cityIsFiltered && styles.filterTextActive]} numberOfLines={1}>
              {cityIsFiltered ? cityFilter : "City"}
            </Text>
            <Ionicons name="chevron-down" size={12} color={cityIsFiltered ? Colors.background : Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {tooMany ? (
        <View style={styles.promptContainer}>
          <Ionicons name="map-outline" size={48} color={Colors.accent} />
          <Text style={styles.promptTitle}>Select a State</Text>
          <Text style={styles.promptSub}>
            {allCourts.length.toLocaleString()} courts across the US.{"\n"}Pick a state to browse.
          </Text>
          <TouchableOpacity style={styles.promptBtn} onPress={() => setShowStatePicker(true)}>
            <Text style={styles.promptBtnText}>Choose State</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 34 }]}
          showsVerticalScrollIndicator={false}
        >
          {courts.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="basketball-outline" size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No courts found</Text>
              <Text style={styles.emptySub}>Try adjusting your filters</Text>
            </View>
          ) : (
            courts.map((court) => (
              <CourtCard key={court.id} court={court} count={playerCounts[court.id] ?? 0} />
            ))
          )}
        </ScrollView>
      )}

      <StatePicker
        visible={showStatePicker}
        selected={stateFilter}
        onSelect={(s) => { setStateFilter(s); setCityFilter("All Cities"); }}
        onClose={() => setShowStatePicker(false)}
        availableStates={availableStates}
      />
      <CityPicker
        visible={showCityPicker}
        selected={cityFilter}
        onSelect={setCityFilter}
        onClose={() => setShowCityPicker(false)}
        availableCities={availableCities}
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
    paddingBottom: 10,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.accent,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.green },
  liveText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: Colors.green,
    letterSpacing: 1,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  cityBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 160,
  },
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
  cardName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  cardCity: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.accent, marginTop: 1 },
  cardRight: { flexDirection: "row", alignItems: "baseline" },
  countNum: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text },
  countMax: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary },
  progressBar: { height: 3, backgroundColor: Colors.surface, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.textSecondary },
  emptySub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textTertiary },
  promptContainer: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 40, gap: 14,
  },
  promptTitle: {
    fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text, textAlign: "center",
  },
  promptSub: {
    fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary,
    textAlign: "center", lineHeight: 22,
  },
  promptBtn: {
    backgroundColor: Colors.accent, paddingHorizontal: 24,
    paddingVertical: 12, borderRadius: 12, marginTop: 6,
  },
  promptBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.background },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  pickerSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: "70%",
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  pickerHandle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: "center", marginBottom: 16,
  },
  pickerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text, marginBottom: 12 },
  pickerItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pickerItemText: { fontFamily: "Inter_500Medium", fontSize: 15, color: Colors.text },
});
