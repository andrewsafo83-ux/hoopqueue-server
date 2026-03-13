import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Pressable,
  Modal,
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
  const statusLabel = isFull ? "Full" : isEmpty ? "Empty" : "Active";

  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  }
  function handlePressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => router.push({ pathname: "/court/[id]", params: { id: court.id } })}
        style={styles.card}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardTitleRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.cardName} numberOfLines={1}>{court.shortName}</Text>
              <Text style={styles.cardCity}>{court.city}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
              <View style={[styles.badgeDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Ionicons
              name={court.type === "indoor" ? "business-outline" : "partly-sunny-outline"}
              size={13}
              color={Colors.textSecondary}
            />
            <Text style={styles.metaText}>
              {court.type === "indoor" ? "Indoor" : "Outdoor"}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="layers-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{court.surface}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="basketball-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{court.hoops} hoops</Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <View style={styles.playersBlock}>
            <Text style={styles.playersCount}>{count}</Text>
            <Text style={styles.playersMax}>/{court.maxPlayers}</Text>
            <Text style={styles.playersLabel}> playing</Text>
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
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function CityPicker({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (city: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.pickerHandle} />
          <Text style={styles.pickerTitle}>Filter by City</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {availableCities.map((city) => (
              <TouchableOpacity
                key={city}
                style={[styles.pickerItem, selected === city && styles.pickerItemActive]}
                onPress={() => { onSelect(city); onClose(); }}
              >
                <Text style={[styles.pickerItemText, selected === city && styles.pickerItemTextActive]}>
                  {city}
                </Text>
                {selected === city && (
                  <Ionicons name="checkmark" size={18} color={Colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function CourtsScreen() {
  const insets = useSafeAreaInsets();
  const { courts, playerCounts, courtFilter, setCourtFilter, cityFilter, setCityFilter, availableCities } = useApp();
  const [showCityPicker, setShowCityPicker] = useState(false);

  const activeCourts = courts.filter((c) => (playerCounts[c.id] ?? 0) > 0).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Courts</Text>
          <Text style={styles.headerSub}>
            {activeCourts} active · {courts.length} total
          </Text>
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
          style={[styles.cityBtn, cityFilter !== "All Cities" && styles.cityBtnActive]}
          onPress={() => setShowCityPicker(true)}
        >
          <Ionicons
            name="location-outline"
            size={13}
            color={cityFilter !== "All Cities" ? Colors.background : Colors.textSecondary}
          />
          <Text
            style={[styles.filterText, cityFilter !== "All Cities" && styles.filterTextActive]}
            numberOfLines={1}
          >
            {cityFilter === "All Cities" ? "City" : cityFilter}
          </Text>
          <Ionicons
            name="chevron-down"
            size={12}
            color={cityFilter !== "All Cities" ? Colors.background : Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {courts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="basketball-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No courts found</Text>
            <Text style={styles.emptySub}>Try changing your filters</Text>
          </View>
        ) : (
          courts.map((court) => (
            <CourtCard key={court.id} court={court} count={playerCounts[court.id] ?? 0} />
          ))
        )}
      </ScrollView>

      <CityPicker
        visible={showCityPicker}
        selected={cityFilter}
        onSelect={setCityFilter}
        onClose={() => setShowCityPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
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
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  filterBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
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
    maxWidth: 140,
  },
  cityBtnActive: {
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
    gap: 10,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  cardTop: {
    marginBottom: 10,
  },
  cardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  cardMeta: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "capitalize",
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  playersBlock: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  playersCount: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
  },
  playersMax: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  playersLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  progressBar: {
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
    fontSize: 18,
    color: Colors.textSecondary,
  },
  emptySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textTertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: "75%",
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  pickerHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  pickerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.text,
    marginBottom: 12,
  },
  pickerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerItemActive: {
    backgroundColor: "transparent",
  },
  pickerItemText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.text,
  },
  pickerItemTextActive: {
    color: Colors.accent,
    fontFamily: "Inter_600SemiBold",
  },
});
