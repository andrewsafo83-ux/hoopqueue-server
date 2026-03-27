import React from "react";
import { View, StyleSheet } from "react-native";
import CourtMap from "@/components/CourtMap";

export default function NearbyScreen() {
  return (
    <View style={styles.container}>
      <CourtMap />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
