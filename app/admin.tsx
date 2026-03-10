import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useApp } from "@/context/AppContext";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

const ADMIN_USER_ID = "17731833451956z1lxkg";

const SKILL_COLORS: Record<string, string> = {
  Beginner: "#60A5FA",
  Intermediate: Colors.green,
  Advanced: Colors.accent,
  Pro: "#A855F7",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface AdminStats {
  totalUsers: number;
  skillBreakdown: { skill_level: string; count: string }[];
  newToday: number;
  newThisWeek: number;
  totalFriendships: number;
  pendingRequests: number;
  totalDMs: number;
  totalCourts: number;
  recentUsers: { username: string; skill_level: string; email: string; created_at: string }[];
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useApp();

  const { data, isLoading, refetch, isRefetching } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats", profile?.userId],
    enabled: profile?.userId === ADMIN_USER_ID,
    refetchInterval: 30000,
  });

  if (profile?.userId !== ADMIN_USER_ID) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="lock-closed" size={48} color={Colors.textTertiary} />
        <Text style={styles.lockedText}>Access denied</Text>
      </View>
    );
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPad }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={Colors.accent}
        />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>Pull to refresh · updates every 30s</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading stats...</Text>
        </View>
      ) : data ? (
        <>
          {/* Growth */}
          <Text style={styles.sectionLabel}>Growth</Text>
          <View style={styles.statGrid}>
            <View style={styles.bigStatBox}>
              <Text style={styles.bigStatValue}>{data.totalUsers}</Text>
              <Text style={styles.bigStatKey}>Total Players</Text>
            </View>
            <View style={styles.smallStatCol}>
              <View style={[styles.smallStatBox, { marginBottom: 8 }]}>
                <Text style={[styles.smallStatValue, { color: Colors.green }]}>{data.newToday}</Text>
                <Text style={styles.smallStatKey}>Today</Text>
              </View>
              <View style={styles.smallStatBox}>
                <Text style={[styles.smallStatValue, { color: Colors.accent }]}>{data.newThisWeek}</Text>
                <Text style={styles.smallStatKey}>This Week</Text>
              </View>
            </View>
          </View>

          {/* Skill Breakdown */}
          <Text style={styles.sectionLabel}>Players by Level</Text>
          <View style={styles.card}>
            {data.skillBreakdown.map((row, i) => {
              const color = SKILL_COLORS[row.skill_level] ?? Colors.textSecondary;
              const pct = data.totalUsers > 0 ? (parseInt(row.count) / data.totalUsers) * 100 : 0;
              return (
                <View key={row.skill_level}>
                  <View style={styles.skillRow}>
                    <View style={styles.skillRowLeft}>
                      <View style={[styles.skillDot, { backgroundColor: color }]} />
                      <Text style={styles.skillName}>{row.skill_level}</Text>
                    </View>
                    <Text style={[styles.skillCount, { color }]}>{row.count}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                  </View>
                  {i < data.skillBreakdown.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </View>

          {/* Social */}
          <Text style={styles.sectionLabel}>Social Activity</Text>
          <View style={styles.rowGrid}>
            <View style={styles.rowStatBox}>
              <Ionicons name="people-outline" size={22} color={Colors.accent} />
              <Text style={styles.rowStatValue}>{data.totalFriendships}</Text>
              <Text style={styles.rowStatKey}>Friendships</Text>
            </View>
            <View style={styles.rowStatBox}>
              <Ionicons name="time-outline" size={22} color="#60A5FA" />
              <Text style={styles.rowStatValue}>{data.pendingRequests}</Text>
              <Text style={styles.rowStatKey}>Pending</Text>
            </View>
            <View style={styles.rowStatBox}>
              <Ionicons name="chatbubble-outline" size={22} color={Colors.green} />
              <Text style={styles.rowStatValue}>{data.totalDMs}</Text>
              <Text style={styles.rowStatKey}>DMs Sent</Text>
            </View>
          </View>

          {/* Courts */}
          <Text style={styles.sectionLabel}>Platform</Text>
          <View style={styles.card}>
            <View style={styles.platformRow}>
              <View style={styles.platformLeft}>
                <Ionicons name="location-outline" size={20} color={Colors.accent} />
                <Text style={styles.platformLabel}>Courts Listed</Text>
              </View>
              <Text style={[styles.platformValue, { color: Colors.accent }]}>{data.totalCourts}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.platformRow}>
              <View style={styles.platformLeft}>
                <Ionicons name="map-outline" size={20} color="#60A5FA" />
                <Text style={styles.platformLabel}>Coverage</Text>
              </View>
              <Text style={[styles.platformValue, { color: "#60A5FA" }]}>California</Text>
            </View>
          </View>

          {/* Recent Signups */}
          <Text style={styles.sectionLabel}>Recent Signups</Text>
          <View style={styles.card}>
            {data.recentUsers.map((u, i) => {
              const color = SKILL_COLORS[u.skill_level] ?? Colors.textSecondary;
              return (
                <View key={u.email}>
                  <View style={styles.userRow}>
                    <View style={[styles.userAvatar, { backgroundColor: color + "22" }]}>
                      <Text style={[styles.userAvatarText, { color }]}>
                        {u.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{u.username}</Text>
                      <Text style={styles.userEmail}>{u.email}</Text>
                    </View>
                    <View style={styles.userRight}>
                      <View style={[styles.levelBadge, { backgroundColor: color + "22" }]}>
                        <Text style={[styles.levelBadgeText, { color }]}>{u.skill_level}</Text>
                      </View>
                      <Text style={styles.userTime}>{timeAgo(u.created_at)}</Text>
                    </View>
                  </View>
                  {i < data.recentUsers.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 80 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 28 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.text },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  lockedText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.textTertiary },
  loadingText: { fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.textSecondary },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 24,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },

  // Growth grid
  statGrid: { flexDirection: "row", gap: 10 },
  bigStatBox: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 20, alignItems: "center", justifyContent: "center",
  },
  bigStatValue: { fontFamily: "Inter_700Bold", fontSize: 48, color: Colors.text, lineHeight: 56 },
  bigStatKey: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  smallStatCol: { flex: 1, gap: 0 },
  smallStatBox: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  smallStatValue: { fontFamily: "Inter_700Bold", fontSize: 28, color: Colors.text },
  smallStatKey: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },

  // Skill breakdown
  skillRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  skillRowLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  skillDot: { width: 8, height: 8, borderRadius: 4 },
  skillName: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.text },
  skillCount: { fontFamily: "Inter_700Bold", fontSize: 14 },
  barTrack: { height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: "hidden" },
  barFill: { height: 4, borderRadius: 2 },

  // Social row
  rowGrid: { flexDirection: "row", gap: 8 },
  rowStatBox: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, alignItems: "center", gap: 6,
  },
  rowStatValue: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.text },
  rowStatKey: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary },

  // Platform
  platformRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  platformLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  platformLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.text },
  platformValue: { fontFamily: "Inter_700Bold", fontSize: 14 },

  // Recent users
  userRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  userAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
  userAvatarText: { fontFamily: "Inter_700Bold", fontSize: 16 },
  userInfo: { flex: 1 },
  userName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  userEmail: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  userRight: { alignItems: "flex-end", gap: 4 },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  levelBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  userTime: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textTertiary },
});
