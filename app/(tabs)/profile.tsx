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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import { SKILL_LEVELS, SkillLevel } from "@/data/courts";
import Colors from "@/constants/colors";

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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, waitlists } = useApp();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(
    profile?.skillLevel ?? "Intermediate"
  );
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setSkillLevel(profile.skillLevel);
    }
  }, [profile?.username, profile?.skillLevel]);

  const totalWaitlists = Object.values(waitlists).reduce(
    (acc, list) => acc + list.length,
    0
  );
  const myWaitlists = Object.values(waitlists).filter((list) =>
    list.some((e) => e.userId === profile?.userId)
  ).length;

  async function handleSave() {
    if (!username.trim()) {
      Alert.alert("Name required", "Please enter your player name.");
      return;
    }
    setIsSaving(true);
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await updateProfile(username.trim(), skillLevel);
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const hasChanges =
    username !== (profile?.username ?? "") ||
    skillLevel !== (profile?.skillLevel ?? "Intermediate");

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Profile</Text>

      {profile ? (
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.username.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.avatarName}>{profile.username}</Text>
            <View style={[styles.skillBadge, { backgroundColor: SKILL_COLORS[profile.skillLevel] + "22" }]}>
              <Text style={[styles.skillBadgeText, { color: SKILL_COLORS[profile.skillLevel] }]}>
                {profile.skillLevel}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.welcomeBox}>
          <Ionicons name="person-circle-outline" size={40} color={Colors.accent} />
          <Text style={styles.welcomeTitle}>Set up your profile</Text>
          <Text style={styles.welcomeSub}>
            Add your name and skill level to join waitlists
          </Text>
        </View>
      )}

      {profile && (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{myWaitlists}</Text>
            <Text style={styles.statKey}>Queued</Text>
          </View>
          <View style={[styles.statDivider]} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {Object.keys(waitlists).length}
            </Text>
            <Text style={styles.statKey}>Courts</Text>
          </View>
          <View style={[styles.statDivider]} />
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
          returnKeyType="done"
          autoCorrect={false}
        />
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
        {saved ? (
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
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
  avatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.accent,
  },
  avatarName: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
    marginBottom: 6,
  },
  skillBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  skillBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  welcomeBox: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
  },
  welcomeSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
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
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
  },
  statKey: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
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
  skillGrid: {
    gap: 8,
  },
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
  skillLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  skillDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
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
  saveBtnDimmed: {
    opacity: 0.5,
  },
  saveBtnSuccess: {
    backgroundColor: Colors.green,
  },
  saveBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.background,
  },
});
