
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { getApiUrl, apiRequest } from "@/lib/query-client";

const SCREEN_W = Dimensions.get("window").width;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Post {
  id: string;
  userId: string;
  username: string;
  avatarBase64: string | null;
  imageBase64: string;
  caption: string | null;
  courtId: string | null;
  courtName: string | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  userLiked: boolean;
}

interface Comment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  avatarBase64: string | null;
  text: string;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function Avatar({
  base64,
  username,
  size = 36,
}: {
  base64?: string | null;
  username: string;
  size?: number;
}) {
  if (base64) {
    return (
      <Image
        source={{ uri: `data:image/jpeg;base64,${base64}` }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: Colors.accent,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_700Bold",
          fontSize: size * 0.38,
          color: "#fff",
        }}
      >
        {(username[0] ?? "?").toUpperCase()}
      </Text>
    </View>
  );
}

// ── Comments Modal ────────────────────────────────────────────────────────────

function useWebKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const vv = (window as any).visualViewport;
    if (!vv) return;
    const update = () => {
      const kh = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardHeight(Math.max(0, kh));
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return keyboardHeight;
}

function CommentsModal({
  post,
  visible,
  onClose,
}: {
  post: Post | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { profile } = useApp();
  const insets = useSafeAreaInsets();
  const webKeyboardHeight = useWebKeyboardHeight();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const inputRef = useRef<TextInput>(null);

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ["/api/posts/comments", post?.id],
    queryFn: async () => {
      if (!post) return [];
      const url = new URL(`/api/posts/${post.id}/comments`, getApiUrl());
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: visible && !!post,
    refetchInterval: 5000,
  });

  const addComment = useMutation({
    mutationFn: async (commentText: string) => {
      if (!profile || !post) throw new Error("Not logged in");
      return apiRequest("POST", `/api/posts/${post.id}/comments`, {
        userId: profile.userId,
        username: profile.username,
        avatarBase64: profile.avatarBase64 ?? null,
        text: commentText,
      });
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["/api/posts/comments", post?.id] });
      qc.invalidateQueries({ queryKey: ["/api/feed", profile?.userId] });
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.message ?? "Could not post comment");
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      if (!profile) throw new Error("Not logged in");
      return apiRequest("DELETE", `/api/posts/${post?.id}/comments/${commentId}`, {
        userId: profile.userId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/posts/comments", post?.id] });
      qc.invalidateQueries({ queryKey: ["/api/feed", profile?.userId] });
    },
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || addComment.isPending) return;
    addComment.mutate(trimmed);
  };

  const handleDelete = (c: Comment) => {
    Alert.alert("Delete comment?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteComment.mutate(c.id) },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.modalContainer, { paddingBottom: Platform.OS === "web" ? webKeyboardHeight : insets.bottom }]}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {/* Handle & header */}
        <View style={styles.modalHeader}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Comments</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
        ) : comments.length === 0 ? (
          <View style={styles.emptyComments}>
            <Ionicons name="chatbubble-outline" size={36} color={Colors.textTertiary} />
            <Text style={styles.emptyCommentsText}>No comments yet. Be first!</Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: c }) => (
              <View style={styles.commentRow}>
                <Avatar base64={c.avatarBase64} username={c.username} size={32} />
                <View style={styles.commentBubble}>
                  <View style={styles.commentTopRow}>
                    <Text style={styles.commentUsername}>{c.username}</Text>
                    <Text style={styles.commentTime}>{timeAgo(c.createdAt)}</Text>
                  </View>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
                {profile?.userId === c.userId && (
                  <TouchableOpacity
                    onPress={() => handleDelete(c)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={14} color={Colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
        )}

        {/* Input */}
        {profile ? (
          <View style={styles.commentInputRow}>
            <Avatar base64={profile.avatarBase64} username={profile.username} size={32} />
            <TextInput
              ref={inputRef}
              style={styles.commentInput}
              placeholder="Add a comment…"
              placeholderTextColor={Colors.textTertiary}
              value={text}
              onChangeText={setText}
              maxLength={300}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!text.trim() || addComment.isPending}
              style={[
                styles.sendBtn,
                (!text.trim() || addComment.isPending) && { opacity: 0.4 },
              ]}
            >
              {addComment.isPending ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Ionicons name="send" size={18} color={Colors.accent} />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.loginPrompt}>Set up your profile to comment</Text>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Create Post Modal ─────────────────────────────────────────────────────────

function CreatePostModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { profile } = useApp();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [picking, setPicking] = useState(false);

  const reset = () => {
    setImageBase64(null);
    setCaption("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const pickImage = async (fromCamera: boolean) => {
    setPicking(true);
    try {
      let result: ImagePicker.ImagePickerResult;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== "granted") {
          Alert.alert("Permission needed", "Camera access is required to take photos.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.3,
          base64: true,
          exif: false,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== "granted") {
          Alert.alert("Permission needed", "Photo library access is required.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.3,
          base64: true,
          exif: false,
        });
      }
      if (!result.canceled && result.assets[0]?.base64) {
        setImageBase64(result.assets[0].base64);
      }
    } finally {
      setPicking(false);
    }
  };

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!profile || !imageBase64) throw new Error("Missing data");
      return apiRequest("POST", "/api/posts", {
        userId: profile.userId,
        username: profile.username,
        avatarBase64: profile.avatarBase64 ?? null,
        imageBase64,
        caption: caption.trim() || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/feed", profile?.userId] });
      handleClose();
    },
    onError: (err: any) => {
      Alert.alert("Could not post", err?.message ?? "Something went wrong");
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[
          styles.createContainer,
          { paddingTop: 0, paddingBottom: insets.bottom },
        ]}
        behavior="padding"
      >
        {/* Header */}
        <View style={[styles.createHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.createTitle}>New Post</Text>
          <TouchableOpacity
            onPress={() => postMutation.mutate()}
            disabled={!imageBase64 || postMutation.isPending}
            style={[
              styles.shareBtn,
              (!imageBase64 || postMutation.isPending) && { opacity: 0.4 },
            ]}
          >
            {postMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.shareBtnText}>Share</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Image area */}
        {imageBase64 ? (
          <View style={styles.imagePreviewWrap}>
            <Image
              source={{ uri: `data:image/jpeg;base64,${imageBase64}` }}
              style={styles.imagePreview}
            />
            <TouchableOpacity
              style={styles.changeImageBtn}
              onPress={() => setImageBase64(null)}
            >
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.changeImageText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.pickArea}>
            {picking ? (
              <ActivityIndicator size="large" color={Colors.accent} />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.pickBtn}
                  onPress={() => pickImage(false)}
                >
                  <Ionicons name="images" size={28} color={Colors.accent} />
                  <Text style={styles.pickBtnText}>Choose from Library</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pickBtn, { marginTop: 12 }]}
                  onPress={() => pickImage(true)}
                >
                  <Ionicons name="camera" size={28} color={Colors.accent} />
                  <Text style={styles.pickBtnText}>Take Photo</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Caption */}
        <View style={styles.captionWrap}>
          <Avatar
            base64={profile?.avatarBase64}
            username={profile?.username ?? "?"}
            size={36}
          />
          <TextInput
            style={styles.captionInput}
            placeholder="Write a caption…"
            placeholderTextColor={Colors.textTertiary}
            value={caption}
            onChangeText={setCaption}
            maxLength={300}
            multiline
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Post Card ─────────────────────────────────────────────────────────────────

function PostCard({
  post,
  onComment,
  onLike,
  onDelete,
  myUserId,
}: {
  post: Post;
  onComment: () => void;
  onLike: () => void;
  onDelete: () => void;
  myUserId: string | null;
}) {
  return (
    <View style={styles.card}>
      {/* Top row */}
      <View style={styles.cardTopRow}>
        <Avatar base64={post.avatarBase64} username={post.username} size={38} />
        <View style={styles.cardUserInfo}>
          <Text style={styles.cardUsername}>{post.username}</Text>
          {post.courtName ? (
            <View style={styles.courtTag}>
              <Ionicons name="basketball-outline" size={11} color={Colors.accent} />
              <Text style={styles.courtTagText}>{post.courtName}</Text>
            </View>
          ) : (
            <Text style={styles.cardTime}>{timeAgo(post.createdAt)}</Text>
          )}
        </View>
        <View style={styles.cardTopRight}>
          {post.courtName && (
            <Text style={styles.cardTimeSmall}>{timeAgo(post.createdAt)}</Text>
          )}
          {myUserId === post.userId && (
            <TouchableOpacity
              onPress={onDelete}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ marginLeft: 8 }}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Image */}
      <Image
        source={{ uri: `data:image/jpeg;base64,${post.imageBase64}` }}
        style={styles.postImage}
        resizeMode="cover"
      />

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onLike}>
          <Ionicons
            name={post.userLiked ? "heart" : "heart-outline"}
            size={24}
            color={post.userLiked ? Colors.red : Colors.text}
          />
          {post.likeCount > 0 && (
            <Text style={styles.actionCount}>{post.likeCount}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onComment}>
          <Ionicons name="chatbubble-outline" size={22} color={Colors.text} />
          {post.commentCount > 0 && (
            <Text style={styles.actionCount}>{post.commentCount}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Caption */}
      {post.caption ? (
        <View style={styles.captionRow}>
          <Text style={styles.captionUsername}>{post.username} </Text>
          <Text style={styles.captionBody}>{post.caption}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Feed Screen ───────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const { profile } = useApp();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [createVisible, setCreateVisible] = useState(false);
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const userId = profile?.userId ?? null;

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["/api/feed", userId],
    queryFn: async () => {
      if (!userId) return [];
      const url = new URL(`/api/feed/${userId}`, getApiUrl());
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!userId,
    refetchInterval: 15000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["/api/feed", userId] });
    setRefreshing(false);
  }, [qc, userId]);

  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!userId) throw new Error("Not logged in");
      return apiRequest("POST", `/api/posts/${postId}/like`, { userId });
    },
    onMutate: async (postId) => {
      await qc.cancelQueries({ queryKey: ["/api/feed", userId] });
      const prev = qc.getQueryData<Post[]>(["/api/feed", userId]);
      qc.setQueryData<Post[]>(["/api/feed", userId], (old = []) =>
        old.map((p) =>
          p.id === postId
            ? {
                ...p,
                userLiked: !p.userLiked,
                likeCount: p.userLiked ? p.likeCount - 1 : p.likeCount + 1,
              }
            : p
        )
      );
      return { prev };
    },
    onError: (_err, _postId, ctx) => {
      if (ctx?.prev) qc.setQueryData(["/api/feed", userId], ctx.prev);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!userId) throw new Error("Not logged in");
      return apiRequest("DELETE", `/api/posts/${postId}`, { userId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/feed", userId] });
    },
  });

  const handleDelete = (postId: string) => {
    Alert.alert("Delete post?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate(postId),
      },
    ]);
  };

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard
        post={item}
        myUserId={userId}
        onLike={() => likeMutation.mutate(item.id)}
        onComment={() => setCommentPost(item)}
        onDelete={() => handleDelete(item.id)}
      />
    ),
    [userId, likeMutation]
  );

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={styles.feedHeader}>
          <Text style={styles.feedTitle}>Feed</Text>
        </View>
        <View style={styles.noProfile}>
          <Ionicons name="person-circle-outline" size={56} color={Colors.textTertiary} />
          <Text style={styles.noProfileTitle}>Set up your profile first</Text>
          <Text style={styles.noProfileSub}>
            Go to the Profile tab to create your account, then come back here to see
            posts from you and your friends.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.feedHeader}>
        <Text style={styles.feedTitle}>Feed</Text>
        <TouchableOpacity
          style={styles.createPostBtn}
          onPress={() => setCreateVisible(true)}
        >
          <Ionicons name="add-circle" size={28} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator
          color={Colors.accent}
          style={{ marginTop: 60 }}
          size="large"
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={renderPost}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews={Platform.OS === "android"}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="images-outline" size={56} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptySub}>
                Add friends and start posting to fill your feed.
              </Text>
              <TouchableOpacity
                style={styles.firstPostBtn}
                onPress={() => setCreateVisible(true)}
              >
                <Ionicons name="camera" size={16} color="#fff" />
                <Text style={styles.firstPostBtnText}>Create your first post</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <CreatePostModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
      />
      <CommentsModal
        post={commentPost}
        visible={!!commentPost}
        onClose={() => setCommentPost(null)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  feedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  feedTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  createPostBtn: { padding: 4 },

  list: { paddingTop: 4 },

  card: {
    backgroundColor: Colors.background,
    marginBottom: 20,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  cardUserInfo: { flex: 1 },
  cardUsername: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
  },
  cardTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  cardTimeSmall: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textTertiary,
  },
  cardTopRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  courtTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  courtTagText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.accent,
  },
  postImage: {
    width: SCREEN_W,
    height: SCREEN_W,
    backgroundColor: Colors.surface,
  },
  actions: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionCount: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
  },
  captionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  captionUsername: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: Colors.text,
  },
  captionBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.text,
  },

  noProfile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  noProfileTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
    textAlign: "center",
  },
  noProfileSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },

  empty: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
  },
  emptySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  firstPostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 8,
  },
  firstPostBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },

  // Comments modal
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalHandle: {
    display: "none",
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: Colors.text,
  },
  emptyComments: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyCommentsText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.textSecondary,
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 10,
  },
  commentTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  commentUsername: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.text,
  },
  commentTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textTertiary,
  },
  commentText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
    maxHeight: 80,
  },
  sendBtn: { padding: 4 },
  loginPrompt: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    padding: 20,
  },

  // Create post modal
  createContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  createHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cancelText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.textSecondary,
  },
  createTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: Colors.text,
  },
  shareBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  shareBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#fff",
  },
  pickArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  pickBtn: {
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 40,
    borderWidth: 1,
    borderColor: Colors.border,
    width: SCREEN_W - 64,
  },
  pickBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  imagePreviewWrap: {
    position: "relative",
    alignSelf: "center",
    marginTop: 16,
  },
  imagePreview: {
    width: SCREEN_W - 32,
    height: SCREEN_W - 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  changeImageBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  changeImageText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#fff",
  },
  captionWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 16,
  },
  captionInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    maxHeight: 100,
  },
});
