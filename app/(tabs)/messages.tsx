import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Friend {
  friend_id: string;
  username: string;
  skill_level: string;
}

interface FriendRequest {
  id: number;
  requester_id: string;
  requester_username: string;
  skill_level: string;
  created_at: string;
}

interface Conversation {
  partner_id: string;
  partner_username: string;
  partner_skill: string;
  text: string;
  sender_id: string;
  created_at: string;
}

interface SearchResult {
  user_id: string;
  username: string;
  handle: string | null;
  skill_level: string;
  friendship_status: string | null;
  friendship_requester: string | null;
}

// ─── Skill badge ──────────────────────────────────────────────────────────────

function SkillBadge({ level }: { level: string }) {
  const color =
    level === "Pro" ? Colors.accent :
    level === "Advanced" ? "#8B5CF6" :
    level === "Intermediate" ? Colors.primary :
    "#6B7280";
  return (
    <View style={[styles.skillBadge, { backgroundColor: color + "22", borderColor: color + "55" }]}>
      <Text style={[styles.skillText, { color }]}>{level}</Text>
    </View>
  );
}

// ─── Search panel ─────────────────────────────────────────────────────────────

function SearchPanel({ myId, onClose }: { myId: string | null; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const qc = useQueryClient();

  const { data: results = [], isFetching } = useQuery<SearchResult[]>({
    queryKey: ["/api/users/search", query, myId],
    queryFn: async () => {
      if (query.trim().length < 2) return [];
      const url = new URL("/api/users/search", getApiUrl());
      url.searchParams.set("q", query.trim());
      url.searchParams.set("myId", myId ?? "");
      const res = await fetch(url.toString());
      return res.json();
    },
    enabled: query.trim().length >= 2,
    staleTime: 0,
  });

  const sendRequest = useMutation({
    mutationFn: async (addresseeId: string) => {
      const res = await apiRequest("POST", "/api/friends/request", { requesterId: myId ?? "", addresseeId });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users/search"] });
      qc.invalidateQueries({ queryKey: ["/api/friends/requests", myId] });
    },
    onError: (err: any) => Alert.alert("Error", err.message),
  });

  const getFriendshipLabel = (r: SearchResult) => {
    if (!r.friendship_status) return null;
    if (r.friendship_status === "accepted") return "Friends";
    if (r.friendship_status === "pending") {
      if (r.friendship_requester === myId) return "Requested";
      return "Wants to connect";
    }
    return null;
  };

  return (
    <View style={styles.searchPanel}>
      <View style={styles.searchHeader}>
        <Text style={styles.searchTitle}>Find Players</Text>
        <TouchableOpacity onPress={onClose} testID="close-search">
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={styles.searchInputRow}>
        <Ionicons name="search" size={16} color={Colors.textTertiary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or @username…"
          placeholderTextColor={Colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCapitalize="none"
          testID="search-input"
        />
        {isFetching && <ActivityIndicator size="small" color={Colors.accent} />}
      </View>
      {query.trim().length >= 2 && (
        <FlatList
          data={results}
          keyExtractor={(r) => r.user_id}
          style={styles.searchResults}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            !isFetching ? (
              <Text style={styles.emptyText}>No players found</Text>
            ) : null
          }
          renderItem={({ item }) => {
            const label = getFriendshipLabel(item);
            const alreadyFriends = item.friendship_status === "accepted";
            const requested = item.friendship_status === "pending" && item.friendship_requester === myId;
            const theyRequested = item.friendship_status === "pending" && item.friendship_requester !== myId;
            return (
              <View style={styles.searchRow}>
                <View style={styles.searchRowAvatar}>
                  <Text style={styles.searchRowAvatarText}>
                    {item.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.searchRowInfo}>
                  <Text style={styles.searchRowName}>{item.username}</Text>
                  {item.handle ? (
                    <Text style={styles.searchRowHandle}>@{item.handle}</Text>
                  ) : null}
                  <SkillBadge level={item.skill_level} />
                </View>
                {alreadyFriends ? (
                  <View style={styles.statusPill}>
                    <Ionicons name="checkmark" size={12} color={Colors.success} />
                    <Text style={[styles.statusText, { color: Colors.success }]}>Friends</Text>
                  </View>
                ) : theyRequested ? (
                  <View style={styles.statusPill}>
                    <Text style={[styles.statusText, { color: Colors.accent }]}>Wants to connect</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.addBtn, requested && styles.addBtnDisabled]}
                    onPress={() => !requested && sendRequest.mutate(item.user_id)}
                    disabled={requested}
                    testID={`add-friend-${item.user_id}`}
                  >
                    <Ionicons
                      name={requested ? "time-outline" : "person-add-outline"}
                      size={14}
                      color={requested ? Colors.textTertiary : Colors.accent}
                    />
                    <Text style={[styles.addBtnText, requested && { color: Colors.textTertiary }]}>
                      {requested ? "Sent" : "Add"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}
      {query.trim().length < 2 && (
        <Text style={styles.searchHint}>Type at least 2 characters to search</Text>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const { profile } = useApp();
  const userId = profile?.userId ?? null;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showSearch, setShowSearch] = useState(false);
  const [activeTab, setActiveTab] = useState<"chats" | "friends">("chats");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: friends = [], isLoading: loadingFriends } = useQuery<Friend[]>({
    queryKey: ["/api/friends", userId],
    queryFn: async () => {
      const url = new URL(`/api/friends/${userId}`, getApiUrl());
      const res = await fetch(url.toString());
      return res.json();
    },
    enabled: !!userId,
    refetchInterval: 5000,
  });

  const { data: requests = [] } = useQuery<FriendRequest[]>({
    queryKey: ["/api/friends/requests", userId],
    queryFn: async () => {
      const url = new URL(`/api/friends/requests/${userId}`, getApiUrl());
      const res = await fetch(url.toString());
      return res.json();
    },
    enabled: !!userId,
    refetchInterval: 5000,
  });

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/dms/conversations", userId],
    queryFn: async () => {
      const url = new URL(`/api/dms/conversations/${userId}`, getApiUrl());
      const res = await fetch(url.toString());
      return res.json();
    },
    enabled: !!userId,
    refetchInterval: 4000,
  });

  const respondRequest = useMutation({
    mutationFn: async ({ requesterId, action }: { requesterId: string; action: "accept" | "decline" }) => {
      const res = await apiRequest("POST", "/api/friends/respond", {
        requesterId,
        addresseeId: userId,
        action,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/friends", userId] });
      qc.invalidateQueries({ queryKey: ["/api/friends/requests", userId] });
    },
  });

  const unfriend = useMutation({
    mutationFn: async (friendId: string) => {
      await apiRequest("DELETE", `/api/friends/${userId}/${friendId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/friends", userId] });
      qc.invalidateQueries({ queryKey: ["/api/dms/conversations", userId] });
    },
  });

  const handleUnfriend = useCallback((friend: Friend) => {
    Alert.alert(
      "Remove Friend",
      `Remove ${friend.username} from your friends? You won't be able to message them.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive",
          onPress: () => unfriend.mutate(friend.friend_id),
        },
      ]
    );
  }, [userId]);

  const getConvoForFriend = (friendId: string) =>
    conversations.find((c) => c.partner_id === friendId);

  if (!userId) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="person-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>Set up your profile first</Text>
          <Text style={styles.emptySubtitle}>You need a username to use messaging</Text>
        </View>
      </View>
    );
  }

  if (showSearch) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <SearchPanel myId={userId} onClose={() => setShowSearch(false)} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity
          style={styles.addIconBtn}
          onPress={() => setShowSearch(true)}
          testID="open-search"
        >
          <Ionicons name="person-add-outline" size={22} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Tab pills */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabPill, activeTab === "chats" && styles.tabPillActive]}
          onPress={() => setActiveTab("chats")}
          testID="tab-chats"
        >
          <Text style={[styles.tabPillText, activeTab === "chats" && styles.tabPillTextActive]}>
            Chats
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabPill, activeTab === "friends" && styles.tabPillActive]}
          onPress={() => setActiveTab("friends")}
          testID="tab-friends"
        >
          <Text style={[styles.tabPillText, activeTab === "friends" && styles.tabPillTextActive]}>
            Friends {friends.length > 0 ? `(${friends.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Pending requests banner */}
      {requests.length > 0 && (
        <View style={styles.requestsBanner}>
          <View style={styles.requestsBannerHeader}>
            <Ionicons name="people-outline" size={16} color={Colors.accent} />
            <Text style={styles.requestsBannerTitle}>
              {requests.length} friend {requests.length === 1 ? "request" : "requests"}
            </Text>
          </View>
          {requests.map((r) => (
            <View key={r.id} style={styles.requestRow}>
              <View style={styles.requestAvatar}>
                <Text style={styles.requestAvatarText}>
                  {r.requester_username.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestName}>{r.requester_username}</Text>
                <SkillBadge level={r.skill_level} />
              </View>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => respondRequest.mutate({ requesterId: r.requester_id, action: "accept" })}
                testID={`accept-${r.requester_id}`}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.declineBtn}
                onPress={() => respondRequest.mutate({ requesterId: r.requester_id, action: "decline" })}
                testID={`decline-${r.requester_id}`}
              >
                <Ionicons name="close" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Chats tab */}
      {activeTab === "chats" && (
        <>
          {conversations.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="chatbubble-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>Add friends and start chatting</Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(c) => c.partner_id}
              contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : 100 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.convoRow}
                  onPress={() => router.push(`/dm/${item.partner_id}`)}
                  testID={`convo-${item.partner_id}`}
                >
                  <View style={styles.convoAvatar}>
                    <Text style={styles.convoAvatarText}>
                      {item.partner_username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.convoName}>{item.partner_username}</Text>
                    <Text style={styles.convoPreview} numberOfLines={1}>
                      {item.sender_id === userId ? "You: " : ""}{item.text}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
            />
          )}
        </>
      )}

      {/* Friends tab */}
      {activeTab === "friends" && (
        <>
          {loadingFriends ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.accent} />
            </View>
          ) : friends.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="people-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No friends yet</Text>
              <Text style={styles.emptySubtitle}>Search for players to add them</Text>
              <TouchableOpacity
                style={styles.findBtn}
                onPress={() => setShowSearch(true)}
                testID="find-players-btn"
              >
                <Ionicons name="person-add-outline" size={16} color="#fff" />
                <Text style={styles.findBtnText}>Find Players</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(f) => f.friend_id}
              contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : 100 }}
              renderItem={({ item }) => {
                const convo = getConvoForFriend(item.friend_id);
                return (
                  <TouchableOpacity
                    style={styles.friendRow}
                    onPress={() => router.push(`/dm/${item.friend_id}`)}
                    onLongPress={() => handleUnfriend(item)}
                    testID={`friend-${item.friend_id}`}
                  >
                    <View style={styles.convoAvatar}>
                      <Text style={styles.convoAvatarText}>
                        {item.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.convoName}>{item.username}</Text>
                      {convo ? (
                        <Text style={styles.convoPreview} numberOfLines={1}>
                          {convo.sender_id === userId ? "You: " : ""}{convo.text}
                        </Text>
                      ) : (
                        <SkillBadge level={item.skill_level} />
                      )}
                    </View>
                    <Ionicons name="chatbubble-outline" size={18} color={Colors.accent} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.text,
  },
  addIconBtn: {
    padding: 4,
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabPillActive: {
    backgroundColor: Colors.accent + "22",
    borderColor: Colors.accent,
  },
  tabPillText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  tabPillTextActive: {
    color: Colors.accent,
  },
  requestsBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.accent + "44",
    padding: 12,
  },
  requestsBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  requestsBannerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.accent,
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  requestAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  requestAvatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.accent,
  },
  requestName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
    marginBottom: 2,
  },
  acceptBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  convoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  convoAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  convoAvatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.primary,
  },
  convoName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
    marginBottom: 2,
  },
  convoPreview: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: Colors.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  findBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 12,
  },
  findBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
  skillBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
  },
  skillText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
  },
  searchPanel: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
  },
  searchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
  },
  searchResults: {
    flex: 1,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  searchRowAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  searchRowAvatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: Colors.primary,
  },
  searchRowInfo: {
    flex: 1,
    gap: 2,
  },
  searchRowName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  searchRowHandle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.accent,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + "18",
  },
  addBtnDisabled: {
    borderColor: Colors.border,
    backgroundColor: "transparent",
  },
  addBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.accent,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  statusText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  searchHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: "center",
    marginTop: 32,
  },
});
