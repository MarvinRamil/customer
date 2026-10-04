import { BeeColors } from '@/constants/theme';
import { useTheme } from '@/shared/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TrackingStep } from '../types';

/**
 * Props for TrackingTimeline component
 */
interface TrackingTimelineProps {
  /** Array of tracking steps */
  steps: TrackingStep[];
}

/**
 * Tracking timeline component
 * Displays the progress of a delivery with completed and pending steps
 * @param props - TrackingTimeline component props
 */
export function TrackingTimeline({ steps }: TrackingTimelineProps) {
  const theme = useTheme();

  return (
    <View style={styles.timeline}>
      {steps.map((step, index) => (
        <View key={index} style={styles.timelineItem}>
          <View
            style={[
              styles.timelineDot,
              {
                backgroundColor: step.completed
                  ? BeeColors.blue[500]
                  : theme.border,
              },
            ]}
          />
          {index !== steps.length - 1 && (
            <View
              style={[
                styles.timelineLine,
                {
                  backgroundColor: step.completed
                    ? BeeColors.blue[500]
                    : theme.border,
                },
              ]}
            />
          )}
          <View style={styles.timelineContent}>
            <Text
              style={[
                styles.timelineLabel,
                {
                  color: step.completed
                    ? theme.text
                    : theme.textSecondary,
                },
              ]}
            >
              {step.label}
            </Text>
            <Text style={[styles.timelineTime, { color: theme.textMuted }]}>
              {step.time}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: {
    paddingLeft: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
    position: 'relative',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 16,
    zIndex: 1,
    marginTop: 4,
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 16,
    width: 2,
    height: 40,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  timelineTime: {
    fontSize: 12,
  },
});

