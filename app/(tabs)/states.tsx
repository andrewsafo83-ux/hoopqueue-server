
import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import { usePlayerCounts } from "@/context/PlayerCountsContext";
import { US_STATES } from "@/data/courts";
import Colors from "@/constants/colors";

const STATE_EMOJIS: Record<string, string> = {
  AL:"🏈",AK:"🐻",AZ:"🌵",AR:"💎",CA:"🌴",CO:"⛰️",CT:"🦞",DE:"🦅",FL:"🌊",GA:"🍑",
  HI:"🌺",ID:"🥔",IL:"🌃",IN:"🏎️",IA:"🌽",KS:"🌾",KY:"🏇",LA:"🎷",ME:"🦞",MD:"🦀",
  MA:"🦞",MI:"🚗",MN:"❄️",MS:"🎸",MO:"🦘",MT:"🏔️",NE:"🌽",NV:"🎰",NH:"🍂",NJ:"🗽",
  NM:"🌶️",NY:"🗽",NC:"🏀",ND:"🌾",OH:"✈️",OK:"🌪️",OR:"🌲",PA:"🔔",RI:"⚓",SC:"🌊",
  SD:"🦬",TN:"🎸",TX:"🤠",UT:"🏜️",VT:"🍁",VA:"🏛️",WA:"☕",WV:"⛏️",WI:"🧀",WY:"🦬",
};

export default function StatesScreen() {
  const insets = useSafeAreaInsets();
  const { allCourts, setStateFilter, setCityFilter } = useApp();
  const { playerCounts } = usePlayerCounts();

  const stateStats = useMemo(() => {
    const counts: Record<string, number> = {};
    const active: Record<string, number> = {};
    for (const c of allCourts) {
      counts[c.stateAbbr] = (counts[c.stateAbbr] ?? 0) + 1;
      if ((playerCounts[c.id] ?? 0) > 0) {
        active[c.stateAbbr] = (active[c.stateAbbr] ?? 0) + 1;
      }
    }
    return { counts, active };
  }, [allCourts, playerCounts]);

  const totalActive = useMemo(() => {
    return Object.values(stateStats.active).reduce((a, b) => a + b, 0);
  }, [stateStats.active]);

  function handleSelectState(stateName: string) {
    setStateFilter(stateName);
    setCityFilter("All Cities");
    router.navigate("/(tabs)/courts");
  }

  function renderItem({ item }: { item: { name: string; abbr: string } }) {
    const count = stateStats.counts[item.abbr] ?? 0;
    const activeCount = stateStats.active[item.abbr] ?? 0;
    const emoji = STATE_EMOJIS[item.abbr] ?? "🏀";

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => handleSelectState(item.name)}
        activeOpacity={0.7}
      >
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={styles.rowInfo}>
          <Text style={styles.stateName}>{item.name}</Text>
          <Text style={styles.stateSub}>
            {count} courts
            {activeCount > 0 && (
              <Text style={styles.activeText}> · {activeCount} active</Text>
            )}
          </Text>
        </View>
        <View style={styles.rowRight}>
          {activeCount > 0 && (
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeBadgeText}>Live</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>States</Text>
          <Text style={styles.headerSub}>
            {allCourts.length} courts · {totalActive} active now
          </Text>
        </View>
        <View style={styles.usaBadge}>
          <Text style={styles.usaFlag}>🇺🇸</Text>
        </View>
      </View>

      <FlatList
        data={US_STATES}
        keyExtractor={(item) => item.abbr}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
  usaBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  usaFlag: {
    fontSize: 22,
  },
  list: {
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 14,
  },
  emoji: {
    fontSize: 26,
    width: 36,
    textAlign: "center",
  },
  rowInfo: {
    flex: 1,
  },
  stateName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
    marginBottom: 2,
  },
  stateSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  activeText: {
    color: Colors.green,
    fontFamily: "Inter_500Medium",
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.greenDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.green,
  },
  activeBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.green,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 50,
  },
});
