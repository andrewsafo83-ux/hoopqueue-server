import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Platform, KeyboardAvoidingView,
  ActivityIndicator, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DMMessage {
  id: number;
  sender_id: string;
  receiver_id: string;
  text: string;
  created_at: string;
  sender_username: string;
  sender_skill: string;
}

interface FriendInfo {
  friend_id: string;
  username: string;
  skill_level: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DMScreen() {
  const { userId: partnerRaw } = useLocalSearchParams<{ userId: string }>();
  const partnerId = partnerRaw as string;
  const { profile } = useApp();
  const myId = profile?.userId ?? "";
  const myUsername = profile?.username ?? "";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const flatRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Fetch friend info for header
  const { data: friends = [] } = useQuery<FriendInfo[]>({
    queryKey: ["/api/friends", myId],
    queryFn: async () => {
      const url = new URL(`/api/friends/${myId}`, getApiUrl());
      const res = await fetch(url.toString());
      return res.json();
    },
    enabled: !!myId,
    staleTime: 10000,
  });

  const partner = friends.find((f) => f.friend_id === partnerId);

  // Fetch messages (poll every 3 seconds)
  const { data: messages = [], isLoading } = useQuery<DMMessage[]>({
    queryKey: ["/api/dms", myId, partnerId],
    queryFn: async () => {
      const url = new URL(`/api/dms/${myId}/${partnerId}`, getApiUrl());
      const res = await fetch(url.toString());
      if (!res.ok) {
        if (res.status === 403) return [];
        throw new Error("Failed to load messages");
      }
      return res.json();
    },
    enabled: !!myId && !!partnerId,
    refetchInterval: 3000,
    staleTime: 0,
  });

  // Inverted for FlatList — newest at bottom
  const reversed = [...messages].reverse();

  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/dms", {
        senderId: myId,
        receiverId: partnerId,
        text,
      });
      return res.json();
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["/api/dms", myId, partnerId] });
      qc.invalidateQueries({ queryKey: ["/api/dms/conversations", myId] });
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Could not send message");
    },
  });

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || sendMessage.isPending) return;
    sendMessage.mutate(text);
  }, [draft, sendMessage]);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const partnerName = partner?.username ?? "Player";

  const renderMessage = ({ item }: { item: DMMessage }) => {
    const isMe = item.sender_id === myId;
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.sender_username.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
            {item.text}
          </Text>
          <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: Colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: partnerName,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontFamily: "Inter_600SemiBold", color: Colors.text },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ paddingHorizontal: 4 }}
              testID="back-btn"
            >
              <Ionicons name="chevron-back" size={24} color={Colors.accent} />
            </TouchableOpacity>
          ),
          headerShadowVisible: false,
          headerBackVisible: false,
        }}
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.startAvatar}>
            <Text style={styles.startAvatarText}>
              {partnerName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.startName}>{partnerName}</Text>
          {partner && (
            <View style={styles.startSkill}>
              <Text style={styles.startSkillText}>{partner.skill_level}</Text>
            </View>
          )}
          <Text style={styles.startHint}>Send a message to start the conversation</Text>
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={reversed}
          keyExtractor={(m) => String(m.id)}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: bottomPad + 8 }]}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor={Colors.textTertiary}
          multiline
          maxLength={500}
          returnKeyType="default"
          testID="dm-input"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!draft.trim() || sendMessage.isPending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || sendMessage.isPending}
          testID="send-btn"
        >
          {sendMessage.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 3,
    gap: 8,
  },
  msgRowMe: {
    flexDirection: "row-reverse",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary + "33",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  avatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: Colors.primary,
  },
  bubble: {
    maxWidth: "72%",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    gap: 2,
  },
  bubbleMe: {
    backgroundColor: Colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    lineHeight: 20,
  },
  bubbleTextMe: {
    color: "#fff",
  },
  bubbleTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.textTertiary,
    alignSelf: "flex-end",
  },
  bubbleTimeMe: {
    color: "rgba(255,255,255,0.65)",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    gap: 8,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.textTertiary,
  },
  startAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary + "33",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  startAvatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: Colors.primary,
  },
  startName: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
  },
  startSkill: {
    backgroundColor: Colors.accent + "22",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.accent + "55",
  },
  startSkillText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.accent,
  },
  startHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
});
