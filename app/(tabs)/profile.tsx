import React, { useState, useEffect } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useApp } from "@/context/AppContext";
import { SKILL_LEVELS, SkillLevel } from "@/data/courts";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

const ADMIN_USER_ID = "17731833451956z1lxkg";

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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, updateProfile, waitlists } = useApp();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(
    profile?.skillLevel ?? "Intermediate"
  );
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setEmail(profile.email ?? "");
      setSkillLevel(profile.skillLevel);
    }
  }, [profile?.username, profile?.email, profile?.skillLevel]);

  const myWaitlists = Object.values(waitlists).filter((list) =>
    list.some((e) => e.userId === profile?.userId)
  ).length;

  function validateEmail(val: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
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
    setEmailError("");
    setIsSaving(true);
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      await updateProfile(username.trim(), email.trim().toLowerCase(), skillLevel);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      if (err?.message?.includes("409") || err?.message?.includes("email")) {
        setEmailError("That email is already registered to another account.");
      } else {
        Alert.alert("Error", "Could not save profile. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  const hasChanges =
    username !== (profile?.username ?? "") ||
    email !== (profile?.email ?? "") ||
    skillLevel !== (profile?.skillLevel ?? "Intermediate");

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Profile</Text>

      {profile ? (
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.username.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.avatarName}>{profile.username}</Text>
            {profile.email ? (
              <Text style={styles.avatarEmail}>{profile.email}</Text>
            ) : null}
            <View style={[styles.skillBadge, { backgroundColor: SKILL_COLORS[profile.skillLevel] + "22" }]}>
              <Text style={[styles.skillBadgeText, { color: SKILL_COLORS[profile.skillLevel] }]}>
                {profile.skillLevel}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.welcomeBox}>
          <Ionicons name="person-circle-outline" size={48} color={Colors.accent} />
          <Text style={styles.welcomeTitle}>Create your player profile</Text>
          <Text style={styles.welcomeSub}>
            Set your name, email, and skill level to join waitlists and post in the live feed
          </Text>
        </View>
      )}

      {profile && (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{myWaitlists}</Text>
            <Text style={styles.statKey}>Queued</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{Object.keys(waitlists).length}</Text>
            <Text style={styles.statKey}>Courts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: SKILL_COLORS[profile.skillLevel] }]}>
              {profile.skillLevel.charAt(0)}
            </Text>
            <Text style={styles.statKey}>Level</Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Player Name</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Enter your name"
          placeholderTextColor={Colors.textTertiary}
          maxLength={30}
          returnKeyType="next"
          autoCorrect={false}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Email Address</Text>
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
          returnKeyType="done"
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
          <Text style={styles.fieldHint}>Used to save your spot and send updates</Text>
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

      {profile?.userId === ADMIN_USER_ID && (
        <TouchableOpacity
          style={styles.adminBtn}
          onPress={() => router.push("/admin")}
          activeOpacity={0.8}
        >
          <Ionicons name="bar-chart-outline" size={18} color={Colors.accent} />
          <Text style={styles.adminBtnText}>Admin Dashboard</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
        </TouchableOpacity>
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
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 26, color: Colors.accent },
  avatarName: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text, marginBottom: 2 },
  avatarEmail: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
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
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 10,
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
  adminBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 32,
    backgroundColor: Colors.accentDim,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.accent + "40",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  adminBtnText: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.accent,
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
  versionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: "center",
    marginTop: 20,
    marginBottom: 8,
  },
});
