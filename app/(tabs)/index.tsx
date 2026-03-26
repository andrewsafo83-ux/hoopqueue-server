import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import CourtMap from "@/components/CourtMap";
import { useApp } from "@/context/AppContext";
import Colors from "@/constants/colors";

export default function NearbyScreen() {
  const { profile, loadDemoAccount } = useApp();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  async function handleDemo() {
    setLoading(true);
    try {
      await loadDemoAccount();
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <CourtMap />
      {!profile && (
        <View
          style={[
            styles.demoBanner,
            {
              top: Platform.OS === "web"
                ? insets.top + 67
                : insets.top + 60,
            },
          ]}
        >
          <Ionicons name="basketball-outline" size={18} color={Colors.accent} />
          <Text style={styles.demoText}>App Review?</Text>
          <TouchableOpacity
            style={styles.demoBtn}
            onPress={handleDemo}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.demoBtnText}>Tap for Demo Access</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  demoBanner: {
    position: "absolute",
    left: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.88)",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  demoText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#fff",
    flex: 1,
  },
  demoBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 140,
    alignItems: "center",
  },
  demoBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#fff",
  },
});
