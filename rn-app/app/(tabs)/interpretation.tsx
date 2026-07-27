import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useStore } from '../../store/useStore';
import { API_URL } from '../../constants/Config';
import { getLocalDateString } from '../../utils/date';
import { evaluateRecentClips } from '../../utils/clipLogic';

export default function InterpretationLayer() {
  const {
    clips,
    events,
    updateClip,
    deleteClip,
    isGeneratingStory,
    setGeneratingStory,
    setStoryDraft,
  } = useStore();
  const sortedClips = [...clips].sort((a, b) => b.createdAt - a.createdAt);

  const [isRefreshingClips, setIsRefreshingClips] = useState(false);

  const formatClipTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleManualRefreshClips = async () => {
    setIsRefreshingClips(true);
    try {
      await evaluateRecentClips(true);
      Alert.alert('Success', 'Checked for new events and updated clips!');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to refresh clips.');
    } finally {
      setIsRefreshingClips(false);
    }
  };

  const confirmDelete = (id: string) => {
    Alert.alert(
      'Delete Clip',
      'Are you sure you want to delete this memory clip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteClip(id),
        },
      ]
    );
  };

  const handleGenerateStory = async () => {
    const today = getLocalDateString();
    const todayClips = clips
      .filter((c) => c.slotId.startsWith(today))
      .sort((a, b) => a.createdAt - b.createdAt);

    if (todayClips.length === 0) {
      Alert.alert(
        'No Clips Today',
        'AI creates interpretation clips every hour. Once you have at least one clip from today, you can generate your daily story!'
      );
      return;
    }

    const clipsText = todayClips.map((c) => c.text).join('\n\n');
    const eventSummaries = events
      .filter((e) => getLocalDateString(new Date(e.timestamp)) === today)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((e) => {
        const parts = [`[${e.time}] ${e.title}`];
        if (e.duration && e.duration > 0) parts.push(`Duration: ${Math.round(e.duration)}m`);
        if (e.weather && e.weather !== 'Unknown') parts.push(`Weather: ${e.weather}, ${e.temperature}`);
        if (e.mood) parts.push(`Mood: ${e.mood}`);
        if (e.additional_info) parts.push(`Context: ${e.additional_info}`);
        return parts.join(' | ');
      })
      .join('\n');

    setGeneratingStory(true);
    try {
      const response = await fetch(`${API_URL}/generate_story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: useStore.getState().userName,
          clips_text: clipsText,
          event_summaries: eventSummaries,
          style: 'Classic',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setStoryDraft({
          text: data.story_text,
          style: 'Classic',
          date: today,
          mood: data.mood,
        });
        Alert.alert('Success', 'Your story draft has been generated! Check the Story tab.');
      } else {
        Alert.alert('Error', 'Server failed to generate story.');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to contact server.');
    } finally {
      setGeneratingStory(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greetingText}>Interpretation</Text>
        <View style={styles.headerTitleRow}>
          <Ionicons name="sparkles" size={20} color="#585594" />
          <Text style={styles.headerTitle}>AI Reflective Clips</Text>
        </View>
      </View>

      {/* Timeline */}
      {sortedClips.length === 0 ? (
        <View style={styles.emptyArea}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="hourglass-outline" size={32} color="#b0adb8" />
          </View>
          <Text style={styles.emptyTitle}>No Clips Yet</Text>
          <Text style={styles.emptyText}>
            AI evaluates your events every hour to weave them into reflective clips.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {sortedClips.map((clip) => (
            <View key={clip.id} style={styles.timelineCard}>
              {/* Top Row: Time + Meta + More */}
              <View style={styles.timelineTopRow}>
                <View style={styles.timelineLeftGroup}>
                  <Text style={styles.timelineTime}>
                    {formatClipTime(clip.createdAt)}
                  </Text>
                  <View style={styles.timelineMetaCol}>
                    <Text style={styles.timelineSlot} numberOfLines={1}>
                      {clip.title || clip.slotId}
                    </Text>
                    <View style={styles.aiSparkRow}>
                      <Ionicons name="sparkles" size={10} color="#706eaf" />
                      <Text style={styles.aiSparkLabel}>AI Clip</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => confirmDelete(clip.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color="#c8c5d1" />
                </TouchableOpacity>
              </View>

              {/* Bottom Row: Icon + Content */}
              <View style={styles.timelineBodyRow}>
                <View style={styles.timelineIconCircle}>
                  <Ionicons name="text-outline" size={16} color="#585594" />
                </View>
                <TextInput
                  style={styles.timelineContent}
                  multiline
                  value={clip.text}
                  onChangeText={(newText) => updateClip(clip.id, newText)}
                  scrollEnabled={false}
                  placeholderTextColor="#b0adb8"
                />
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Floating Action Buttons */}
      <View style={styles.floatingActions}>
        <TouchableOpacity
          style={[styles.refreshPill, isRefreshingClips && styles.btnDisabled]}
          onPress={handleManualRefreshClips}
          disabled={isRefreshingClips || isGeneratingStory}
          activeOpacity={0.8}
        >
          {isRefreshingClips ? (
            <ActivityIndicator size="small" color="#585594" />
          ) : (
            <Ionicons name="refresh" size={16} color="#585594" />
          )}
          <Text style={styles.refreshPillText}>
            {isRefreshingClips ? 'Refreshing' : 'Refresh Clips'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.storyPill, isGeneratingStory && styles.btnDisabled]}
          onPress={handleGenerateStory}
          disabled={isGeneratingStory || isRefreshingClips}
          activeOpacity={0.85}
        >
          {isGeneratingStory ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="sparkles" size={16} color="#fff" />
          )}
          <Text style={styles.storyPillText}>
            {isGeneratingStory ? 'Generating' : "Write Today's Story"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf9f4' },

  // Header
  header: { paddingTop: 56, paddingBottom: 12, paddingHorizontal: 22 },
  greetingText: { fontSize: 15, color: '#787681', fontWeight: '500' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1b1c19' },

  // Empty
  emptyArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 120 },
  emptyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#f5f3ee', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1b1c19', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#787681', textAlign: 'center', lineHeight: 20 },

  // Scroll
  scrollContent: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 140 },

  // Timeline Card
  timelineCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 12,
    shadowColor: '#585594', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 16, elevation: 3,
  },
  timelineTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  timelineLeftGroup: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  timelineTime: { fontSize: 32, fontWeight: '700', color: '#585594' },
  timelineMetaCol: { flexDirection: 'column', flex: 1 },
  timelineSlot: { fontSize: 14, fontWeight: '700', color: '#474650', opacity: 0.7 },
  aiSparkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  aiSparkLabel: { fontSize: 11, color: '#706eaf', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  timelineBodyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  timelineIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e3dfff', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  timelineContent: { flex: 1, fontSize: 15, color: '#1b1c19', lineHeight: 22, fontStyle: 'italic', padding: 10, backgroundColor: '#f5f3ee', borderRadius: 14, minHeight: 60, textAlignVertical: 'top' },

  // Floating Buttons
  floatingActions: { position: 'absolute', bottom: 100, left: 18, right: 18, flexDirection: 'row', gap: 10 },
  refreshPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 28, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e3dfff', shadowColor: '#585594', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  refreshPillText: { color: '#585594', fontWeight: '700', fontSize: 13, letterSpacing: 0.3 },
  storyPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 28, backgroundColor: '#585594', shadowColor: '#585594', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 6 },
  storyPillText: { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.6 },
});

