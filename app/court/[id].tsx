import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useApp } from "@/context/AppContext";
import { COURTS } from "@/data/courts";
import Colors from "@/constants/colors";

function PulseIndicator({ active }: { active: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.8, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [active]);

  return (
    <View style={pulseStyles.container}>
      {active && (
        <Animated.View
          style={[
            pulseStyles.ring,
            {
              transform: [{ scale: pulse }],
              opacity: pulse.interpolate({ inputRange: [1, 1.8], outputRange: [0.4, 0] }),
            },
          ]}
        />
      )}
      <View style={[pulseStyles.dot, { backgroundColor: active ? Colors.green : Colors.textTertiary }]} />
    </View>
  );
}

const pulseStyles = StyleSheet.create({
  container: { width: 14, height: 14, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.green,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
});

interface WaitEntry {
  waitId: string;
  username: string;
  skillLevel: string;
  position: number;
  userId: string;
}

function WaitlistItem({ entry, isMe }: { entry: WaitEntry; isMe: boolean }) {
  const skillColors: Record<string, string> = {
    Beginner: "#60A5FA",
    Intermediate: Colors.green,
    Advanced: Colors.accent,
    Pro: "#A855F7",
  };
  const color = skillColors[entry.skillLevel] ?? Colors.textSecondary;

  return (
    <View style={[waitStyles.row, isMe && waitStyles.rowMe]}>
      <View style={[waitStyles.position, isMe && waitStyles.positionMe]}>
        <Text style={[waitStyles.positionText, isMe && waitStyles.positionTextMe]}>
          {entry.position}
        </Text>
      </View>
      <View style={waitStyles.info}>
        <Text style={[waitStyles.name, isMe && waitStyles.nameMe]}>
          {entry.username}{isMe ? " (You)" : ""}
        </Text>
        <View style={[waitStyles.badge, { backgroundColor: color + "22" }]}>
          <Text style={[waitStyles.badgeText, { color }]}>{entry.skillLevel}</Text>
        </View>
      </View>
      {isMe && <Ionicons name="person" size={14} color={Colors.accent} />}
    </View>
  );
}

const waitStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowMe: { backgroundColor: Colors.accentDim },
  position: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  positionMe: { backgroundColor: Colors.accent },
  positionText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  positionTextMe: { color: Colors.background },
  info: { flex: 1, gap: 4 },
  name: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.text },
  nameMe: { fontFamily: "Inter_600SemiBold", color: Colors.accent },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  badgeText: { fontFamily: "Inter_500Medium", fontSize: 11 },
});

export default function CourtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { playerCounts, waitlists, profile, joinWaitlist, leaveWaitlist, isOnWaitlist, getMyPosition } = useApp();
  const [isLoading, setIsLoading] = useState(false);

  const court = COURTS.find((c) => c.id === id);

  if (!court) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: Colors.text, fontFamily: "Inter_500Medium", fontSize: 16 }}>
          Court not found
        </Text>
      </View>
    );
  }

  const count = playerCounts[court.id] ?? 0;
  const isFull = count >= court.maxPlayers;
  const isEmpty = count === 0;
  const statusColor = isFull ? Colors.red : isEmpty ? Colors.textTertiary : Colors.green;
  const statusLabel = isFull ? "Full" : isEmpty ? "No Game" : "Active Run";
  const waitlist = (waitlists[court.id] ?? []) as WaitEntry[];
  const onWaitlist = isOnWaitlist(court.id);
  const myPosition = getMyPosition(court.id);
  const fillPercent = Math.round((count / court.maxPlayers) * 100);

  async function handleJoinLeave() {
    if (!profile) {
      Alert.alert(
        "Set up your profile",
        "Go to the Profile tab to set your name before joining a waitlist.",
        [{ text: "OK" }]
      );
      return;
    }
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsLoading(true);
    try {
      if (onWaitlist) {
        await leaveWaitlist(court.id);
      } else {
        await joinWaitlist(court.id);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.outerContainer}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 130 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: insets.top + 56 }} />

        <View style={styles.heroSection}>
          <View style={styles.heroTop}>
            <View
              style={[
                styles.typeBadge,
                court.type === "indoor" ? styles.typeBadgeIndoor : styles.typeBadgeOutdoor,
              ]}
            >
              <Ionicons
                name={court.type === "indoor" ? "business" : "partly-sunny"}
                size={12}
                color={court.type === "indoor" ? "#60A5FA" : Colors.accent}
              />
              <Text
                style={[
                  styles.typeBadgeText,
                  { color: court.type === "indoor" ? "#60A5FA" : Colors.accent },
                ]}
              >
                {court.type === "indoor" ? "Indoor" : "Outdoor"}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
              <PulseIndicator active={!isEmpty && !isFull} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
          <Text style={styles.courtName}>{court.name}</Text>
          <Text style={styles.courtAddress}>{court.address}</Text>
        </View>

        <View style={styles.statsSection}>
          <View style={styles.bigStat}>
            <Text style={styles.bigStatNum}>{count}</Text>
            <Text style={styles.bigStatDivider}>/{court.maxPlayers}</Text>
            <Text style={styles.bigStatLabel}> players</Text>
          </View>
          <View style={styles.bigStatFill}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${fillPercent}%` as any,
                    backgroundColor: statusColor,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>{fillPercent}% full</Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Ionicons name="layers-outline" size={20} color={Colors.accent} />
            <Text style={styles.infoCellLabel}>Surface</Text>
            <Text style={styles.infoCellValue} numberOfLines={1}>
              {court.surface.charAt(0).toUpperCase() + court.surface.slice(1)}
            </Text>
          </View>
          <View style={styles.infoCell}>
            <Ionicons name="basketball-outline" size={20} color={Colors.accent} />
            <Text style={styles.infoCellLabel}>Hoops</Text>
            <Text style={styles.infoCellValue}>{court.hoops}</Text>
          </View>
          <View style={styles.infoCell}>
            <Ionicons name="people-outline" size={20} color={Colors.accent} />
            <Text style={styles.infoCellLabel}>Waiting</Text>
            <Text style={styles.infoCellValue}>{waitlist.length}</Text>
          </View>
        </View>

        <Text style={styles.descText}>{court.description}</Text>

        <View style={styles.waitlistSection}>
          <View style={styles.waitlistHeader}>
            <Text style={styles.waitlistTitle}>Waitlist</Text>
            <Text style={styles.waitlistCount}>{waitlist.length} in queue</Text>
          </View>

          {waitlist.length === 0 ? (
            <View style={styles.emptyWaitlist}>
              <Ionicons name="time-outline" size={32} color={Colors.textTertiary} />
              <Text style={styles.emptyWaitlistText}>No one waiting</Text>
              <Text style={styles.emptyWaitlistSub}>Be the first to join the queue</Text>
            </View>
          ) : (
            <View style={styles.waitlistList}>
              {waitlist.map((entry, index) => (
                <WaitlistItem
                  key={entry.waitId}
                  entry={entry}
                  isMe={entry.userId === profile?.userId}
                />
              ))}
            </View>
          )}
        </View>

        {onWaitlist && myPosition != null && (
          <View style={styles.myPositionCard}>
            <View>
              <Text style={styles.myPositionLabel}>Your position</Text>
              <Text style={styles.myPositionNum}>#{myPosition}</Text>
            </View>
            <View style={styles.myPositionRight}>
              <Ionicons name="notifications-outline" size={18} color={Colors.accent} />
              <Text style={styles.myPositionHint}>
                {myPosition === 1 ? "You're up next!" : `${myPosition - 1} ahead of you`}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[
            styles.joinBtn,
            onWaitlist && styles.joinBtnLeave,
            isLoading && styles.joinBtnLoading,
          ]}
          onPress={handleJoinLeave}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          <Ionicons
            name={onWaitlist ? "exit-outline" : "add-circle-outline"}
            size={20}
            color={onWaitlist ? Colors.red : Colors.background}
          />
          <Text style={[styles.joinBtnText, onWaitlist && styles.joinBtnTextLeave]}>
            {isLoading ? "..." : onWaitlist ? "Leave Waitlist" : "Join Waitlist"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
  },
  heroSection: {
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 24,
  },
  heroTop: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  typeBadgeIndoor: { backgroundColor: "rgba(96, 165, 250, 0.15)" },
  typeBadgeOutdoor: { backgroundColor: Colors.accentDim },
  typeBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  courtName: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 8,
    lineHeight: 32,
  },
  courtAddress: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  statsSection: { marginBottom: 20 },
  bigStat: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 10,
  },
  bigStatNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 52,
    color: Colors.text,
    letterSpacing: -2,
  },
  bigStatDivider: {
    fontFamily: "Inter_400Regular",
    fontSize: 26,
    color: Colors.textSecondary,
  },
  bigStatLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 18,
    color: Colors.textSecondary,
  },
  bigStatFill: { gap: 6 },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  progressLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  infoGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  infoCell: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  infoCellLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoCellValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.text,
    textAlign: "center",
  },
  descText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },
  waitlistSection: { marginBottom: 20 },
  waitlistHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  waitlistTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
  },
  waitlistCount: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  waitlistList: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  emptyWaitlist: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyWaitlistText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.textSecondary,
  },
  emptyWaitlistSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textTertiary,
  },
  myPositionCard: {
    backgroundColor: Colors.accentDim,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.accent + "44",
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  myPositionLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.accent,
    marginBottom: 2,
  },
  myPositionNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.accent,
  },
  myPositionRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  myPositionHint: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.accent,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(10,10,15,0.97)",
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  joinBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  joinBtnLeave: {
    backgroundColor: Colors.redDim,
    borderWidth: 1,
    borderColor: Colors.red + "55",
  },
  joinBtnLoading: { opacity: 0.6 },
  joinBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: Colors.background,
  },
  joinBtnTextLeave: { color: Colors.red },
});
