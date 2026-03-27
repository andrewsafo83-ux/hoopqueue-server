import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Linking,
  Image,
  ActivityIndicator,
  Modal,
  Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp, generateUserId } from "@/context/AppContext";
import { SKILL_LEVELS, SkillLevel } from "@/data/courts";
import Colors from "@/constants/colors";
import { getApiUrl, apiRequest } from "@/lib/query-client";

const SCREEN_W = Dimensions.get("window").width;

interface Post {
  id: string;
  userId: string;
  username: string;
  avatarBase64: string | null;
  imageBase64: string | null;
  imageUrl: string | null;
  caption: string | null;
  courtId: string | null;
  courtName: string | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  userLiked: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const SKILL_DESCRIPTIONS: Record<SkillLevel, string> = {
  Beginner: "Just learning the game",
  Intermediate: "Can hold my own in a run",
  Advanced: "Competitive pickup level",
  Pro: "College / professional level",
};

const SKILL_COLORS: Record<SkillLevel, string> = {
  Beginner: "#60A5FA",
  Intermediate: Colors.green,
  Advanced: Colors.accent,
  Pro: "#A855F7",
};

function openUrl(path: string) {
  const base = getApiUrl().replace(/\/api$/, "");
  Linking.openURL(`${base}${path}`);
}

function PostDetailModal({
  post,
  visible,
  onClose,
  onDelete,
  myUserId,
}: {
  post: Post | null;
  visible: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  myUserId: string | null;
}) {
  const insets = useSafeAreaInsets();
  if (!post) return null;
  const imgUri = post.imageUrl ?? (post.imageBase64 ? `data:image/jpeg;base64,${post.imageBase64}` : null);

  const handleDelete = () => {
    Alert.alert("Delete post?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { onDelete(post.id); onClose(); } },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[detailStyles.container, { paddingBottom: insets.bottom + 16 }]}>
        <View style={detailStyles.header}>
          <View style={detailStyles.handle} />
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={detailStyles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {imgUri && (
          <Image source={{ uri: imgUri }} style={detailStyles.image} resizeMode="cover" />
        )}

        <View style={detailStyles.meta}>
          <View style={detailStyles.metaLeft}>
            <View style={detailStyles.statChip}>
              <Ionicons name="heart" size={14} color={Colors.red} />
              <Text style={detailStyles.statChipText}>{post.likeCount}</Text>
            </View>
            <View style={detailStyles.statChip}>
              <Ionicons name="chatbubble" size={13} color={Colors.accent} />
              <Text style={detailStyles.statChipText}>{post.commentCount}</Text>
            </View>
            {post.courtName ? (
              <View style={detailStyles.statChip}>
                <Ionicons name="basketball-outline" size={13} color={Colors.accent} />
                <Text style={detailStyles.statChipText}>{post.courtName}</Text>
              </View>
            ) : null}
          </View>
          <Text style={detailStyles.time}>{timeAgo(post.createdAt)}</Text>
        </View>

        {post.caption ? (
          <Text style={detailStyles.caption}>{post.caption}</Text>
        ) : null}

        {myUserId === post.userId && (
          <TouchableOpacity style={detailStyles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={16} color={Colors.red} />
            <Text style={detailStyles.deleteBtnText}>Delete Post</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const detailStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { alignItems: "center", paddingTop: 12, paddingBottom: 8, position: "relative" },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 8 },
  closeBtn: { position: "absolute", right: 16, top: 12 },
  image: { width: "100%", aspectRatio: 1 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  metaLeft: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1, flexWrap: "wrap" },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statChipText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  time: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textTertiary, marginLeft: 8 },
  caption: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.red + "44",
    justifyContent: "center",
    backgroundColor: Colors.red + "0F",
  },
  deleteBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.red },
});

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, updateProfile, updateAvatar, deleteAccount } = useApp();
  const qc = useQueryClient();
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const stableUserId = useRef(profile?.userId ?? generateUserId());
  const displayUserId = profile?.userId ?? stableUserId.current;
  const [username, setUsername] = useState(profile?.username ?? "");
  const [handle, setHandle] = useState(profile?.handle ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(
    profile?.skillLevel ?? "Intermediate"
  );
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [handleError, setHandleError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const adminTapCount = useRef(0);
  const adminTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const followStatsQuery = useQuery<{ followers: number; following: number }>({
    queryKey: ["/api/users", profile?.userId, "follow-stats"],
    enabled: !!profile?.userId,
    queryFn: async () => {
      const url = new URL(`/api/users/${profile!.userId}/follow-stats`, getApiUrl());
      const res = await fetch(url.toString());
      return res.json();
    },
    staleTime: 30000,
  });
  const followers = followStatsQuery.data?.followers ?? 0;
  const following = followStatsQuery.data?.following ?? 0;

  const userPostsQuery = useQuery<Post[]>({
    queryKey: ["/api/users", profile?.userId, "posts"],
    enabled: !!profile?.userId,
    queryFn: async () => {
      const url = new URL(`/api/users/${profile!.userId}/posts`, getApiUrl());
      url.searchParams.set("viewerId", profile!.userId);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 15000,
  });
  const userPosts = userPostsQuery.data ?? [];

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!profile) throw new Error("Not logged in");
      return apiRequest("DELETE", `/api/posts/${postId}`, { userId: profile.userId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users", profile?.userId, "posts"] });
      qc.invalidateQueries({ queryKey: ["/api/feed", profile?.userId] });
    },
    onError: () => Alert.alert("Error", "Could not delete post. Try again."),
  });

  function handleSecretTap() {
    adminTapCount.current += 1;
    if (adminTapTimer.current) clearTimeout(adminTapTimer.current);
    adminTapTimer.current = setTimeout(() => { adminTapCount.current = 0; }, 2000);
    if (adminTapCount.current >= 7 && isAdmin) {
      adminTapCount.current = 0;
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push("/admin");
    }
  }

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setHandle(profile.handle ?? "");
      setEmail(profile.email ?? "");
      setPhone(profile.phone ?? "");
      setSkillLevel(profile.skillLevel);
    }
  }, [profile?.username, profile?.handle, profile?.email, profile?.phone, profile?.skillLevel]);


  function validateEmail(val: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  }

  function formatPhone(val: string): string {
    const digits = val.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  async function handlePickAvatar() {
    if (!profile) {
      Alert.alert("Create profile first", "Please save your profile before adding a photo.");
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to set a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
    if (base64.length > 500000) {
      Alert.alert("Photo too large", "Please choose a smaller or lower resolution photo.");
      return;
    }
    setIsUploadingAvatar(true);
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await updateAvatar(base64);
    } catch {
      Alert.alert("Error", "Could not save photo. Please try again.");
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleSave() {
    if (!username.trim()) {
      Alert.alert("Name required", "Please enter your player name.");
      return;
    }
    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    if (handle.trim() && !/^[a-zA-Z0-9_]{3,30}$/.test(handle.trim())) {
      setHandleError("Letters, numbers, and underscores only (3–30 chars)");
      return;
    }
    if (phone.trim()) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length !== 10) {
        setPhoneError("Please enter a valid 10-digit phone number");
        return;
      }
    }
    setEmailError("");
    setPhoneError("");
    setHandleError("");
    setUsernameError("");
    setIsSaving(true);
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      await updateProfile(username.trim(), handle.trim().toLowerCase(), email.trim().toLowerCase(), phone.trim(), skillLevel, stableUserId.current);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      if (err?.message === "DEVICE_EXISTS") {
        Alert.alert("Account Exists", "An account already exists on this device. Only one account is allowed per device.");
      } else if (err?.message === "USERNAME_TAKEN") {
        setUsernameError("That name is already taken. Choose a different one.");
      } else if (err?.message?.includes("409") || err?.message?.includes("email")) {
        setEmailError("That email is already registered to another account.");
      } else if (err?.message) {
        Alert.alert("Error", err.message);
      } else {
        Alert.alert("Error", "Could not save profile. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  async function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account, profile, posts, and all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete My Account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you absolutely sure?",
              "Your account and all data will be permanently deleted.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete",
                  style: "destructive",
                  onPress: async () => {
                    setIsDeletingAccount(true);
                    try {
                      await deleteAccount();
                    } catch {
                      Alert.alert("Error", "Could not delete account. Please try again or contact support.");
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }

  const hasChanges =
    username !== (profile?.username ?? "") ||
    handle !== (profile?.handle ?? "") ||
    email !== (profile?.email ?? "") ||
    phone !== (profile?.phone ?? "") ||
    skillLevel !== (profile?.skillLevel ?? "Intermediate");

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Profile</Text>

      {profile ? (
        <View style={styles.avatarRow}>
          <TouchableOpacity onPress={handlePickAvatar} style={styles.avatarWrap} activeOpacity={0.8}>
            {profile.avatarBase64 ? (
              <Image source={{ uri: profile.avatarBase64 }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profile.username.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.avatarCameraBtn}>
              {isUploadingAvatar
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={13} color="#fff" />}
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={handleSecretTap} activeOpacity={1}>
              <Text style={styles.avatarName}>{profile.username}</Text>
            </TouchableOpacity>
            {profile.handle ? (
              <Text style={styles.avatarHandle}>@{profile.handle}</Text>
            ) : null}
            {profile.email ? (
              <Text style={styles.avatarEmail}>{profile.email}</Text>
            ) : null}
            {profile.phone ? (
              <Text style={styles.avatarEmail}>{profile.phone}</Text>
            ) : null}
            <View style={[styles.skillBadge, { backgroundColor: SKILL_COLORS[profile.skillLevel] + "22" }]}>
              <Text style={[styles.skillBadgeText, { color: SKILL_COLORS[profile.skillLevel] }]}>
                {profile.skillLevel}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.welcomeBox}>
            <Ionicons name="person-circle-outline" size={48} color={Colors.accent} />
            <Text style={styles.welcomeTitle}>Create your player profile</Text>
            <Text style={styles.welcomeSub}>
              Set your name, email, phone, and skill level to join waitlists and post in the live feed
            </Text>
          </View>
        </>
      )}

      {profile && (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{userPosts.length}</Text>
            <Text style={styles.statKey}>Posts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{followers}</Text>
            <Text style={styles.statKey}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{following}</Text>
            <Text style={styles.statKey}>Following</Text>
          </View>
        </View>
      )}

      {/* Posts Grid */}
      {profile && (
        <View style={styles.postsSection}>
          <View style={styles.postsSectionHeader}>
            <Ionicons name="grid-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.postsSectionTitle}>Posts</Text>
          </View>
          {userPostsQuery.isLoading ? (
            <ActivityIndicator color={Colors.accent} style={{ marginVertical: 24 }} />
          ) : userPosts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Ionicons name="camera-outline" size={32} color={Colors.textTertiary} />
              <Text style={styles.emptyPostsText}>No posts yet</Text>
            </View>
          ) : (
            <View style={styles.postsGrid}>
              {userPosts.map((post) => {
                const uri = post.imageUrl ?? (post.imageBase64 ? `data:image/jpeg;base64,${post.imageBase64}` : null);
                return (
                  <TouchableOpacity
                    key={post.id}
                    style={styles.gridCell}
                    onPress={() => setSelectedPost(post)}
                    activeOpacity={0.85}
                  >
                    {uri ? (
                      <Image source={{ uri }} style={styles.gridImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.gridImage, { backgroundColor: Colors.card, alignItems: "center", justifyContent: "center" }]}>
                        <Ionicons name="image-outline" size={20} color={Colors.textTertiary} />
                      </View>
                    )}
                    {(post.likeCount > 0 || post.commentCount > 0) && (
                      <View style={styles.gridOverlay}>
                        {post.likeCount > 0 && (
                          <View style={styles.gridStat}>
                            <Ionicons name="heart" size={11} color="#fff" />
                            <Text style={styles.gridStatText}>{post.likeCount}</Text>
                          </View>
                        )}
                        {post.commentCount > 0 && (
                          <View style={styles.gridStat}>
                            <Ionicons name="chatbubble" size={10} color="#fff" />
                            <Text style={styles.gridStatText}>{post.commentCount}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      <PostDetailModal
        post={selectedPost}
        visible={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        onDelete={(id) => deletePostMutation.mutate(id)}
        myUserId={profile?.userId ?? null}
      />

      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={styles.sectionLabel}>Player Name</Text>
          <View style={styles.publicBadge}>
            <Ionicons name="eye-outline" size={11} color={Colors.accent} />
            <Text style={styles.publicBadgeText}>Public</Text>
          </View>
        </View>
        <TextInput
          style={[styles.input, usernameError ? styles.inputError : null]}
          value={username}
          onChangeText={(t) => { setUsername(t); if (usernameError) setUsernameError(""); }}
          placeholder="Enter your name"
          placeholderTextColor={Colors.textTertiary}
          maxLength={30}
          returnKeyType="next"
          autoCorrect={false}
          autoCapitalize="words"
        />
        {usernameError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={13} color={Colors.red} />
            <Text style={styles.errorText}>{usernameError}</Text>
          </View>
        ) : (
          <Text style={styles.fieldHint}>Visible to other players on waitlists and the live feed</Text>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={styles.sectionLabel}>Username</Text>
          <View style={styles.publicBadge}>
            <Ionicons name="eye-outline" size={11} color={Colors.accent} />
            <Text style={styles.publicBadgeText}>Public</Text>
          </View>
        </View>
        <View style={styles.handleInputRow}>
          <Text style={styles.handleAt}>@</Text>
          <TextInput
            style={[styles.handleInput, handleError ? styles.inputError : null]}
            value={handle}
            onChangeText={(t) => {
              setHandle(t.toLowerCase().replace(/[^a-z0-9_]/g, ""));
              if (handleError) setHandleError("");
            }}
            placeholder="username"
            placeholderTextColor={Colors.textTertiary}
            maxLength={30}
            returnKeyType="next"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
        {handleError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={13} color={Colors.red} />
            <Text style={styles.errorText}>{handleError}</Text>
          </View>
        ) : (
          <Text style={styles.fieldHint}>Optional — how other players can find you</Text>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={styles.sectionLabel}>Email Address</Text>
          <View style={styles.privateBadge}>
            <Ionicons name="lock-closed-outline" size={11} color={Colors.textSecondary} />
            <Text style={styles.privateBadgeText}>Private</Text>
          </View>
        </View>
        <TextInput
          style={[styles.input, emailError ? styles.inputError : null]}
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            if (emailError) setEmailError("");
          }}
          placeholder="your@email.com"
          placeholderTextColor={Colors.textTertiary}
          maxLength={100}
          returnKeyType="next"
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {emailError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={13} color={Colors.red} />
            <Text style={styles.errorText}>{emailError}</Text>
          </View>
        ) : (
          <Text style={styles.fieldHint}>Only visible to you — never shared with other players</Text>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={styles.sectionLabel}>Phone Number</Text>
          <View style={styles.privateBadge}>
            <Ionicons name="lock-closed-outline" size={11} color={Colors.textSecondary} />
            <Text style={styles.privateBadgeText}>Private</Text>
          </View>
        </View>
        <TextInput
          style={[styles.input, phoneError ? styles.inputError : null]}
          value={phone}
          onChangeText={(t) => {
            setPhone(formatPhone(t));
            if (phoneError) setPhoneError("");
          }}
          placeholder="(555) 000-0000"
          placeholderTextColor={Colors.textTertiary}
          maxLength={14}
          returnKeyType="done"
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType="phone-pad"
        />
        {phoneError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={13} color={Colors.red} />
            <Text style={styles.errorText}>{phoneError}</Text>
          </View>
        ) : (
          <Text style={styles.fieldHint}>Optional — only visible to you, never shared</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Skill Level</Text>
        <View style={styles.skillGrid}>
          {SKILL_LEVELS.map((level) => {
            const isSelected = skillLevel === level;
            const color = SKILL_COLORS[level];
            return (
              <TouchableOpacity
                key={level}
                style={[
                  styles.skillOption,
                  isSelected && { borderColor: color, backgroundColor: color + "18" },
                ]}
                onPress={() => {
                  setSkillLevel(level);
                  if (Platform.OS !== "web") {
                    Haptics.selectionAsync();
                  }
                }}
              >
                <View style={styles.skillOptionTop}>
                  <Text style={[styles.skillLabel, isSelected && { color }]}>
                    {level}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={16} color={color} />
                  )}
                </View>
                <Text style={styles.skillDesc}>{SKILL_DESCRIPTIONS[level]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.saveBtn,
          !hasChanges && !saved && styles.saveBtnDimmed,
          saved && styles.saveBtnSuccess,
        ]}
        onPress={handleSave}
        disabled={isSaving}
        activeOpacity={0.8}
      >
        {isSaving ? (
          <Text style={styles.saveBtnText}>Saving...</Text>
        ) : saved ? (
          <>
            <Ionicons name="checkmark" size={18} color={Colors.background} />
            <Text style={styles.saveBtnText}>Saved!</Text>
          </>
        ) : (
          <Text style={styles.saveBtnText}>
            {profile ? "Save Changes" : "Create Profile"}
          </Text>
        )}
      </TouchableOpacity>

      {!profile && (
        <Text style={styles.privacyNote}>
          Your email is stored securely and never shared with other players.
        </Text>
      )}

      <View style={styles.legalSection}>
        <Text style={styles.legalTitle}>Legal</Text>
        <TouchableOpacity
          style={styles.legalRow}
          onPress={() => openUrl("/privacy")}
          activeOpacity={0.7}
        >
          <View style={styles.legalRowLeft}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.legalRowText}>Privacy Policy</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
        <View style={styles.legalDivider} />
        <TouchableOpacity
          style={styles.legalRow}
          onPress={() => openUrl("/terms")}
          activeOpacity={0.7}
        >
          <View style={styles.legalRowLeft}>
            <Ionicons name="document-text-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.legalRowText}>Terms of Service</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.versionText}>HoopQueue · California Courts</Text>

      {profile && (
        <TouchableOpacity
          style={styles.deleteAccountBtn}
          onPress={handleDeleteAccount}
          disabled={isDeletingAccount}
          activeOpacity={0.8}
        >
          {isDeletingAccount ? (
            <ActivityIndicator size="small" color={Colors.red} />
          ) : (
            <>
              <Ionicons name="trash-outline" size={15} color={Colors.red} />
              <Text style={styles.deleteAccountText}>Delete Account</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  avatarWrap: { position: "relative" },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  avatarCameraBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.background,
  },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 26, color: Colors.accent },
  avatarName: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text, marginBottom: 2 },
  avatarHandle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.accent, marginBottom: 3 },
  avatarId: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textTertiary, marginBottom: 8, letterSpacing: 0.3 },
  avatarEmail: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  handleInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
  },
  handleAt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.accent,
    marginRight: 2,
  },
  handleInput: {
    flex: 1,
    paddingVertical: 14,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: Colors.text,
  },
  skillBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  skillBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  welcomeBox: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 10,
    marginBottom: 16,
  },
  welcomeTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text },
  welcomeSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 28,
    overflow: "hidden",
  },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 16, gap: 4 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 12 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.text },
  statKey: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  section: { marginBottom: 24 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  publicBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent + "18",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  publicBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.accent,
  },
  privateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  privateBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.textSecondary,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: Colors.text,
  },
  inputError: { borderColor: Colors.red },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.red,
  },
  fieldHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 6,
  },
  idRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
  },
  idText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textTertiary,
    letterSpacing: 0.3,
  },
  skillGrid: { gap: 8 },
  skillOption: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
  },
  skillOptionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  skillLabel: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  skillDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  saveBtnDimmed: { opacity: 0.5 },
  saveBtnSuccess: { backgroundColor: Colors.green },
  saveBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.background },
  privacyNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
  },
  legalSection: {
    marginTop: 32,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  legalTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  legalRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  legalRowText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.text,
  },
  legalDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  deleteAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 32,
    paddingVertical: 12,
  },
  deleteAccountText: {
    fontSize: 14,
    color: Colors.red,
    fontFamily: "Inter_500Medium",
  },
  versionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: "center",
    marginTop: 20,
    marginBottom: 8,
  },
  postsSection: {
    marginBottom: 28,
  },
  postsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  postsSectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  gridCell: {
    width: (SCREEN_W - 40 - 4) / 3,
    height: (SCREEN_W - 40 - 4) / 3,
    position: "relative",
    overflow: "hidden",
    borderRadius: 4,
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  gridOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  gridStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  gridStatText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "#fff",
  },
  emptyPosts: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyPostsText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textTertiary,
  },
});
