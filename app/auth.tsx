import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useApp } from "@/context/AppContext";
import { SKILL_LEVELS, SkillLevel } from "@/data/courts";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

type Tab = "login" | "signup";
type ForgotStep = "email" | "code" | "newpass";

const SKILL_DESCRIPTIONS: Record<SkillLevel, string> = {
  Beginner: "Just learning",
  Intermediate: "Hold my own",
  Advanced: "Competitive",
  Pro: "College / Pro",
};

const SKILL_COLORS: Record<SkillLevel, string> = {
  Beginner: "#60A5FA",
  Intermediate: Colors.green,
  Advanced: Colors.accent,
  Pro: "#A855F7",
};

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, register } = useApp();

  const [tab, setTab] = useState<Tab>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>("email");

  // Login fields
  const [loginId, setLoginId] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginShowPass, setLoginShowPass] = useState(false);

  // Signup fields
  const [signUsername, setSignUsername] = useState("");
  const [signEmail, setSignEmail] = useState("");
  const [signPass, setSignPass] = useState("");
  const [signPassConfirm, setSignPassConfirm] = useState("");
  const [signShowPass, setSignShowPass] = useState(false);
  const [signSkill, setSignSkill] = useState<SkillLevel>("Intermediate");

  // Forgot password fields
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotShowPass, setForgotShowPass] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);

  const clearError = useCallback(() => setError(""), []);

  const handleLogin = useCallback(async () => {
    if (!loginId.trim() || !loginPass) {
      setError("Please enter your email/username and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(loginId.trim(), loginPass);
      router.replace("/(tabs)" as never);
    } catch (e: any) {
      setError(e.message ?? "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [loginId, loginPass, login, router]);

  const handleSignup = useCallback(async () => {
    if (!signUsername.trim() || !signEmail.trim() || !signPass) {
      setError("Please fill in all fields.");
      return;
    }
    if (signPass !== signPassConfirm) {
      setError("Passwords do not match.");
      return;
    }
    if (signPass.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await register(signUsername.trim(), signEmail.trim(), signPass, signSkill);
      router.replace("/(tabs)" as never);
    } catch (e: any) {
      setError(e.message ?? "Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [signUsername, signEmail, signPass, signPassConfirm, signSkill, register, router]);

  const handleForgotSendCode = useCallback(async () => {
    if (!forgotEmail.trim()) {
      setError("Please enter your email.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const url = new URL("/api/auth/forgot-password", getApiUrl());
      await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      setForgotStep("code");
    } catch {
      setError("Could not send code. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [forgotEmail]);

  const handleForgotVerifyCode = useCallback(() => {
    if (!forgotCode.trim() || forgotCode.trim().length !== 6) {
      setError("Please enter the 6-digit code from your email.");
      return;
    }
    setError("");
    setForgotStep("newpass");
  }, [forgotCode]);

  const handleForgotReset = useCallback(async () => {
    if (!forgotNewPass || forgotNewPass.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const url = new URL("/api/auth/reset-password", getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim(), code: forgotCode.trim(), newPassword: forgotNewPass }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.message ?? "Failed to reset password.");
        return;
      }
      Alert.alert("Password updated!", "Your password has been reset. Please log in.", [
        { text: "OK", onPress: () => { setShowForgot(false); setForgotStep("email"); setForgotEmail(""); setForgotCode(""); setForgotNewPass(""); setError(""); } }
      ]);
    } catch {
      setError("Could not reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [forgotEmail, forgotCode, forgotNewPass]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (showForgot) {
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: bottomPad + 24 }]} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backBtn} onPress={() => { setShowForgot(false); setForgotStep("email"); setForgotEmail(""); setForgotCode(""); setForgotNewPass(""); setError(""); }}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.logoArea}>
            <Text style={styles.logo}>HoopQueue</Text>
          </View>

          <Text style={styles.forgotTitle}>
            {forgotStep === "email" ? "Reset Password" : forgotStep === "code" ? "Enter Code" : "New Password"}
          </Text>
          <Text style={styles.forgotSub}>
            {forgotStep === "email"
              ? "Enter the email linked to your account."
              : forgotStep === "code"
              ? `We sent a 6-digit code to ${forgotEmail}.`
              : "Choose a new password for your account."}
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {forgotStep === "email" && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={Colors.textSecondary}
                value={forgotEmail}
                onChangeText={(t) => { setForgotEmail(t); clearError(); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleForgotSendCode} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send Code</Text>}
              </TouchableOpacity>
            </>
          )}

          {forgotStep === "code" && (
            <>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="000000"
                placeholderTextColor={Colors.textSecondary}
                value={forgotCode}
                onChangeText={(t) => { setForgotCode(t.replace(/\D/g, "").slice(0, 6)); clearError(); }}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity style={styles.btn} onPress={handleForgotVerifyCode} activeOpacity={0.85}>
                <Text style={styles.btnText}>Continue</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={() => { setForgotCode(""); setForgotStep("email"); setError(""); }}>
                <Text style={styles.linkText}>Resend code</Text>
              </TouchableOpacity>
            </>
          )}

          {forgotStep === "newpass" && (
            <>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="New password"
                  placeholderTextColor={Colors.textSecondary}
                  value={forgotNewPass}
                  onChangeText={(t) => { setForgotNewPass(t); clearError(); }}
                  secureTextEntry={!forgotShowPass}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setForgotShowPass(!forgotShowPass)}>
                  <Ionicons name={forgotShowPass ? "eye-off" : "eye"} size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled, { marginTop: 16 }]} onPress={handleForgotReset} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reset Password</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: topPad + 24, paddingBottom: bottomPad + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Logo */}
        <View style={styles.logoArea}>
          <Ionicons name="basketball" size={52} color={Colors.accent} />
          <Text style={styles.logo}>HoopQueue</Text>
          <Text style={styles.tagline}>The home for pickup basketball</Text>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tabBtn, tab === "login" && styles.tabBtnActive]} onPress={() => { setTab("login"); clearError(); }} activeOpacity={0.8}>
            <Text style={[styles.tabText, tab === "login" && styles.tabTextActive]}>Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, tab === "signup" && styles.tabBtnActive]} onPress={() => { setTab("signup"); clearError(); }} activeOpacity={0.8}>
            <Text style={[styles.tabText, tab === "signup" && styles.tabTextActive]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {tab === "login" ? (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email or username"
              placeholderTextColor={Colors.textSecondary}
              value={loginId}
              onChangeText={(t) => { setLoginId(t); clearError(); }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passRef.current?.focus()}
            />
            <View style={styles.inputRow}>
              <TextInput
                ref={passRef}
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Password"
                placeholderTextColor={Colors.textSecondary}
                value={loginPass}
                onChangeText={(t) => { setLoginPass(t); clearError(); }}
                secureTextEntry={!loginShowPass}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setLoginShowPass(!loginShowPass)}>
                <Ionicons name={loginShowPass ? "eye-off" : "eye"} size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotLink} onPress={() => { setShowForgot(true); setForgotEmail(loginId.includes("@") ? loginId : ""); setError(""); }}>
              <Text style={styles.forgotLinkText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Log In</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Username (letters, numbers, _)"
              placeholderTextColor={Colors.textSecondary}
              value={signUsername}
              onChangeText={(t) => { setSignUsername(t); clearError(); }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
            <TextInput
              ref={emailRef}
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={Colors.textSecondary}
              value={signEmail}
              onChangeText={(t) => { setSignEmail(t); clearError(); }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              returnKeyType="next"
            />
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Password (min 6 characters)"
                placeholderTextColor={Colors.textSecondary}
                value={signPass}
                onChangeText={(t) => { setSignPass(t); clearError(); }}
                secureTextEntry={!signShowPass}
                autoCapitalize="none"
                returnKeyType="next"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setSignShowPass(!signShowPass)}>
                <Ionicons name={signShowPass ? "eye-off" : "eye"} size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor={Colors.textSecondary}
              value={signPassConfirm}
              onChangeText={(t) => { setSignPassConfirm(t); clearError(); }}
              secureTextEntry={!signShowPass}
              autoCapitalize="none"
              returnKeyType="done"
            />

            <Text style={styles.skillLabel}>Skill Level</Text>
            <View style={styles.skillRow}>
              {SKILL_LEVELS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.skillChip, signSkill === s && { backgroundColor: SKILL_COLORS[s], borderColor: SKILL_COLORS[s] }]}
                  onPress={() => setSignSkill(s)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.skillChipText, signSkill === s && styles.skillChipTextActive]}>{s}</Text>
                  <Text style={[styles.skillChipDesc, signSkill === s && styles.skillChipDescActive]}>{SKILL_DESCRIPTIONS[s]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSignup} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    marginBottom: 8,
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 36,
  },
  logo: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: Colors.accent,
    marginTop: 8,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    fontFamily: "Inter_400Regular",
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: Colors.background,
  },
  tabText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
  },
  form: {
    gap: 0,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  eyeBtn: {
    padding: 14,
  },
  forgotLink: {
    alignSelf: "flex-end",
    marginBottom: 16,
    marginTop: 2,
  },
  forgotLinkText: {
    color: Colors.accent,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  btn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  errorText: {
    color: Colors.red,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 20,
  },
  skillLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: "Inter_500Medium",
    marginBottom: 10,
    marginTop: 2,
  },
  skillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  skillChip: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    minWidth: "45%",
    flex: 1,
  },
  skillChipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  skillChipTextActive: {
    color: "#fff",
  },
  skillChipDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  skillChipDescActive: {
    color: "rgba(255,255,255,0.8)",
  },
  forgotTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 8,
  },
  forgotSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    marginBottom: 24,
    lineHeight: 20,
  },
  codeInput: {
    fontSize: 28,
    letterSpacing: 12,
    textAlign: "center",
    fontFamily: "Inter_700Bold",
  },
  linkBtn: {
    alignItems: "center",
    paddingVertical: 14,
  },
  linkText: {
    color: Colors.accent,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
