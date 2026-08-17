import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
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
    isGeneratingStory,
    setGeneratingStory,
    setStoryDraft,
  } = useStore();

  const [isRefreshingClips, setIsRefreshingClips] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<typeof events[number] | null>(null);

  // 只取带照片的事件，最新的在前
  const photoEvents = events
    .filter((e) => e.isPhoto && e.photoUri)
    .sort((a, b) => b.timestamp - a.timestamp);

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
          <Ionicons name="images-outline" size={20} color="#585594" />
          <Text style={styles.headerTitle}>Photo Memories</Text>
        </View>
      </View>

      {/* Photo Events List */}
      {photoEvents.length === 0 ? (
        <View style={styles.emptyArea}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="images-outline" size={32} color="#b0adb8" />
          </View>
          <Text style={styles.emptyTitle}>No Photos Yet</Text>
          <Text style={styles.emptyText}>
            Take a photo from the Event page to see it here with a detailed reflection.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {photoEvents.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.eventCard}
              onPress={() => setSelectedEvent(event)}
              activeOpacity={0.85}
            >
              {/* 缩略图 */}
              <Image source={{ uri: event.photoUri }} style={styles.eventThumb} contentFit="cover" />

              {/* 简短文字：时间 / 地点 / 标题 */}
              <View style={styles.eventInfoCol}>
                <View style={styles.eventTimeRow}>
                  <Text style={styles.eventTime}>{event.time}</Text>
                  {event.location ? (
                    <Text style={styles.eventLocation} numberOfLines={1}>{event.location}</Text>
                  ) : null}
                </View>
                <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                <View style={styles.eventArrowRow}>
                  <Ionicons name="chevron-forward" size={14} color="#b0adb8" />
                </View>
              </View>
            </TouchableOpacity>
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

      {/* Photo Detail Modal */}
      <Modal
        visible={!!selectedEvent}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setSelectedEvent(null)}
          />
          <View style={styles.modalCard}>
            {/* 上方：拍摄的图片 */}
            {selectedEvent?.photoUri ? (
              <Image
                source={{ uri: selectedEvent.photoUri }}
                style={styles.modalImage}
                contentFit="cover"
              />
            ) : null}
            {/* 下方：详细介绍文字 */}
            <View style={styles.modalBody}>
              <View style={styles.modalTitleRow}>
                <Text style={styles.modalTime}>{selectedEvent?.time}</Text>
                {selectedEvent?.location ? (
                  <Text style={styles.modalLocation} numberOfLines={1}>
                    {selectedEvent.location}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.modalTitle}>{selectedEvent?.title}</Text>
              {selectedEvent?.additional_info ? (
                <Text style={styles.modalDetail}>{selectedEvent.additional_info}</Text>
              ) : null}
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedEvent(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // Event Card（缩略图 + 简短文字）
  eventCard: {
    flexDirection: 'row', gap: 14, alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 24, padding: 14, marginBottom: 12,
    shadowColor: '#585594', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 16, elevation: 3,
  },
  eventThumb: { width: 84, height: 84, borderRadius: 18, backgroundColor: '#f5f3ee' },
  eventInfoCol: { flex: 1, justifyContent: 'center' },
  eventTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventTime: { fontSize: 18, fontWeight: '700', color: '#585594' },
  eventLocation: { flex: 1, fontSize: 12, fontWeight: '600', color: '#787681', textAlign: 'right' },
  eventTitle: { fontSize: 16, fontWeight: '700', color: '#1b1c19', marginTop: 4 },
  eventArrowRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },

  // Photo Detail Modal（半透明黑遮罩 + 大卡片）
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(27,28,25,0.6)' },
  modalCard: {
    width: '100%', maxHeight: '80%', backgroundColor: '#fff', borderRadius: 24,
    overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 10,
  },
  modalImage: { width: '100%', height: 220, backgroundColor: '#f5f3ee' },
  modalBody: { padding: 20 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTime: { fontSize: 18, fontWeight: '700', color: '#585594' },
  modalLocation: { flex: 1, fontSize: 13, fontWeight: '600', color: '#787681', textAlign: 'right' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1b1c19', marginTop: 6 },
  modalDetail: { fontSize: 14, color: '#474650', lineHeight: 22, marginTop: 8, fontStyle: 'italic' },
  modalCloseBtn: { alignSelf: 'center', marginTop: 18, backgroundColor: '#585594', paddingVertical: 10, paddingHorizontal: 28, borderRadius: 20 },
  modalCloseText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Floating Buttons
  floatingActions: { position: 'absolute', bottom: 100, left: 18, right: 18, flexDirection: 'row', gap: 10 },
  refreshPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 28, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e3dfff', shadowColor: '#585594', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  refreshPillText: { color: '#585594', fontWeight: '700', fontSize: 13, letterSpacing: 0.3 },
  storyPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 28, backgroundColor: '#585594', shadowColor: '#585594', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 6 },
  storyPillText: { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.6 },
});

