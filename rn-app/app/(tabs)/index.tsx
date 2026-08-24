// Event Layer Component - Timeline display and management
// Restored: Automatic Location & Weather tracking upon App Launch + Manual/Photo handling.
// ...

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { API_URL } from '../../constants/Config';
import { useStore } from '../../store/useStore';

export default function EventLayer() {
  const { events, addEvent, renameEvent, deleteEvent, _hasHydrated } = useStore();
  const cameraRef = useRef<CameraView>(null);
  const recordingStartedAt = useRef(0);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  const [showInput, setShowInput] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [date, setDate] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Rename Logic State
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [eventToRename, setEventToRename] = useState<{ id: string, title: string } | null>(null);
  const [tempRenameTitle, setTempRenameTitle] = useState('');

  // Photo Upload State
  const [uploadingSource, setUploadingSource] = useState<'camera' | 'library' | 'video' | null>(null);
  const [showVideoCamera, setShowVideoCamera] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);

  // Highlights Modal State
  const [showHighlights, setShowHighlights] = useState(false);
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(false);
  const [highlightsContent, setHighlightsContent] = useState('');

  // Timeline 展开状态（全屏查看事件列表）
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);

  // --- AUTOMATIC LOCATION & WEATHER TRACKER ON APP OPEN ---
  useEffect(() => {
    const trackCurrentLocationAndWeather = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Location permission denied for automatic event.');
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = currentLocation.coords;

        // Fetch location name and weather from backend API
        const response = await fetch(`${API_URL}/get_current_context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude, longitude }),
        });

        const now = new Date();
        const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        if (response.ok) {
          const data = await response.json();
          addEvent({
            id: Date.now().toString(),
            time: currentTimeStr,
            title: data.location_name || "Current Location",
            location: data.location_name || "Current Location",
            weather: data.weather_condition || "Sunny",
            temperature: String(data.temperature || 26),
            isManual: false,
            timestamp: now.getTime(),
          });
        } else {
          // Fallback if backend context API is not yet responding
          addEvent({
            id: Date.now().toString(),
            time: currentTimeStr,
            title: "Current Status Updated",
            location: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
            weather: "Sunny",
            temperature: "25",
            isManual: false,
            timestamp: now.getTime(),
          });
        }
      } catch (error) {
        console.log("Auto location tracking error:", error);
      }
    };

    // Run automatically on app open if no event was logged in the last hour
    if (!_hasHydrated) return;
    const lastEvent = events[events.length - 1];
    const isRecent = lastEvent && (Date.now() - lastEvent.timestamp < 3600000);
    if (!isRecent) {
      trackCurrentLocationAndWeather();
    }
  }, [_hasHydrated]);

  const confirmDelete = (id: string) => {
    Alert.alert(
      "Delete Event",
      "Are you sure you want to remove this event from your log?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteEvent(id) }
      ]
    );
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const getFormattedTime = () => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const addManualEvent = () => {
    if (manualTitle.trim() === '') {
      Alert.alert("Error", "Please enter both title and time.");
      return;
    }

    const formattedTime = getFormattedTime();

    // 附带最近一次自动事件的上下文（地点/天气），让手动事件也能显示位置信息
    const latestAuto = events
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .find(e => e.location || e.weather);

    addEvent({
      id: Date.now().toString(),
      time: formattedTime,
      title: manualTitle,
      isManual: true,
      timestamp: date.getTime(),
      location: latestAuto?.location,
      weather: latestAuto?.weather,
      temperature: latestAuto?.temperature,
    });

    setManualTitle('');
    setShowInput(false);
  };

  const handleRecordedVideo = async (uri: string) => {
    setShowVideoCamera(false);
    setUploadingSource('video');

    let videoUri = uri;
    try {
      const dir = `${FileSystem.documentDirectory}videos/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const destination = `${dir}${Date.now()}.mp4`;
      await FileSystem.copyAsync({ from: uri, to: destination });
      videoUri = destination;
    } catch (error) {
      console.error('Failed to persist video:', error);
    }

    const now = new Date();
    const eventTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: videoUri,
        name: 'event-video.mp4',
        type: 'video/mp4',
      } as any);
      formData.append('user_id', useStore.getState().userName);

      const response = await fetch(`${API_URL}/analyze_video`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.detail || `Server error (HTTP ${response.status})`);
      }

      addEvent({
        id: Date.now().toString(),
        time: eventTime,
        title: data.title || 'Video Event',
        isManual: true,
        isVideo: true,
        videoUri,
        additional_info: data.description || '',
        timestamp: now.getTime(),
      });
    } catch (error) {
      console.error('Video Analysis Error:', error);
      Alert.alert(
        'Video Analysis Failed',
        error instanceof Error ? error.message : 'Unable to analyze the recorded video.'
      );
      addEvent({
        id: Date.now().toString(),
        time: eventTime,
        title: 'Video Event',
        isManual: true,
        isVideo: true,
        videoUri,
        timestamp: now.getTime(),
      });
    } finally {
      setUploadingSource(null);
    }
  };

  const startVideoRecording = async () => {
    if (!cameraRef.current || isRecordingVideo) return;

    // 录制视频需要麦克风权限（RECORD_AUDIO），Android 上必须显式请求
    if (!microphonePermission?.granted) {
      const permission = await requestMicrophonePermission();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Microphone access is needed to record a video.');
        return;
      }
    }

    recordingStartedAt.current = Date.now();
    setIsRecordingVideo(true);
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 15 });
      if (video?.uri) await handleRecordedVideo(video.uri);
    } catch (error) {
      console.error('Video recording error:', error);
      Alert.alert(
        'Recording Failed',
        error instanceof Error ? error.message : 'Unable to record the video.'
      );
    } finally {
      setIsRecordingVideo(false);
    }
  };

  const stopVideoRecording = () => {
    // 防止快速点击：录制初始化完成前调用 stopRecording 会抛错
    if (Date.now() - recordingStartedAt.current < 300) return;
    if (cameraRef.current && isRecordingVideo) {
      cameraRef.current.stopRecording();
    }
  };

  const openVideoRecorder = async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Camera access is needed to record a video.');
        return;
      }
    }
    setShowVideoCamera(true);
  };

  const handlePhotoEvent = async (source: 'camera' | 'library') => {
    try {
      let result;
      const options = {
        allowsEditing: false,
        base64: true,
        exif: true,
        quality: 0.7,
      };

      if (source === 'camera') {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissionResult.granted) {
          Alert.alert("Permission Required", "You need to allow camera access to take a photo.");
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          Alert.alert("Permission Required", "You need to allow access to your photos to add an event from a photo.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          ...options,
          mediaTypes: ['images'],
        } as any);
      }

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setUploadingSource(source);

      const asset = result.assets[0];
      const base64 = asset.base64;
      const exif = asset.exif;

      // 持久化照片到文档目录（App 重启后仍可查看）
      let photoUri: string | undefined;
      try {
        const ext = (asset.fileName && asset.fileName.split('.').pop()) || 'jpg';
        const dir = `${FileSystem.documentDirectory}photos/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const dest = `${dir}${Date.now()}.${ext}`;
        await FileSystem.copyAsync({ from: asset.uri, to: dest });
        photoUri = dest;
      } catch (saveErr) {
        console.error('Failed to save photo locally:', saveErr);
        photoUri = asset.uri; // 兜底：持久化失败时仍存临时 uri
      }

      const now = new Date();
      let eventTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      let eventTimestamp = now.getTime();

      let latitude = null;
      let longitude = null;

      if (exif) {
        if (exif.GPSLatitude && exif.GPSLongitude) {
          latitude = exif.GPSLatitude;
          longitude = exif.GPSLongitude;
        }

        const dateTimeStr = exif.DateTimeOriginal || exif.DateTime;
        if (dateTimeStr) {
          const parts = dateTimeStr.split(' ');
          if (parts.length === 2) {
            const timePart = parts[1];
            const timeParts = timePart.split(':');
            if (timeParts.length >= 2) {
              eventTime = `${timeParts[0]}:${timeParts[1]}`;
            }
            const datePart = parts[0].replace(/:/g, '-');
            const fullDate = new Date(`${datePart}T${timePart}`);
            if (!isNaN(fullDate.getTime())) {
              eventTimestamp = fullDate.getTime();
            }
          }
        }
      }

      // Vision AI Analysis Request with GPS data attached
      const response = await fetch(`${API_URL}/analyze_photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: useStore.getState().userName,
          base64_image: base64,
          gps: latitude && longitude ? { latitude, longitude } : null
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Check if AI analysis returned meaningful results (not just fallback defaults)
        const isTitleFallback = !data.title || data.title === 'Photo Event';
        const isDescriptionFallback = !data.description || data.description === 'A photo uploaded by the user.';
        
        if (isTitleFallback && isDescriptionFallback) {
          // AI analysis produced no meaningful result, but the photo was uploaded successfully
          Alert.alert(
            "AI Analysis Incomplete",
            "The image was uploaded but the AI could not analyze its content. It will be saved as a generic photo event.",
            [{ text: "OK" }]
          );
        }

        const finalTitle = (!isTitleFallback) 
          ? data.title 
          : (data.description || 'Photo Event');

        // 照片没有 GPS / 后端没解析出地点时，兜底附带最近已知上下文
        const latestContext = events
          .slice()
          .sort((a, b) => b.timestamp - a.timestamp)
          .find(e => e.location || e.weather);

        addEvent({
          id: Date.now().toString(),
          time: eventTime,
          title: finalTitle,
          location: data.location || latestContext?.location || undefined,
          weather: data.weather || latestContext?.weather || undefined,
          temperature: data.temperature || latestContext?.temperature || undefined,
          isManual: true,
          isPhoto: true,
          photoUri,
          additional_info: data.description || '',
          timestamp: eventTimestamp,
        });
      } else {
        // Server returned an error response
        const errorMsg = data.detail || `Server error (HTTP ${response.status})`;
        Alert.alert("Analysis Failed", `Unable to analyze the photo: ${errorMsg}`);
        // Still save the photo as a basic event so the user doesn't lose it
        addEvent({
          id: Date.now().toString(),
          time: eventTime,
          title: "Photo Event",
          isManual: true,
          isPhoto: true,
          photoUri,
          timestamp: eventTimestamp,
        });
      }
    } catch (error) {
      console.error("Photo Analysis Error:", error);
      const errorMessage = error instanceof TypeError && error.message === 'Network request failed'
        ? "Cannot reach the AI server. Please check your internet connection and try again."
        : `An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`;
      Alert.alert("Connection Error", errorMessage);
    } finally {
      setUploadingSource(null);
    }
  };

  const userName = useStore((state) => state.userName) || 'User';

  // Condensed AI Reflection: max 3 sentences, just a quick day overview
  const generateAIReflection = () => {
    if (events.length === 0) {
      return "Your day is a fresh canvas. Capture your first moment above to begin today's reflection.";
    }
    const count = events.length;
    const uniqueLocations = [...new Set(events.filter(e => e.location).map(e => e.location))];
    const hasPhotos = events.some(e => e.isPhoto);
    
    let summary = `You've captured ${count} moment${count > 1 ? 's' : ''} today`;
    if (uniqueLocations.length > 0) {
      summary += ` across ${uniqueLocations.length} location${uniqueLocations.length > 1 ? 's' : ''}`;
    }
    if (hasPhotos) summary += `, including photos`;
    summary += '.';
    return summary;
  };

  // Fetch full AI analysis for Highlights modal
  const fetchHighlights = async () => {
    setShowHighlights(true);
    setIsLoadingHighlights(true);
    setHighlightsContent('');

    if (events.length === 0) {
      setHighlightsContent("No events captured yet today. Start by adding your first moment!");
      setIsLoadingHighlights(false);
      return;
    }

    try {
      // Build a summary of all today's events for the AI
      const eventsSummary = events
        .slice()
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(e => {
          let line = `[${e.time}] ${e.title}`;
          if (e.location) line += ` — at ${e.location}`;
          if (e.weather) line += ` | ${e.weather}${e.temperature ? ` ${e.temperature}°C` : ''}`;
          if (e.additional_info) line += ` | ${e.additional_info}`;
          return line;
        })
        .join('\n');

      const response = await fetch(`${API_URL}/interpret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userName,
          title: `Daily Summary: ${events.length} events`,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          additional_info: eventsSummary,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setHighlightsContent(data.data.interpretation);
        } else {
          setHighlightsContent("AI analysis is not available right now. Here's your day at a glance:\n\n" + eventsSummary);
        }
      } else {
        setHighlightsContent("Unable to generate analysis. Here's your day at a glance:\n\n" + eventsSummary);
      }
    } catch (error) {
      console.error("Highlights fetch error:", error);
      // Fallback: show events summary without AI
      const fallback = events
        .slice()
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(e => `• ${e.time} — ${e.title}`)
        .join('\n');
      setHighlightsContent("AI analysis unavailable. Here's a quick recap:\n\n" + fallback);
    } finally {
      setIsLoadingHighlights(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      {/* 固定头部区域：Header + AI Reflection + 快捷操作（不随下方内容滚动） */}
      {!isTimelineExpanded && (
      <View style={styles.fixedArea}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greetingSubText}>Good Day,</Text>
          <Text style={styles.headerDateTitle}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </Text>
        </View>

        {/* AI Reflection Card */}
        <View style={styles.aiReflectionCard}>
          <View style={styles.aiHeaderRow}>
            <Ionicons name="sparkles" size={16} color="#585594" />
            <Text style={styles.aiReflectionBadge}>AI Reflection</Text>
          </View>
          <Text style={styles.aiGreetingText}>Good Day, {userName}</Text>
          <Text style={styles.aiQuoteText}>
            "{generateAIReflection()}"
          </Text>
          <View style={styles.aiFooterRow}>
            <View style={styles.weatherBadgesGroup}>
              <View style={[styles.microBadge, { backgroundColor: '#c1ebe7' }]}>
                <Ionicons name="sunny-outline" size={12} color="#00201e" />
              </View>
              <View style={[styles.microBadge, { backgroundColor: '#e3dfff', marginLeft: -6 }]}>
                <Ionicons name="water-outline" size={12} color="#16114f" />
              </View>
            </View>
            <TouchableOpacity style={styles.highlightsBtn} activeOpacity={0.7} onPress={fetchHighlights}>
              <Text style={styles.highlightsText}>Highlights</Text>
              <Ionicons name="chevron-forward" size={14} color="#585594" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions */}
        {showInput ? (
          <View style={styles.inputCard}>
            <Text style={styles.inputCardHeader}>Capture a Moment</Text>
            <TextInput
              style={styles.inputField}
              placeholder="What's on your mind right now?"
              placeholderTextColor="#787681"
              value={manualTitle}
              onChangeText={setManualTitle}
              multiline
            />
            <View style={styles.pickerContainer}>
              {Platform.OS === 'ios' && (
                <DateTimePicker value={date} mode="time" display="spinner" onChange={onTimeChange} style={styles.timePicker} />
              )}
              {Platform.OS === 'android' && (
                <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.androidTimeBtn}>
                  <Text style={styles.androidTimeText}>{getFormattedTime()}</Text>
                  <Ionicons name="time-outline" size={18} color="#585594" />
                </TouchableOpacity>
              )}
              {Platform.OS === 'android' && showTimePicker && (
                <DateTimePicker value={date} mode="time" display="spinner" onChange={onTimeChange} />
              )}
            </View>
            <View style={styles.inputActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowInput(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={addManualEvent}>
                <Text style={styles.confirmBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity 
              style={styles.actionCardBtn} 
              onPress={() => setShowInput(true)}
              activeOpacity={0.85}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons name="create-outline" size={20} color="#585594" />
              </View>
              <Text style={styles.actionCardText}>Capture</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCardBtn} 
              onPress={() => handlePhotoEvent('camera')}
              disabled={uploadingSource !== null}
              activeOpacity={0.85}
            >
              <View style={styles.actionIconCircle}>
                {uploadingSource === 'camera' ? (
                  <ActivityIndicator size="small" color="#585594" />
                ) : (
                  <Ionicons name="camera-outline" size={20} color="#585594" />
                )}
              </View>
              <Text style={styles.actionCardText}>
                {uploadingSource === 'camera' ? 'Scanning' : 'Take Photo'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCardBtn} 
              onPress={() => handlePhotoEvent('library')}
              disabled={uploadingSource !== null}
              activeOpacity={0.85}
            >
              <View style={styles.actionIconCircle}>
                {uploadingSource === 'library' ? (
                  <ActivityIndicator size="small" color="#585594" />
                ) : (
                  <Ionicons name="image-outline" size={20} color="#585594" />
                )}
              </View>
              <Text style={styles.actionCardText}>
                {uploadingSource === 'library' ? 'Scanning' : 'Upload'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCardBtn}
              onPress={openVideoRecorder}
              disabled={uploadingSource !== null}
              activeOpacity={0.85}
            >
              <View style={styles.actionIconCircle}>
                {uploadingSource === 'video' ? (
                  <ActivityIndicator size="small" color="#585594" />
                ) : (
                  <Ionicons name="videocam-outline" size={20} color="#585594" />
                )}
              </View>
              <Text style={styles.actionCardText}>
                {uploadingSource === 'video' ? 'Analyzing' : 'Video'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
      )}

      {/* Today's Journey 标题行 + 展开/收起按钮（固定在区域顶部） */}
      <View style={[styles.timelineHeaderRow, isTimelineExpanded && styles.timelineHeaderRowExpanded]}>
        <Text style={styles.timelineSectionTitle}>Today's Journey</Text>
        <TouchableOpacity
          style={styles.expandBtn}
          onPress={() => setIsTimelineExpanded((v) => !v)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={isTimelineExpanded ? 'contract-outline' : 'expand-outline'} size={16} color="#585594" />
          <Text style={styles.expandBtnText}>{isTimelineExpanded ? 'Collapse' : 'Expand'}</Text>
        </TouchableOpacity>
      </View>

      {/* 下方：Today's Journey 独立滑动区 */}
      <ScrollView
        style={styles.timelineScroll}
        contentContainerStyle={styles.timelineListContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.timelineList}>
          {events.slice().sort((a, b) => b.timestamp - a.timestamp).map((event) => (
            <View key={event.id} style={styles.journeyCard}>
              <View style={styles.journeyHeaderRow}>
                <View style={styles.journeyTimeGroup}>
                  <Text style={styles.journeyTimeText}>{event.time}</Text>
                  <View style={styles.journeyMetaColumn}>
                    {event.location && (
                      <Text style={styles.journeyLocationText}>{event.location}</Text>
                    )}
                    {event.weather && event.weather !== 'Unknown' && (
                      <Text style={styles.journeyWeatherText}>
                        {event.weather}
                        {event.temperature && event.temperature !== 'N/A' ? `, ${event.temperature}°C` : ''}
                      </Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => {
                    Alert.alert("Memory Options", "Manage this event", [
                      { text: "Cancel", style: "cancel" },
                      { text: "Rename", onPress: () => { setEventToRename({ id: event.id, title: event.title }); setTempRenameTitle(event.title); setIsRenameModalVisible(true); } },
                      { text: "Delete", style: "destructive", onPress: () => confirmDelete(event.id) }
                    ]);
                  }}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color="#c8c5d1" />
                </TouchableOpacity>
              </View>

              <View style={styles.journeyBodyRow}>
                <View style={styles.journeyIconWrapper}>
                  <Ionicons
                    name={event.isVideo ? "videocam-outline" : event.isPhoto ? "image-outline" : "bookmark-outline"}
                    size={16}
                    color="#585594"
                  />
                </View>
                <Text style={styles.journeyTitleText}>{event.title}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Rename Modal */}
      {isRenameModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Rename Log</Text>
            <TextInput style={styles.renameInput} value={tempRenameTitle} onChangeText={setTempRenameTitle} autoFocus />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setIsRenameModalVisible(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { if (eventToRename) renameEvent(eventToRename.id, tempRenameTitle); setIsRenameModalVisible(false); }} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <Modal
        visible={showVideoCamera}
        animationType="slide"
        onRequestClose={() => setShowVideoCamera(false)}
      >
        <View style={styles.videoCameraScreen}>
          <CameraView
            ref={cameraRef}
            style={styles.videoCameraPreview}
            facing="back"
            mode="video"
            videoQuality="480p"
          />
          <View style={styles.videoCameraControls}>
            <TouchableOpacity
              style={styles.videoCancelButton}
              onPress={() => setShowVideoCamera(false)}
            >
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.recordButton, isRecordingVideo && styles.recordButtonActive]}
              onPressIn={startVideoRecording}
              onPressOut={stopVideoRecording}
              disabled={isRecordingVideo && uploadingSource !== null}
              activeOpacity={0.85}
            >
              <View style={styles.recordButtonInner} />
            </TouchableOpacity>
            <View style={styles.videoControlSpacer} />
          </View>
          <Text style={styles.recordHint}>
            {isRecordingVideo ? 'Release to finish' : 'Hold to record, up to 15 seconds'}
          </Text>
        </View>
      </Modal>

      {/* Highlights Modal — Full AI Analysis */}
      <Modal
        visible={showHighlights}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowHighlights(false)}
      >
        <View style={styles.highlightsOverlay}>
          <View style={styles.highlightsFullContent}>
            <View style={styles.highlightsModalHeader}>
              <View style={styles.highlightsTitleRow}>
                <Ionicons name="sparkles" size={18} color="#585594" />
                <Text style={styles.highlightsModalTitle}>Today's Highlights</Text>
              </View>
              <TouchableOpacity onPress={() => setShowHighlights(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#787681" />
              </TouchableOpacity>
            </View>
            {isLoadingHighlights ? (
              <View style={styles.highlightsLoadingArea}>
                <ActivityIndicator size="small" color="#585594" />
                <Text style={styles.highlightsLoadingText}>Generating your daily analysis...</Text>
              </View>
            ) : (
              <ScrollView style={styles.highlightsScrollArea} showsVerticalScrollIndicator={false}>
                <Text style={styles.highlightsContentText}>{highlightsContent}</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf9f4' },
  fixedArea: { paddingHorizontal: 18, paddingTop: 56 },

  header: { marginBottom: 16 },
  timelineScroll: { flex: 1, paddingHorizontal: 18 },
  timelineListContent: { paddingBottom: 130 },
  greetingSubText: { fontSize: 16, color: '#787681', fontWeight: '500' },
  headerDateTitle: { fontSize: 32, fontWeight: '700', color: '#1b1c19', marginTop: 2 },

  aiReflectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    elevation: 3,
    marginBottom: 20,
  },
  aiHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  aiReflectionBadge: { fontSize: 12, fontWeight: '700', color: '#706eaf', marginLeft: 6 },
  aiGreetingText: { fontSize: 18, fontWeight: '700', color: '#1b1c19', marginBottom: 6 },
  aiQuoteText: { fontSize: 14, fontStyle: 'italic', color: '#474650', lineHeight: 22, marginBottom: 14 },
  aiFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weatherBadgesGroup: { flexDirection: 'row', alignItems: 'center' },
  microBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightsBtn: { flexDirection: 'row', alignItems: 'center' },
  highlightsText: { fontSize: 12, fontWeight: '600', color: '#585594', marginRight: 2 },

  quickActionsGrid: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  actionCardBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3dfff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionCardText: { fontSize: 12, fontWeight: '600', color: '#1b1c19' },

  videoCameraScreen: { flex: 1, backgroundColor: '#000', justifyContent: 'flex-end' },
  videoCameraPreview: { ...StyleSheet.absoluteFillObject },
  videoCameraControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, paddingBottom: 54 },
  videoCancelButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(27,28,25,0.55)', justifyContent: 'center', alignItems: 'center' },
  videoControlSpacer: { width: 48, height: 48 },
  recordButton: { width: 76, height: 76, borderRadius: 38, borderWidth: 5, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  recordButtonActive: { borderColor: '#ff5b68' },
  recordButtonInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#ff5b68' },
  recordHint: { position: 'absolute', bottom: 20, alignSelf: 'center', color: '#fff', fontSize: 12, fontWeight: '600' },

  timelineSectionTitle: { fontSize: 18, fontWeight: '700', color: '#1b1c19' },
  timelineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
  },
  timelineHeaderRowExpanded: { paddingTop: 56 },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e3dfff',
  },
  expandBtnText: { fontSize: 12, fontWeight: '700', color: '#585594' },
  timelineList: { gap: 12 },
  journeyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    elevation: 2,
  },
  journeyHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  journeyTimeGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  journeyTimeText: { fontSize: 28, fontWeight: '700', color: '#585594' },
  journeyMetaColumn: { justifyContent: 'center' },
  journeyLocationText: { fontSize: 13, fontWeight: '700', color: '#474650' },
  journeyWeatherText: { fontSize: 11, color: '#787681', marginTop: 1 },
  journeyBodyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  journeyIconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e3dfff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  journeyTitleText: { fontSize: 14, fontWeight: '500', color: '#1b1c19', flex: 1 },

  inputCard: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 20, elevation: 3, marginBottom: 20 },
  inputCardHeader: { fontSize: 16, fontWeight: '700', color: '#1b1c19', marginBottom: 12 },
  inputField: { backgroundColor: '#f5f3ee', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1b1c19', minHeight: 70, textAlignVertical: 'top', marginBottom: 14 },
  pickerContainer: { marginBottom: 14 },
  timePicker: { width: '100%', height: 90 },
  androidTimeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f5f3ee', padding: 12, borderRadius: 12 },
  androidTimeText: { fontSize: 14, fontWeight: '600', color: '#1b1c19' },
  inputActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  cancelBtnText: { color: '#787681', fontSize: 14, fontWeight: '600' },
  confirmBtn: { backgroundColor: '#585594', paddingVertical: 8, paddingHorizontal: 18, borderRadius: 10 },
  confirmBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(27,28,25,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { width: '85%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, elevation: 5 },
  modalHeader: { fontSize: 16, fontWeight: '700', marginBottom: 14, color: '#1b1c19' },
  renameInput: { backgroundColor: '#f5f3ee', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1b1c19', marginBottom: 18 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalCancelBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  modalCancelText: { color: '#787681', fontSize: 14, fontWeight: '600' },
  modalConfirmBtn: { backgroundColor: '#585594', paddingVertical: 8, paddingHorizontal: 18, borderRadius: 10 },
  modalConfirmText: { color: '#FFF', fontWeight: '600', fontSize: 14 },

  // Highlights Modal styles — centered card + dark overlay, locks screen
  highlightsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(27,28,25,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightsFullContent: {
    width: '88%',
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    elevation: 5,
  },
  highlightsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e3dfff',
  },
  highlightsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  highlightsModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1b1c19',
  },
  highlightsLoadingArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  highlightsLoadingText: {
    fontSize: 14,
    color: '#787681',
    fontStyle: 'italic',
  },
  highlightsScrollArea: {
    maxHeight: 400,
  },
  highlightsContentText: {
    fontSize: 15,
    color: '#3a3850',
    lineHeight: 24,
  },
});