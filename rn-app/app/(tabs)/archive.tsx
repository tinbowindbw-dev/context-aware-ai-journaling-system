import React, { useState } from 'react';
import {
    StyleSheet, Text, View, ScrollView, TouchableOpacity,
    Dimensions, Alert, TextInput, Modal, SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../store/useStore';
import type { MoodType, StoryItem } from '../../store/useStore';
import { getLocalDateString } from '../../utils/date';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width / 7;

// Emotion heatmap color palette
const MOOD_COLORS: Record<MoodType, string> = {
    positive: '#FFD700',  // Warm yellow - happy, excited
    calm: '#A2D149',  // Grass green - relaxed, peaceful
    stressed: '#FFA500',  // Orange - busy, anxious
    negative: '#85929E',  // Slate blue - sad, lonely
};

const MOOD_LABELS: Record<MoodType, string> = {
    positive: 'Positive',
    calm: 'Calm',
    stressed: 'Stressed',
    negative: 'Negative',
};

// Returns a readable text color (dark/light) based on background
const getTextColorForMood = (mood: MoodType): string => {
    // positive (#FFD700) and calm (#A2D149) are bright — use dark text
    // stressed (#FFA500) is medium-bright — dark text
    // negative (#85929E) is medium-dark — use white text
    return mood === 'negative' ? '#fff' : '#1a1a1a';
};

export default function ArchiveLayer() {
    const { stories } = useStore();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDayStories, setSelectedDayStories] = useState<StoryItem[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedDateStr, setSelectedDateStr] = useState('');

    // Calendar Logic
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    const monthName = currentDate.toLocaleString('default', { month: 'long' });

    // Build a lookup: date -> first story's mood (for calendar)
    const storyByDate: Record<string, StoryItem[]> = {};
    stories.forEach(s => {
        if (!storyByDate[s.date]) storyByDate[s.date] = [];
        storyByDate[s.date].push(s);
    });

    const confirmDelete = (id: string) => {
        Alert.alert(
            'Delete Journal',
            'Are you sure you want to delete this story?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => useStore.getState().deleteStory(id)
                }
            ]
        );
    };

    const handleDayPress = (dateStr: string) => {
        const dayStories = storyByDate[dateStr];
        if (!dayStories || dayStories.length === 0) return;
        setSelectedDayStories(dayStories);
        setSelectedDateStr(dateStr);
        setModalVisible(true);
    };

    const renderCalendar = () => {
        const days = [];
        const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

        // Header row
        const headerRow = (
            <View key="header" style={styles.calendarRow}>
                {dayNames.map((d, i) => (
                    <Text key={`dayname-${i}`} style={styles.dayLabel}>{d}</Text>
                ))}
            </View>
        );
        days.push(headerRow);

        let currentDayRow: React.ReactNode[] = [];

        // Empty padding cells
        for (let i = 0; i < firstDay; i++) {
            currentDayRow.push(<View key={`empty-${i}`} style={styles.dayBox} />);
        }

        // Day cells
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
            const dayStories = storyByDate[dateStr];
            const hasStory = !!dayStories && dayStories.length > 0;
            const isToday = getLocalDateString() === dateStr;

            // Pick the mood of the first story saved that day
            const mood: MoodType | undefined = hasStory ? dayStories[0].mood : undefined;
            // Determine circle background color
            const circleBg = hasStory
                ? (mood ? MOOD_COLORS[mood] : '#2C2C2E')
                : undefined;
            // Determine text color: always ensure contrast
            let dotTextColor: string;
            if (!hasStory) {
                dotTextColor = isToday ? '#000' : '#333';
            } else {
                // If there's a mood, ensure we use a color that contrasts with the background
                // 'negative' is dark slate blue, use white. Others are bright/yellow/green, use dark.
                dotTextColor = (mood === 'negative') ? '#fff' : '#1a1a1a';
            }

            currentDayRow.push(
                <TouchableOpacity
                    key={d}
                    style={styles.dayBox}
                    onPress={() => handleDayPress(dateStr)}
                    activeOpacity={hasStory ? 0.7 : 1}
                >
                    <View style={[
                        styles.dateCircle,
                        isToday && !hasStory && styles.dateCircleToday,
                        circleBg ? { backgroundColor: circleBg } : null
                    ]}>
                        <Text 
                            numberOfLines={1}
                            style={[
                                styles.dateText,
                                { color: dotTextColor },
                                (hasStory || isToday) && { fontWeight: '700' }
                            ]}
                        >
                            {d}
                        </Text>
                    </View>
                </TouchableOpacity>
            );

            if ((d + firstDay) % 7 === 0 || d === daysInMonth) {
                if (d === daysInMonth && currentDayRow.length < 7) {
                    const remaining = 7 - currentDayRow.length;
                    for (let i = 0; i < remaining; i++) {
                        currentDayRow.push(<View key={`empty-end-${i}`} style={styles.dayBox} />);
                    }
                }
                days.push(
                    <View key={`row-${d}`} style={styles.calendarRow}>
                        {currentDayRow}
                    </View>
                );
                currentDayRow = [];
            }
        }
        return days;
    };

    const filteredStories = stories.filter(s =>
        s.text.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.greetingText}>Archive</Text>
                <Text style={styles.headerTitle}>Your Journal</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Calendar Card */}
                <View style={styles.card}>
                    <View style={styles.calendarHeader}>
                        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
                            <Ionicons name="chevron-back" size={18} color="#585594" />
                        </TouchableOpacity>
                        <Text style={styles.monthTitle}>{monthName} {year}</Text>
                        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
                            <Ionicons name="chevron-forward" size={18} color="#585594" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.calendarGrid}>
                        {renderCalendar()}
                    </View>

                    {/* Mood Legend */}
                    <View style={styles.legend}>
                        {(Object.keys(MOOD_COLORS) as MoodType[]).map(mood => (
                            <View key={mood} style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: MOOD_COLORS[mood] }]} />
                                <Text style={styles.legendLabel}>{MOOD_LABELS[mood]}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Story History List */}
                <View style={styles.historySection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>PAST JOURNALS</Text>
                        <View style={styles.searchBar}>
                            <Ionicons name="search" size={16} color="#999" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search memories..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor="#999"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={16} color="#999" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {filteredStories.length === 0 ? (
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyText}>
                                {searchQuery ? 'No matching memories found.' : 'No saved stories yet.'}
                            </Text>
                        </View>
                    ) : (
                        filteredStories.map(story => {
                            const accentColor = story.mood ? MOOD_COLORS[story.mood] : '#E0E0E0';
                            return (
                                <View
                                    key={story.id}
                                    style={[styles.storyEntry, { borderLeftColor: accentColor }]}
                                >
                                    <View style={styles.entryHeader}>
                                        <View style={styles.entryMeta}>
                                            <Text style={styles.entryDate}>{story.date}</Text>
                                            <View style={styles.badgeRow}>
                                                <View style={styles.styleBadge}>
                                                    <Text style={styles.styleBadgeText}>{story.style}</Text>
                                                </View>
                                                {story.mood && (
                                                    <View style={[styles.moodBadge, { backgroundColor: MOOD_COLORS[story.mood] }]}>
                                                        <Text style={[
                                                            styles.moodBadgeText,
                                                            { color: getTextColorForMood(story.mood) }
                                                        ]}>
                                                            {MOOD_LABELS[story.mood]}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        <TouchableOpacity onPress={() => confirmDelete(story.id)}>
                                            <Ionicons name="trash-outline" size={18} color="#ccc" />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={styles.entryText}>{story.text}</Text>
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            {/* Day Story Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <SafeAreaView style={styles.modalSheet}>
                        {/* Handle bar */}
                        <View style={styles.sheetHandle} />

                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalDate}>{selectedDateStr}</Text>
                                <Text style={styles.modalSubtitle}>
                                    {selectedDayStories.length} {selectedDayStories.length === 1 ? 'entry' : 'entries'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.closeBtn}
                                onPress={() => setModalVisible(false)}
                            >
                                <Ionicons name="close" size={22} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            contentContainerStyle={styles.modalScroll}
                            showsVerticalScrollIndicator={false}
                        >
                            {selectedDayStories.map((story, index) => {
                                const moodColor = story.mood ? MOOD_COLORS[story.mood] : '#E0E0E0';
                                return (
                                    <View key={story.id} style={styles.modalStoryCard}>
                                        {/* Mood accent strip */}
                                        <View style={[styles.moodStrip, { backgroundColor: moodColor }]}>
                                            {story.mood && (
                                                <Text style={[
                                                    styles.moodStripLabel,
                                                    { color: getTextColorForMood(story.mood) }
                                                ]}>
                                                    {MOOD_LABELS[story.mood].toUpperCase()}
                                                </Text>
                                            )}
                                        </View>
                                        <View style={styles.modalCardBody}>
                                            <View style={styles.modalCardTopRow}>
                                                <View style={styles.styleBadge}>
                                                    <Text style={styles.styleBadgeText}>{story.style}</Text>
                                                </View>
                                                <TouchableOpacity onPress={() => {
                                                    setModalVisible(false);
                                                    confirmDelete(story.id);
                                                }}>
                                                    <Ionicons name="trash-outline" size={16} color="#ccc" />
                                                </TouchableOpacity>
                                            </View>
                                            <Text style={styles.modalStoryText}>{story.text}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </SafeAreaView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fbf9f4' },
    header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 22 },
    greetingText: { fontSize: 15, color: '#787681', fontWeight: '500' },
    headerTitle: { fontSize: 28, fontWeight: '700', color: '#1b1c19', marginTop: 2 },
    scrollContent: { paddingHorizontal: 18, paddingBottom: 100 },

    // Calendar Card
    card: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        marginBottom: 24,
        shadowColor: '#585594',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 3,
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    navBtn: { padding: 8, borderRadius: 12, backgroundColor: '#f5f3ee' },
    monthTitle: { fontSize: 16, fontWeight: '700', color: '#1b1c19' },
    calendarGrid: { width: '100%' },
    calendarRow: { flexDirection: 'row', marginBottom: 2 },
    dayLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#b0adb8', paddingBottom: 8 },
    dayBox: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
    dateCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    dateCircleToday: { borderWidth: 2, borderColor: '#585594' },
    dateText: { fontSize: 13, color: '#474650', fontWeight: '500', textAlign: 'center' },

    // Legend
    legend: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 16,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#f0eee9',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendLabel: { fontSize: 10, fontWeight: '600', color: '#787681' },

    // History Section
    historySection: { marginTop: 0 },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#474650' },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 38,
        marginLeft: 16,
        borderWidth: 1,
        borderColor: '#e4e2dd',
    },
    searchIcon: { marginRight: 6 },
    searchInput: { flex: 1, fontSize: 13, color: '#1b1c19', padding: 0 },
    emptyBox: { padding: 30, alignItems: 'center' },
    emptyText: { color: '#787681', fontSize: 14 },

    storyEntry: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 16,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#e3dfff',
        shadowColor: '#585594',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    entryMeta: { flex: 1, marginRight: 10 },
    entryDate: { fontSize: 13, fontWeight: '700', color: '#585594', marginBottom: 4 },
    badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    styleBadge: { backgroundColor: '#e3dfff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    styleBadgeText: { fontSize: 10, fontWeight: '700', color: '#423f7d', textTransform: 'uppercase' },
    moodBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    moodBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    entryText: { fontSize: 14, color: '#474650', lineHeight: 21, fontStyle: 'italic' },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(27,28,25,0.5)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#fbf9f4',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: '80%',
        paddingBottom: 40,
    },
    sheetHandle: {
        width: 36,
        height: 4,
        backgroundColor: '#c8c5d1',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 22,
        marginBottom: 14,
    },
    modalDate: { fontSize: 20, fontWeight: '700', color: '#1b1c19' },
    modalSubtitle: { fontSize: 13, color: '#787681', marginTop: 2, fontWeight: '500' },
    closeBtn: {
        padding: 8,
        backgroundColor: '#f5f3ee',
        borderRadius: 20,
    },
    modalScroll: { paddingHorizontal: 18, paddingBottom: 20, paddingTop: 4 },
    modalStoryCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        marginBottom: 12,
        overflow: 'hidden',
        shadowColor: '#585594',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    moodStrip: {
        height: 36,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    moodStripLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    modalCardBody: { padding: 16 },
    modalCardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    modalStoryText: { fontSize: 15, color: '#474650', lineHeight: 24, fontStyle: 'italic' },
});
