import { SkeletonBlock } from "@/shared/components/Skeleton";
import React from "react";
import { StyleSheet, View } from "react-native";

/**
 * Skeleton placeholder for the tracking screen's booking-detail drawer, mirroring the
 * real layout (trip summary, booking meta, pickup card, progress bar, driver card) so the
 * drawer doesn't jump in size once the real content swaps in.
 */
export function BookingDetailSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.tripSummaryRow}>
        <View>
          <SkeletonBlock width={90} height={12} style={styles.mb8} />
          <SkeletonBlock width={70} height={32} />
        </View>
        <View style={styles.tripSummaryRight}>
          <SkeletonBlock width={60} height={11} style={styles.mb8} />
          <SkeletonBlock width={50} height={18} />
        </View>
      </View>

      <View style={styles.metaRow}>
        <SkeletonBlock width={110} height={11} style={styles.mb8} />
        <SkeletonBlock width={140} height={16} />
      </View>
      <View style={styles.metaRow}>
        <SkeletonBlock width={80} height={11} style={styles.mb8} />
        <SkeletonBlock width={100} height={16} />
      </View>

      <View style={styles.pickupCard}>
        <SkeletonBlock width={100} height={12} style={styles.mb8} />
        <SkeletonBlock width="90%" height={16} />
      </View>

      <SkeletonBlock width="100%" height={6} borderRadius={999} style={styles.progressTrack} />

      <View style={styles.driverCard}>
        <SkeletonBlock width={52} height={52} borderRadius={26} />
        <View style={styles.driverInfoCol}>
          <SkeletonBlock width="60%" height={16} />
          <SkeletonBlock width="40%" height={14} />
          <SkeletonBlock width="30%" height={14} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  mb8: {
    marginBottom: 8,
  },
  tripSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  tripSummaryRight: {
    alignItems: "flex-end",
  },
  metaRow: {
    marginBottom: 20,
  },
  pickupCard: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  progressTrack: {
    marginBottom: 24,
  },
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
  },
  driverInfoCol: {
    flex: 1,
    gap: 8,
  },
});
