import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
  Modal,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useApp } from "@/context/AppContext";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

const SKILL_COLORS: Record<string, string> = {
  Beginner: "#60A5FA",
  Intermediate: Colors.green,
  Advanced: Colors.accent,
  Pro: "#A855F7",
};

function timeAgo(dateStr: string): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface AdminStats {
  totalUsers: number;
  skillBreakdown: { skill_level: string; count: string }[];
  newToday: number;
  newThisWeek: number;
  totalFriendships: number;
  pendingRequests: number;
  totalDMs: number;
  totalPosts: number;
  totalComments: number;
  totalLikes: number;
  activeWaitlists: number;
  totalCourts: number;
  recentUsers: UserRow[];
}

interface UserRow {
  user_id: string;
  username: string;
  handle: string | null;
  email: string;
  phone: string | null;
  skill_level: string;
  device_id: string | null;
  last_ip: string | null;
  created_at: string;
  last_seen_at: string | null;
  post_count: string;
  comment_count: string;
  like_count: string;
  dm_count: string;
  waitlist_count: string;
}

interface AllUsersResponse {
  users: UserRow[];
  total: number;
}

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: string }) {
  return (
    <View style={[styles.statCard, { borderColor: color + "33" }]}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function UserDetailModal({ user, visible, onClose }: { user: UserRow | null; visible: boolean; onClose: () => void }) {
  if (!user) return null;
  const color = SKILL_COLORS[user.skill_level] ?? Colors.textSecondary;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>User Details</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
          <View style={[styles.modalAvatar, { backgroundColor: color + "22" }]}>
            <Text style={[styles.modalAvatarText, { color }]}>{user.username.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.modalName}>{user.username}</Text>
          {user.handle && <Text style={styles.modalHandle}>@{user.handle}</Text>}
          <View style={[styles.levelBadge, { backgroundColor: color + "22", alignSelf: "center", marginTop: 8 }]}>
            <Text style={[styles.levelBadgeText, { color }]}>{user.skill_level}</Text>
          </View>

          <Text style={styles.detailSectionTitle}>Contact</Text>
          <View style={styles.detailCard}>
            <DetailRow icon="mail-outline" label="Email" value={user.email || "—"} />
            <View style={styles.detailDivider} />
            <DetailRow icon="call-outline" label="Phone" value={user.phone || "—"} />
          </View>

          <Text style={styles.detailSectionTitle}>Activity</Text>
          <View style={styles.detailCard}>
            <View style={styles.activityGrid}>
              <ActivityStat label="Posts" value={user.post_count} color={Colors.accent} />
              <ActivityStat label="Comments" value={user.comment_count} color="#60A5FA" />
              <ActivityStat label="Likes" value={user.like_count} color="#F59E0B" />
              <ActivityStat label="DMs" value={user.dm_count} color={Colors.green} />
              <ActivityStat label="Waitlists" value={user.waitlist_count} color="#A855F7" />
            </View>
          </View>

          <Text style={styles.detailSectionTitle}>Device & Access</Text>
          <View style={styles.detailCard}>
            <DetailRow icon="phone-portrait-outline" label="Device ID" value={user.device_id ? user.device_id.substring(0, 20) + "..." : "Unknown"} />
            <View style={styles.detailDivider} />
            <DetailRow icon="globe-outline" label="Last IP" value={user.last_ip || "Unknown"} />
            <View style={styles.detailDivider} />
            <DetailRow icon="time-outline" label="Joined" value={new Date(user.created_at).toLocaleDateString()} />
            <View style={styles.detailDivider} />
            <DetailRow icon="pulse-outline" label="Last Seen" value={timeAgo(user.last_seen_at || user.created_at)} />
          </View>

          <Text style={styles.detailSectionTitle}>User ID</Text>
          <View style={styles.detailCard}>
            <Text style={styles.userIdText}>{user.user_id}</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailRowLeft}>
        <Ionicons name={icon as any} size={16} color={Colors.textSecondary} />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function ActivityStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.activityStat}>
      <Text style={[styles.activityValue, { color }]}>{value}</Text>
      <Text style={styles.activityLabel}>{label}</Text>
    </View>
  );
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useApp();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "analytics">("overview");
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const adminCheckQuery = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check", profile?.userId],
    enabled: !!profile?.userId,
    queryFn: async () => {
      const url = new URL("/api/admin/check", getApiUrl());
      url.searchParams.set("userId", profile!.userId);
      const res = await fetch(url.toString());
      return res.json();
    },
  });
  const isAdmin = adminCheckQuery.data?.isAdmin ?? false;

  const statsQuery = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats", profile?.userId],
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const usersQuery = useQuery<AllUsersResponse>({
    queryKey: ["/api/admin/all-users", profile?.userId, debouncedSearch],
    enabled: isAdmin && activeTab === "users",
    queryFn: async () => {
      const url = new URL("/api/admin/all-users", getApiUrl());
      url.searchParams.set("userId", profile!.userId);
      if (debouncedSearch) url.searchParams.set("search", debouncedSearch);
      url.searchParams.set("limit", "100");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const analyticsQuery = useQuery<{
    eventCounts: { event: string; count: string }[];
    dailyActive: { date: string; dau: string }[];
    topEventsThisWeek: { event: string; count: string }[];
    platformSplit: { platform: string; count: string }[];
    recentEvents: { event: string; user_id: string; username: string; email: string; properties: any; platform: string; created_at: string }[];
  }>({
    queryKey: ["/api/admin/analytics", profile?.userId],
    enabled: isAdmin && activeTab === "analytics",
    queryFn: async () => {
      const url = new URL("/api/admin/analytics", getApiUrl());
      url.searchParams.set("userId", profile!.userId);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    clearTimeout((handleSearchChange as any)._timer);
    (handleSearchChange as any)._timer = setTimeout(() => setDebouncedSearch(text), 400);
  }, []);

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="lock-closed" size={48} color={Colors.textTertiary} />
        <Text style={styles.lockedText}>Access denied</Text>
      </View>
    );
  }

  const data = statsQuery.data;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>{data ? `${data.totalUsers} users · ${data.totalCourts} courts` : "Loading..."}</Text>
        </View>
        <TouchableOpacity onPress={() => { statsQuery.refetch(); usersQuery.refetch(); }} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "overview" && styles.tabActive]}
          onPress={() => setActiveTab("overview")}
        >
          <Text style={[styles.tabText, activeTab === "overview" && styles.tabTextActive]}>Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "users" && styles.tabActive]}
          onPress={() => setActiveTab("users")}
        >
          <Text style={[styles.tabText, activeTab === "users" && styles.tabTextActive]}>
            Users{data ? ` (${data.totalUsers})` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "analytics" && styles.tabActive]}
          onPress={() => setActiveTab("analytics")}
        >
          <Text style={[styles.tabText, activeTab === "analytics" && styles.tabTextActive]}>Analytics</Text>
        </TouchableOpacity>
      </View>

      {activeTab === "overview" ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={statsQuery.isRefetching} onRefresh={statsQuery.refetch} tintColor={Colors.accent} />}
        >
          {statsQuery.isLoading ? (
            <View style={styles.center}><Text style={styles.loadingText}>Loading...</Text></View>
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

              {/* Content Stats */}
              <Text style={styles.sectionLabel}>Content</Text>
              <View style={styles.statRow}>
                <StatCard label="Posts" value={data.totalPosts} color={Colors.accent} icon="image-outline" />
                <StatCard label="Comments" value={data.totalComments} color="#60A5FA" icon="chatbubble-outline" />
                <StatCard label="Likes" value={data.totalLikes} color="#F59E0B" icon="heart-outline" />
              </View>

              {/* Social */}
              <Text style={styles.sectionLabel}>Social</Text>
              <View style={styles.statRow}>
                <StatCard label="Friends" value={data.totalFriendships} color={Colors.green} icon="people-outline" />
                <StatCard label="Pending" value={data.pendingRequests} color="#A855F7" icon="time-outline" />
                <StatCard label="DMs Sent" value={data.totalDMs} color="#F87171" icon="mail-outline" />
              </View>

              {/* Platform */}
              <Text style={styles.sectionLabel}>Platform</Text>
              <View style={styles.statRow}>
                <StatCard label="Courts" value={data.totalCourts} color={Colors.accent} icon="location-outline" />
                <StatCard label="Waitlists" value={data.activeWaitlists} color="#60A5FA" icon="list-outline" />
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
                        <Text style={[styles.skillCount, { color }]}>{row.count} ({pct.toFixed(0)}%)</Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                      </View>
                      {i < data.skillBreakdown.length - 1 && <View style={styles.divider} />}
                    </View>
                  );
                })}
              </View>

              {/* Monetization Summary */}
              <Text style={styles.sectionLabel}>Monetization Signals</Text>
              <View style={styles.card}>
                <View style={styles.monoRow}>
                  <Ionicons name="trending-up-outline" size={18} color={Colors.green} />
                  <Text style={styles.monoText}>Engagement Rate</Text>
                  <Text style={[styles.monoValue, { color: Colors.green }]}>
                    {data.totalUsers > 0 ? ((data.totalPosts + data.totalComments) / Math.max(data.totalUsers, 1)).toFixed(1) : "0"} actions/user
                  </Text>
                </View>
                <View style={styles.detailDivider} />
                <View style={styles.monoRow}>
                  <Ionicons name="people-outline" size={18} color={Colors.accent} />
                  <Text style={styles.monoText}>7-day New Users</Text>
                  <Text style={[styles.monoValue, { color: Colors.accent }]}>{data.newThisWeek}</Text>
                </View>
                <View style={styles.detailDivider} />
                <View style={styles.monoRow}>
                  <Ionicons name="heart-outline" size={18} color="#F59E0B" />
                  <Text style={styles.monoText}>Social Interactions</Text>
                  <Text style={[styles.monoValue, { color: "#F59E0B" }]}>{data.totalLikes + data.totalComments + data.totalDMs}</Text>
                </View>
              </View>

              {/* Recent Signups */}
              <Text style={styles.sectionLabel}>Recent Signups</Text>
              <View style={styles.card}>
                {data.recentUsers.length === 0 ? (
                  <Text style={styles.emptyText}>No users yet</Text>
                ) : data.recentUsers.map((u, i) => {
                  const color = SKILL_COLORS[u.skill_level] ?? Colors.textSecondary;
                  return (
                    <TouchableOpacity key={u.user_id} onPress={() => setSelectedUser(u as any)}>
                      <View style={styles.userRow}>
                        <View style={[styles.userAvatar, { backgroundColor: color + "22" }]}>
                          <Text style={[styles.userAvatarText, { color }]}>{u.username.charAt(0).toUpperCase()}</Text>
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
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : null}
        </ScrollView>
      ) : activeTab === "users" ? (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color={Colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, email, handle..."
              placeholderTextColor={Colors.textTertiary}
              value={search}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(""); setDebouncedSearch(""); }}>
                <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {usersQuery.isLoading ? (
            <View style={styles.center}><Text style={styles.loadingText}>Loading users...</Text></View>
          ) : (
            <FlatList
              data={usersQuery.data?.users ?? []}
              keyExtractor={(u) => u.user_id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={usersQuery.isRefetching} onRefresh={() => usersQuery.refetch()} tintColor={Colors.accent} />}
              ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyText}>No users found</Text></View>}
              ListHeaderComponent={
                <Text style={[styles.sectionLabel, { marginTop: 12 }]}>
                  {usersQuery.data?.total ?? 0} users total
                </Text>
              }
              renderItem={({ item: u }) => {
                const color = SKILL_COLORS[u.skill_level] ?? Colors.textSecondary;
                const totalActivity = parseInt(u.post_count) + parseInt(u.comment_count) + parseInt(u.like_count);
                return (
                  <TouchableOpacity onPress={() => setSelectedUser(u)} style={styles.userCard}>
                    <View style={styles.userCardHeader}>
                      <View style={[styles.userAvatar, { backgroundColor: color + "22" }]}>
                        <Text style={[styles.userAvatarText, { color }]}>{u.username.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{u.username} {u.handle ? <Text style={styles.handleText}>@{u.handle}</Text> : null}</Text>
                        <Text style={styles.userEmail}>{u.email}</Text>
                      </View>
                      <View style={styles.userRight}>
                        <View style={[styles.levelBadge, { backgroundColor: color + "22" }]}>
                          <Text style={[styles.levelBadgeText, { color }]}>{u.skill_level}</Text>
                        </View>
                        <Text style={styles.userTime}>{timeAgo(u.created_at)}</Text>
                      </View>
                    </View>
                    <View style={styles.userCardStats}>
                      <View style={styles.miniStat}>
                        <Ionicons name="image-outline" size={12} color={Colors.textTertiary} />
                        <Text style={styles.miniStatText}>{u.post_count}</Text>
                      </View>
                      <View style={styles.miniStat}>
                        <Ionicons name="chatbubble-outline" size={12} color={Colors.textTertiary} />
                        <Text style={styles.miniStatText}>{u.comment_count}</Text>
                      </View>
                      <View style={styles.miniStat}>
                        <Ionicons name="heart-outline" size={12} color={Colors.textTertiary} />
                        <Text style={styles.miniStatText}>{u.like_count}</Text>
                      </View>
                      <View style={styles.miniStat}>
                        <Ionicons name="mail-outline" size={12} color={Colors.textTertiary} />
                        <Text style={styles.miniStatText}>{u.dm_count}</Text>
                      </View>
                      <View style={[styles.miniStatRight]}>
                        {u.device_id ? (
                          <Ionicons name="phone-portrait-outline" size={12} color={Colors.green} />
                        ) : (
                          <Ionicons name="phone-portrait-outline" size={12} color={Colors.textTertiary} />
                        )}
                        <Text style={[styles.miniStatText, { color: u.last_ip ? Colors.textSecondary : Colors.textTertiary }]}>
                          {u.last_ip ? u.last_ip.substring(0, 15) : "no IP"}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      ) : activeTab === "analytics" ? (
        /* Analytics Tab */
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={analyticsQuery.isRefetching} onRefresh={analyticsQuery.refetch} tintColor={Colors.accent} />}
        >
          {analyticsQuery.isLoading ? (
            <View style={styles.center}><Text style={styles.loadingText}>Loading analytics...</Text></View>
          ) : analyticsQuery.data ? (
            <>
              {/* Platform Split */}
              <Text style={styles.sectionLabel}>Platform</Text>
              <View style={styles.statRow}>
                {analyticsQuery.data.platformSplit.map((p) => (
                  <StatCard
                    key={p.platform}
                    label={p.platform}
                    value={p.count}
                    color={p.platform === "ios" ? "#60A5FA" : p.platform === "android" ? Colors.green : Colors.accent}
                    icon={p.platform === "ios" ? "logo-apple" : p.platform === "android" ? "logo-android" : "globe-outline"}
                  />
                ))}
              </View>

              {/* Top Events This Week */}
              <Text style={styles.sectionLabel}>Top Events — Last 7 Days</Text>
              <View style={styles.card}>
                {analyticsQuery.data.topEventsThisWeek.length === 0 ? (
                  <Text style={styles.emptyText}>No events yet</Text>
                ) : analyticsQuery.data.topEventsThisWeek.map((e, i) => {
                  const maxCount = parseInt(analyticsQuery.data.topEventsThisWeek[0]?.count ?? "1");
                  const pct = (parseInt(e.count) / maxCount) * 100;
                  return (
                    <View key={e.event}>
                      <View style={styles.skillRow}>
                        <Text style={styles.skillName}>{e.event}</Text>
                        <Text style={[styles.skillCount, { color: Colors.accent }]}>{e.count}</Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: Colors.accent }]} />
                      </View>
                      {i < analyticsQuery.data.topEventsThisWeek.length - 1 && <View style={styles.divider} />}
                    </View>
                  );
                })}
              </View>

              {/* All-Time Event Counts */}
              <Text style={styles.sectionLabel}>All-Time Event Counts</Text>
              <View style={styles.card}>
                {analyticsQuery.data.eventCounts.length === 0 ? (
                  <Text style={styles.emptyText}>No events tracked yet</Text>
                ) : analyticsQuery.data.eventCounts.map((e, i) => (
                  <View key={e.event}>
                    <View style={styles.monoRow}>
                      <Text style={styles.monoText}>{e.event}</Text>
                      <Text style={[styles.monoValue, { color: Colors.green }]}>{e.count}</Text>
                    </View>
                    {i < analyticsQuery.data.eventCounts.length - 1 && <View style={styles.detailDivider} />}
                  </View>
                ))}
              </View>

              {/* DAU Last 30 Days */}
              <Text style={styles.sectionLabel}>Daily Active Users (30 days)</Text>
              <View style={styles.card}>
                {analyticsQuery.data.dailyActive.length === 0 ? (
                  <Text style={styles.emptyText}>No data yet</Text>
                ) : analyticsQuery.data.dailyActive.slice(0, 14).map((d, i) => {
                  const maxDau = parseInt(analyticsQuery.data.dailyActive[0]?.dau ?? "1");
                  const pct = (parseInt(d.dau) / Math.max(maxDau, 1)) * 100;
                  return (
                    <View key={d.date}>
                      <View style={styles.skillRow}>
                        <Text style={styles.skillName}>{new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Text>
                        <Text style={[styles.skillCount, { color: Colors.green }]}>{d.dau} DAU</Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: Colors.green }]} />
                      </View>
                      {i < Math.min(analyticsQuery.data.dailyActive.length, 14) - 1 && <View style={styles.divider} />}
                    </View>
                  );
                })}
              </View>

              {/* Recent Events Feed */}
              <Text style={styles.sectionLabel}>Recent Events</Text>
              <View style={styles.card}>
                {analyticsQuery.data.recentEvents.length === 0 ? (
                  <Text style={styles.emptyText}>No events yet</Text>
                ) : analyticsQuery.data.recentEvents.map((e, i) => (
                  <View key={i}>
                    <View style={styles.monoRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.monoText, { fontSize: 13 }]}>{e.event}</Text>
                        <Text style={styles.userEmail}>{e.username || e.user_id || "anonymous"}{e.email ? ` · ${e.email}` : ""} · {e.platform}</Text>
                      </View>
                      <Text style={styles.userTime}>{timeAgo(e.created_at)}</Text>
                    </View>
                    {i < analyticsQuery.data.recentEvents.length - 1 && <View style={styles.detailDivider} />}
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyText}>Switch to this tab to load analytics</Text>
            </View>
          )}
        </ScrollView>
      )}

      <UserDetailModal user={selectedUser} visible={!!selectedUser} onClose={() => setSelectedUser(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 80 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  headerBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  lockedText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.textTertiary },
  loadingText: { fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.textSecondary },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textTertiary, textAlign: "center", padding: 20 },

  tabBar: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 8,
    backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, padding: 3,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: Colors.accent },
  tabText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  tabTextActive: { color: "#000", fontFamily: "Inter_600SemiBold" },

  sectionLabel: {
    fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.textSecondary,
    letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8, marginTop: 20,
  },
  card: {
    backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, padding: 16,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },

  statGrid: { flexDirection: "row", gap: 10 },
  bigStatBox: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 20, alignItems: "center", justifyContent: "center",
  },
  bigStatValue: { fontFamily: "Inter_700Bold", fontSize: 44, color: Colors.text },
  bigStatKey: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  smallStatCol: { flex: 1 },
  smallStatBox: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 16, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  smallStatValue: { fontFamily: "Inter_700Bold", fontSize: 26, color: Colors.text },
  smallStatKey: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary },

  statRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, padding: 12, alignItems: "center", gap: 5,
  },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 18 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.textSecondary },

  skillRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  skillRowLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  skillDot: { width: 8, height: 8, borderRadius: 4 },
  skillName: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.text },
  skillCount: { fontFamily: "Inter_700Bold", fontSize: 13 },
  barTrack: { height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: "hidden" },
  barFill: { height: 4, borderRadius: 2 },

  monoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  monoText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.text },
  monoValue: { fontFamily: "Inter_600SemiBold", fontSize: 13 },

  userRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  userAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  userAvatarText: { fontFamily: "Inter_700Bold", fontSize: 16 },
  userInfo: { flex: 1 },
  userName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  userEmail: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  userRight: { alignItems: "flex-end", gap: 4 },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  levelBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  userTime: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.textTertiary },

  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, marginHorizontal: 16, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: {
    flex: 1, fontFamily: "Inter_400Regular", fontSize: 14,
    color: Colors.text,
  },
  userCard: {
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 8,
  },
  userCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  userCardStats: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  miniStat: { flexDirection: "row", alignItems: "center", gap: 3 },
  miniStatRight: { flex: 1, flexDirection: "row", alignItems: "center", gap: 3, justifyContent: "flex-end" },
  miniStatText: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textTertiary },
  handleText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary },

  // Modal
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text },
  modalClose: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.card,
    alignItems: "center", justifyContent: "center",
  },
  modalBody: { flex: 1, padding: 20 },
  modalAvatar: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: 8,
  },
  modalAvatarText: { fontFamily: "Inter_700Bold", fontSize: 26 },
  modalName: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text, textAlign: "center", marginTop: 10 },
  modalHandle: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", marginTop: 2 },
  detailSectionTitle: {
    fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.textSecondary,
    letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8, marginTop: 20,
  },
  detailCard: {
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 14,
  },
  detailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  detailRowLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary },
  detailValue: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.text, maxWidth: "55%" },
  detailDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },
  activityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  activityStat: { alignItems: "center", minWidth: 50 },
  activityValue: { fontFamily: "Inter_700Bold", fontSize: 18 },
  activityLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  userIdText: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary },
});
