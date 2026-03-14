import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  Alert,
  TextInput,
  Pressable,
  FlatList,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/context/AppContext";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CourtMessage {
  id: string;
  courtId: string;
  userId: string;
  username: string;
  skillLevel: string;
  text: string;
  timestamp: number;
}

// ─── Quick-tap message chips ──────────────────────────────────────────────────

const QUICK_MESSAGES = [
  "Game's going hard 🔥",
  "Need 2 more",
  "Full court 5v5 up",
  "Half court running",
  "It's packed out here",
  "Runs starting up",
  "Good vibes today",
  "Court is clear",
];

// ─── Components ───────────────────────────────────────────────────────────────

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
  positionText: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.textSecondary },
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

function timeAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function MessageBubble({
  msg,
  isMe,
  onLongPress,
}: {
  msg: CourtMessage;
  isMe: boolean;
  onLongPress?: () => void;
}) {
  const skillColors: Record<string, string> = {
    Beginner: "#60A5FA",
    Intermediate: Colors.green,
    Advanced: Colors.accent,
    Pro: "#A855F7",
  };
  const skillColor = skillColors[msg.skillLevel] ?? Colors.textSecondary;

  return (
    <Pressable
      onLongPress={onLongPress}
      style={[msgStyles.container, isMe && msgStyles.containerMe]}
    >
      {!isMe && (
        <View style={[msgStyles.avatar, { backgroundColor: skillColor + "22", borderColor: skillColor + "44" }]}>
          <Text style={[msgStyles.avatarText, { color: skillColor }]}>
            {msg.username.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={[msgStyles.bubble, isMe && msgStyles.bubbleMe]}>
        {!isMe && (
          <View style={msgStyles.senderRow}>
            <Text style={msgStyles.senderName}>{msg.username}</Text>
            <View style={[msgStyles.skillPill, { backgroundColor: skillColor + "22" }]}>
              <Text style={[msgStyles.skillText, { color: skillColor }]}>{msg.skillLevel}</Text>
            </View>
          </View>
        )}
        <Text style={[msgStyles.text, isMe && msgStyles.textMe]}>{msg.text}</Text>
        <Text style={[msgStyles.time, isMe && msgStyles.timeMe]}>{timeAgo(msg.timestamp)}</Text>
      </View>
    </Pressable>
  );
}

const msgStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 16,
    alignItems: "flex-end",
  },
  containerMe: {
    flexDirection: "row-reverse",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexShrink: 0,
  },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  bubble: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 12,
    maxWidth: "78%",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleMe: {
    backgroundColor: Colors.accent,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
    borderColor: Colors.accentLight,
  },
  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  senderName: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.text },
  skillPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  skillText: { fontFamily: "Inter_500Medium", fontSize: 10 },
  text: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.text, lineHeight: 20 },
  textMe: { color: Colors.background },
  time: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.textTertiary, marginTop: 4 },
  timeMe: { color: "rgba(10,10,15,0.6)", textAlign: "right" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CourtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { playerCounts, waitlists, profile, joinWaitlist, leaveWaitlist, isOnWaitlist, getMyPosition, allCourts, fetchCourtWaitlist } = useApp();

  const [isJoinLoading, setIsJoinLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const court = allCourts.find((c) => c.id === id);

  // ── Load waitlist from server ──────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    fetchCourtWaitlist(id);
    const interval = setInterval(() => fetchCourtWaitlist(id), 10000);
    return () => clearInterval(interval);
  }, [id, fetchCourtWaitlist]);

  // ── Messages query (live polling) ──────────────────────────────────────────
  const { data: messages = [] } = useQuery<CourtMessage[]>({
    queryKey: ["/api/courts", id, "messages"],
    refetchInterval: 3000,
    staleTime: 0,
  });

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // ── Send message mutation ──────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!profile) throw new Error("No profile");
      const res = await apiRequest("POST", `/api/courts/${id}/messages`, {
        userId: profile.userId,
        username: profile.username,
        skillLevel: profile.skillLevel,
        text,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/courts", id, "messages"] });
      setInputText("");
      setTimeout(() => inputRef.current?.focus(), 50);
    },
  });

  // ── Delete message mutation ────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (msgId: string) => {
      if (!profile) throw new Error("No profile");
      await apiRequest("DELETE", `/api/courts/${id}/messages/${msgId}`, {
        userId: profile.userId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/courts", id, "messages"] });
    },
  });

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;
    if (!profile) {
      Alert.alert("Set up your profile", "Go to the Profile tab to set your name first.");
      return;
    }
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    sendMutation.mutate(text);
  }, [inputText, profile, sendMutation]);

  const handleQuickMessage = useCallback(async (text: string) => {
    if (!profile) {
      Alert.alert("Set up your profile", "Go to the Profile tab to set your name first.");
      return;
    }
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    sendMutation.mutate(text);
  }, [profile, sendMutation]);

  const handleDeleteMessage = useCallback((msgId: string) => {
    Alert.alert("Delete message", "Remove this message from the feed?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(msgId) },
    ]);
  }, [deleteMutation]);

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
    setIsJoinLoading(true);
    try {
      if (onWaitlist) {
        await leaveWaitlist(court!.id);
      } else {
        const result = await joinWaitlist(court!.id);
        if (!result.ok && result.error) {
          Alert.alert("Can't Join Waitlist", result.error);
        }
      }
    } finally {
      setIsJoinLoading(false);
    }
  }

  if (!court) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: Colors.text, fontFamily: "Inter_500Medium", fontSize: 16 }}>Court not found</Text>
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

  const bottomBarHeight = insets.bottom + 130;

  return (
    <KeyboardAvoidingView
      style={styles.outerContainer}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: bottomBarHeight + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={{ height: insets.top + 56 }} />

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <View style={styles.heroSection}>
          <View style={styles.heroTop}>
            <View style={[styles.typeBadge, court.type === "indoor" ? styles.typeBadgeIndoor : styles.typeBadgeOutdoor]}>
              <Ionicons
                name={court.type === "indoor" ? "business" : "partly-sunny"}
                size={12}
                color={court.type === "indoor" ? "#60A5FA" : Colors.accent}
              />
              <Text style={[styles.typeBadgeText, { color: court.type === "indoor" ? "#60A5FA" : Colors.accent }]}>
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

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        <View style={styles.statsSection}>
          <View style={styles.bigStat}>
            <Text style={styles.bigStatNum}>{count}</Text>
            <Text style={styles.bigStatDivider}>/{court.maxPlayers}</Text>
            <Text style={styles.bigStatLabel}> players</Text>
          </View>
          <View style={styles.bigStatFill}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${fillPercent}%` as any, backgroundColor: statusColor }]} />
            </View>
            <Text style={styles.progressLabel}>{fillPercent}% full</Text>
          </View>
        </View>

        {/* ── Info grid ────────────────────────────────────────────────────── */}
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

        {/* ── Waitlist ─────────────────────────────────────────────────────── */}
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
              {waitlist.map((entry) => (
                <WaitlistItem
                  key={entry.waitId}
                  entry={entry}
                  isMe={entry.userId === profile?.userId}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── My position card ─────────────────────────────────────────────── */}
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

        {/* ── Live Feed ────────────────────────────────────────────────────── */}
        <View style={styles.feedSection}>
          <View style={styles.feedHeader}>
            <View style={styles.feedHeaderLeft}>
              <View style={styles.feedLiveDot} />
              <Text style={styles.feedTitle}>Live Feed</Text>
            </View>
            <Text style={styles.feedCount}>{messages.length} updates</Text>
          </View>

          {messages.length === 0 ? (
            <View style={styles.emptyFeed}>
              <Ionicons name="chatbubbles-outline" size={36} color={Colors.textTertiary} />
              <Text style={styles.emptyFeedTitle}>No updates yet</Text>
              <Text style={styles.emptyFeedSub}>
                Be first to share what's happening at the court
              </Text>
            </View>
          ) : (
            <View style={styles.messagesList}>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isMe={msg.userId === profile?.userId}
                  onLongPress={
                    msg.userId === profile?.userId
                      ? () => handleDeleteMessage(msg.id)
                      : undefined
                  }
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Bottom bar ───────────────────────────────────────────────────────── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        {/* Quick message chips */}
        {inputFocused && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickChips}
            keyboardShouldPersistTaps="always"
          >
            {QUICK_MESSAGES.map((qm) => (
              <TouchableOpacity
                key={qm}
                style={styles.quickChip}
                onPress={() => handleQuickMessage(qm)}
              >
                <Text style={styles.quickChipText}>{qm}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Text input row */}
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={profile ? "What's happening at the court?" : "Set up profile to post..."}
            placeholderTextColor={Colors.textTertiary}
            maxLength={200}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            editable={!!profile}
            multiline={false}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() || sendMutation.isPending) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sendMutation.isPending || !profile}
          >
            <Ionicons
              name="arrow-up"
              size={18}
              color={!inputText.trim() ? Colors.textTertiary : Colors.background}
            />
          </TouchableOpacity>
        </View>

        {/* Join / Leave button */}
        <TouchableOpacity
          style={[
            styles.joinBtn,
            onWaitlist && styles.joinBtnLeave,
            isJoinLoading && styles.joinBtnLoading,
          ]}
          onPress={handleJoinLeave}
          disabled={isJoinLoading}
          activeOpacity={0.85}
        >
          <Ionicons
            name={onWaitlist ? "exit-outline" : "add-circle-outline"}
            size={20}
            color={onWaitlist ? Colors.red : Colors.background}
          />
          <Text style={[styles.joinBtnText, onWaitlist && styles.joinBtnTextLeave]}>
            {isJoinLoading ? "..." : onWaitlist ? "Leave Waitlist" : "Join Waitlist"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 0 },

  heroSection: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 24,
  },
  heroTop: { flexDirection: "row", gap: 10, marginBottom: 16 },
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
  courtAddress: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  statsSection: { marginBottom: 20, paddingHorizontal: 20 },
  bigStat: { flexDirection: "row", alignItems: "baseline", marginBottom: 10 },
  bigStatNum: { fontFamily: "Inter_700Bold", fontSize: 52, color: Colors.text, letterSpacing: -2 },
  bigStatDivider: { fontFamily: "Inter_400Regular", fontSize: 26, color: Colors.textSecondary },
  bigStatLabel: { fontFamily: "Inter_400Regular", fontSize: 18, color: Colors.textSecondary },
  bigStatFill: { gap: 6 },
  progressTrack: { height: 6, backgroundColor: Colors.surface, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },

  infoGrid: { flexDirection: "row", gap: 10, marginBottom: 20, paddingHorizontal: 20 },
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
  infoCellValue: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.text, textAlign: "center" },

  descText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 20,
  },

  waitlistSection: { marginBottom: 20, paddingHorizontal: 20 },
  waitlistHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  waitlistTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text },
  waitlistCount: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
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
  emptyWaitlistText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.textSecondary },
  emptyWaitlistSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textTertiary },

  myPositionCard: {
    backgroundColor: Colors.accentDim,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.accent + "44",
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
    marginHorizontal: 20,
  },
  myPositionLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.accent, marginBottom: 2 },
  myPositionNum: { fontFamily: "Inter_700Bold", fontSize: 28, color: Colors.accent },
  myPositionRight: { alignItems: "flex-end", gap: 6 },
  myPositionHint: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.accent },

  // ── Live Feed ──────────────────────────────────────────────────────────────
  feedSection: { marginBottom: 20 },
  feedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  feedHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  feedLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.green,
  },
  feedTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text },
  feedCount: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  emptyFeed: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyFeedTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.textSecondary },
  emptyFeedSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: "center",
    lineHeight: 20,
  },
  messagesList: { paddingTop: 4, paddingBottom: 8 },

  // ── Bottom bar ─────────────────────────────────────────────────────────────
  bottomBar: {
    backgroundColor: "rgba(10,10,15,0.97)",
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  quickChips: {
    gap: 8,
    paddingBottom: 4,
    paddingHorizontal: 2,
  },
  quickChip: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  quickChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 10,
    minHeight: 40,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: Colors.surface,
  },
  joinBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
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
  joinBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.background },
  joinBtnTextLeave: { color: Colors.red },
});
