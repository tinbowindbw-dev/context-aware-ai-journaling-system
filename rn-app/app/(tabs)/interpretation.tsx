import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
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

function EventVideoPlayer({ uri, preview = false }: { uri: string; preview?: boolean }) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = true;
  });

  return (
    <VideoView
      player={player}
      style={preview ? styles.eventThumb : styles.modalVideo}
      nativeControls={!preview}
      contentFit="cover"
    />
  );
}

export default function InterpretationLayer() {
  const {
    clips,
    events,
    isGeneratingStory,
    setGeneratingStory,
    setStoryDraft,
    updateEventText,
  } = useStore();

  const [isRefreshingClips, setIsRefreshingClips] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<typeof events[number] | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDetail, setEditDetail] = useState('');
  const [showFullImage, setShowFullImage] = useState(false);

  // 只取带照片的事件，最新的在前
  const mediaEvents = events
    .filter((e) => (e.isPhoto && e.photoUri) || (e.isVideo && e.videoUri))
    .sort((a, b) => b.timestamp - a.timestamp);

  const startEditing = (event: typeof events[number]) => {
    setEditingEventId(event.id);
    setEditTitle(event.title);
    setEditDetail(event.additional_info || '');
  };

  const saveEditing = () => {
    if (!selectedEvent) return;
    const newTitle = editTitle.trim();
    const newDetail = editDetail.trim();
    updateEventText(selectedEvent.id, {
      title: newTitle || selectedEvent.title,
      additional_info: newDetail,
    });
    setSelectedEvent({
      ...selectedEvent,
      title: newTitle || selectedEvent.title,
      additional_info: newDetail,
    });
    setEditingEventId(null);
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

  const handleGenerateStory = async () => {
    const today = getLocalDateString();
    const todayClips = clips
      .filter((c) => c.slotId.startsWith(today))
      .sort((a, b) => a.createdAt - b.createdAt);

    const todayEvents = events
      .filter((e) => getLocalDateString(new Date(e.timestamp)) === today)
      .sort((a, b) => a.timestamp - b.timestamp);

    // 当天没有任何事件也没有 clips，直接提示
    if (todayClips.length === 0 && todayEvents.length === 0) {
      Alert.alert(
        'No Events Today',
        'Add a moment on the Event page first, then generate your daily story!'
      );
      return;
    }

    // 优先用 AI 生成的 clips；如果还没有 clips，降级用当天事件摘要直接生成
    const clipsText = todayClips.length > 0
      ? todayClips.map((c) => c.text).join('\n\n')
      : todayEvents
        .map((e) => {
          const parts = [`[${e.time}] ${e.title}`];
          if (e.duration && e.duration > 0) parts.push(`Duration: ${Math.round(e.duration)}m`);
          if (e.weather && e.weather !== 'Unknown') parts.push(`Weather: ${e.weather}, ${e.temperature}`);
          if (e.mood) parts.push(`Mood: ${e.mood}`);
          if (e.additional_info) parts.push(`Context: ${e.additional_info}`);
          return parts.join(' | ');
        })
        .join('\n');

    const eventSummaries = todayEvents
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

      {/* Photo and Video Events List */}
      {mediaEvents.length === 0 ? (
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
          {mediaEvents.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.eventCard}
              onPress={() => setSelectedEvent(event)}
              activeOpacity={0.85}
            >
              {/* 缩略图或视频预览 */}
              {event.isVideo && event.videoUri ? (
                <View style={styles.mediaThumbWrap}>
                  <EventVideoPlayer uri={event.videoUri} preview />
                  <View style={styles.videoPlayBadge}>
                    <Ionicons name="play" size={14} color="#fff" />
                  </View>
                </View>
              ) : (
                <Image source={{ uri: event.photoUri }} style={styles.eventThumb} contentFit="cover" />
              )}

              {/* 简短文字：时间 / 地点 / 天气 / 标题 */}
              <View style={styles.eventInfoCol}>
                <View style={styles.eventTimeRow}>
                  <Text style={styles.eventTime}>{event.time}</Text>
                  {event.location ? (
                    <Text style={styles.eventLocation} numberOfLines={1}>{event.location}</Text>
                  ) : null}
                </View>
                {event.weather && event.weather !== 'Unknown' ? (
                  <Text style={styles.eventWeather} numberOfLines={1}>
                    {event.weather}
                    {event.temperature && event.temperature !== 'N/A' ? `, ${event.temperature}°C` : ''}
                  </Text>
                ) : null}
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
        statusBarTranslucent
        onRequestClose={() => setSelectedEvent(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setSelectedEvent(null)}
          />
          <View style={styles.modalCard}>
            {/* 上方：拍摄的图片或视频（点击可查看全图） */}
            {selectedEvent?.isVideo && selectedEvent.videoUri ? (
              <EventVideoPlayer uri={selectedEvent.videoUri} />
            ) : selectedEvent?.photoUri ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setShowFullImage(true)}
              >
                <Image
                  source={{ uri: selectedEvent.photoUri }}
                  style={styles.modalImage}
                  contentFit="cover"
                />
                <View style={styles.fullImageBadge}>
                  <Ionicons name="expand-outline" size={18} color="#fff" />
                </View>
              </TouchableOpacity>
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
                {editingEventId === selectedEvent?.id ? (
                  <TouchableOpacity
                    style={styles.editToggleBtn}
                    onPress={saveEditing}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.editToggleBtnOutline}
                    onPress={() => selectedEvent && startEditing(selectedEvent)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pencil" size={16} color="#585594" />
                  </TouchableOpacity>
                )}
              </View>
              {editingEventId === selectedEvent?.id ? (
                <TextInput
                  style={styles.editTitleInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  multiline
                  placeholder="Event title"
                  placeholderTextColor="#b0adb8"
                />
              ) : (
                <Text style={styles.modalTitle}>{selectedEvent?.title}</Text>
              )}
              {selectedEvent?.weather && selectedEvent.weather !== 'Unknown' && editingEventId !== selectedEvent.id ? (
                <View style={styles.modalWeatherRow}>
                  <Ionicons name="partly-sunny-outline" size={13} color="#585594" />
                  <Text style={styles.modalWeather}>
                    {selectedEvent.weather}
                    {selectedEvent.temperature && selectedEvent.temperature !== 'N/A' ? `, ${selectedEvent.temperature}°C` : ''}
                  </Text>
                </View>
              ) : null}
              {editingEventId === selectedEvent?.id ? (
                <TextInput
                  style={styles.editDetailInput}
                  value={editDetail}
                  onChangeText={setEditDetail}
                  multiline
                  placeholder="Add a detailed description..."
                  placeholderTextColor="#b0adb8"
                />
              ) : selectedEvent?.additional_info ? (
                <ScrollView
                  style={styles.modalDetailBox}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                >
                  <Text style={styles.modalDetail}>{selectedEvent.additional_info}</Text>
                </ScrollView>
              ) : null}
              <View style={styles.editingActionsRow}>
                {editingEventId === selectedEvent?.id ? (
                  <>
                    <TouchableOpacity
                      style={styles.editCancelBtn}
                      onPress={() => setEditingEventId(null)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.editCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.editSaveBtn}
                      onPress={saveEditing}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.editSaveText}>Save</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setSelectedEvent(null)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.modalCloseText}>Close</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* 全屏图片查看 Modal */}
      <Modal
        visible={showFullImage && !!selectedEvent?.photoUri}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowFullImage(false)}
      >
        <View style={styles.fullImageModalOverlay}>
          <TouchableOpacity
            style={styles.fullImageBackdrop}
            activeOpacity={1}
            onPress={() => setShowFullImage(false)}
          />
          {selectedEvent?.photoUri ? (
            <Image
              source={{ uri: selectedEvent.photoUri }}
              style={styles.fullImageContent}
              contentFit="contain"
            />
          ) : null}
          <TouchableOpacity
            style={styles.fullImageCloseBtn}
            onPress={() => setShowFullImage(false)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
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
  scrollContent: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 170 },

  // Event Card（缩略图 + 简短文字）
  eventCard: {
    flexDirection: 'row', gap: 14, alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 24, padding: 14, marginBottom: 12,
    shadowColor: '#585594', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 16, elevation: 3,
  },
  eventThumb: { width: 84, height: 84, borderRadius: 18, backgroundColor: '#f5f3ee' },
  mediaThumbWrap: { width: 84, height: 84, borderRadius: 18, overflow: 'hidden', backgroundColor: '#f5f3ee' },
  videoPlayBadge: { position: 'absolute', left: 32, top: 32, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(27,28,25,0.65)', justifyContent: 'center', alignItems: 'center', paddingLeft: 2 },
  eventInfoCol: { flex: 1, justifyContent: 'center' },
  eventTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventTime: { fontSize: 18, fontWeight: '700', color: '#585594' },
  eventLocation: { flex: 1, fontSize: 12, fontWeight: '600', color: '#787681', textAlign: 'right' },
  eventWeather: { fontSize: 11, fontWeight: '600', color: '#787681', marginTop: 2 },
  eventTitle: { fontSize: 16, fontWeight: '700', color: '#1b1c19', marginTop: 4 },
  eventArrowRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },

  // Photo Detail Modal（半透明黑遮罩 + 大卡片）
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(27,28,25,0.6)',
  },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  modalCard: {
    width: '100%', maxHeight: '80%', backgroundColor: '#fff', borderRadius: 24,
    overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 10,
  },
  modalImage: { width: '100%', height: 220, backgroundColor: '#f5f3ee' },
  modalVideo: { width: '100%', height: 220, backgroundColor: '#1b1c19' },
  fullImageBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(27,28,25,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: { padding: 20 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTime: { fontSize: 18, fontWeight: '700', color: '#585594' },
  modalLocation: { flex: 1, fontSize: 13, fontWeight: '600', color: '#787681', textAlign: 'right' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1b1c19', marginTop: 6 },
  modalWeatherRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  modalWeather: { fontSize: 13, fontWeight: '600', color: '#585594' },
  modalDetailBox: {
    maxHeight: 160,
    marginTop: 8,
    backgroundColor: '#f5f3ee',
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  modalDetail: { fontSize: 14, color: '#474650', lineHeight: 22, paddingVertical: 8, fontStyle: 'italic' },
  editToggleBtn: {
    padding: 6,
    backgroundColor: '#585594',
    borderRadius: 16,
  },
  editToggleBtnOutline: {
    padding: 6,
    backgroundColor: '#f5f3ee',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e3dfff',
  },
  editTitleInput: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1b1c19',
    marginTop: 6,
    backgroundColor: '#f5f3ee',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editDetailInput: {
    fontSize: 14,
    color: '#474650',
    lineHeight: 22,
    marginTop: 8,
    fontStyle: 'italic',
    backgroundColor: '#f5f3ee',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editingActionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 18 },
  editSaveBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 20, backgroundColor: '#585594' },
  editSaveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  editCancelBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e3dfff' },
  editCancelText: { color: '#585594', fontWeight: '700', fontSize: 14 },
  modalCloseBtn: { alignSelf: 'center', marginTop: 18, backgroundColor: '#585594', paddingVertical: 10, paddingHorizontal: 28, borderRadius: 20 },
  modalCloseText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // 全屏图片查看
  fullImageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImageBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fullImageContent: { width: '100%', height: '100%' },
  fullImageCloseBtn: {
    position: 'absolute',
    top: 54,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Floating Buttons
  floatingActions: { position: 'absolute', bottom: 100, left: 18, right: 18, flexDirection: 'row', gap: 10 },
  refreshPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 28, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e3dfff', shadowColor: '#585594', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  refreshPillText: { color: '#585594', fontWeight: '700', fontSize: 13, letterSpacing: 0.3 },
  storyPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 28, backgroundColor: '#585594', shadowColor: '#585594', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 6 },
  storyPillText: { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.6 },
});

