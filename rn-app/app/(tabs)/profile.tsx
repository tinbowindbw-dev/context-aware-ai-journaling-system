import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Share,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import { useStore } from '../../store/useStore';
import { clearDevLogs, exportDevLogsToPublicDirectory, getDevLogFileUri } from '../../utils/devLog';

export default function ProfileLayer() {
    const {
        userName,
        avatarUri,
        isTrackingEnabled,
        setUserName,
        setAvatarUri,
        setTrackingEnabled,
    } = useStore();

    const [isEditingName, setIsEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(userName);

    const handleDeveloperTools = useCallback(() => {
        Alert.alert(
            'Developer Tools',
            'Hidden diagnostics actions',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear Dev Logs',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await clearDevLogs();
                            Alert.alert('Cleared', 'Developer logs were cleared.');
                        } catch (error) {
                            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to clear logs.');
                        }
                    },
                },
                {
                    text: 'Export Dev Logs',
                    onPress: async () => {
                        try {
                            if (Platform.OS === 'android') {
                                const exportedUri = await exportDevLogsToPublicDirectory();
                                Alert.alert('Exported', `Developer logs were exported.\n${exportedUri}`);
                                return;
                            }

                            const fileUri = getDevLogFileUri();
                            await Share.share({ url: fileUri });
                        } catch (error) {
                            Alert.alert('Export Failed', error instanceof Error ? error.message : 'Unable to export developer logs.');
                        }
                    },
                },
            ]
        );
    }, []);

    const handlePickAvatar = useCallback(async () => {
        const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permResult.granted) {
            Alert.alert(
                'Permission Required',
                'Please allow access to your photo library to update your avatar.'
            );
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setAvatarUri(result.assets[0].uri);
        }
    }, [setAvatarUri]);

    const handleSaveName = useCallback(() => {
        const trimmed = nameInput.trim();
        if (trimmed.length === 0) {
            Alert.alert('Invalid Name', 'Username cannot be empty.');
            setNameInput(userName);
            setIsEditingName(false);
            return;
        }
        setUserName(trimmed);
        setIsEditingName(false);
    }, [nameInput, userName, setUserName]);

    const handleStartEditName = useCallback(() => {
        setNameInput(userName);
        setIsEditingName(true);
    }, [userName]);

    const handleToggleTracking = useCallback((val: boolean) => {
        if (!val) {
            Alert.alert(
                'Disable Location Tracking',
                'Turning this off will stop automatic location logging every 15 minutes. You can still add events manually.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Disable',
                        style: 'destructive',
                        onPress: () => setTrackingEnabled(false),
                    },
                ]
            );
        } else {
            setTrackingEnabled(true);
        }
    }, [setTrackingEnabled]);


    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <View style={styles.header}>
                <TouchableOpacity onLongPress={handleDeveloperTools} delayLongPress={900} activeOpacity={1}>
                    <Text style={styles.greetingText}>Profile</Text>
                    <Text style={styles.headerTitle}>Settings</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* User Header */}
                <View style={styles.userCard}>
                    <TouchableOpacity
                        onPress={handlePickAvatar}
                        style={styles.avatarContainer}
                        activeOpacity={0.7}
                    >
                        {avatarUri ? (
                            <Image
                                source={{ uri: avatarUri }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Ionicons name="person" size={40} color="#666" />
                            </View>
                        )}
                        <View style={styles.avatarBadge}>
                            <Ionicons name="camera" size={12} color="#fff" />
                        </View>
                    </TouchableOpacity>

                    <View style={styles.userInfo}>
                        {isEditingName ? (
                            <View style={styles.nameEditRow}>
                                <TextInput
                                    style={styles.nameInput}
                                    value={nameInput}
                                    onChangeText={setNameInput}
                                    autoFocus
                                    maxLength={30}
                                    returnKeyType="done"
                                    onSubmitEditing={handleSaveName}
                                    onBlur={handleSaveName}
                                />
                                <TouchableOpacity onPress={handleSaveName} style={styles.saveBtn}>
                                    <Ionicons name="checkmark" size={20} color="#585594" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={handleStartEditName}
                                style={styles.nameRow}
                                activeOpacity={0.6}
                            >
                                <Text style={styles.userName}>{userName}</Text>
                                <Ionicons name="pencil" size={16} color="#999" style={styles.editIcon} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* System Toggles */}
                <Text style={styles.sectionTitle}>Preferences</Text>
                <View style={styles.card}>
                    <View style={styles.row}>
                        <View style={styles.rowTextColumn}>
                            <Text style={styles.rowTitle}>Tracking Status</Text>
                            <Text style={styles.rowSub}>Log location every 15 minutes</Text>
                        </View>
                        <Switch
                            value={isTrackingEnabled}
                            onValueChange={handleToggleTracking}
                            trackColor={{ false: '#c8c5d1', true: '#585594' }}
                            thumbColor={'#fff'}
                        />
                    </View>
                    <View style={styles.statusIndicator}>
                        <View style={[styles.statusDot, isTrackingEnabled ? styles.statusActive : styles.statusInactive]} />
                        <Text style={styles.statusText}>
                            {isTrackingEnabled ? 'Active — Logging in background' : 'Paused — No location data collected'}
                        </Text>
                    </View>
                </View>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fbf9f4' },
    header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 22 },
    greetingText: { fontSize: 15, color: '#787681', fontWeight: '500' },
    headerTitle: { fontSize: 28, fontWeight: '700', color: '#1b1c19', marginTop: 2 },
    scrollContent: { paddingHorizontal: 18, paddingBottom: 130 },

    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 24,
        marginBottom: 24,
        shadowColor: '#585594',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 3,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 16,
    },
    avatarImage: {
        width: 64,
        height: 64,
        borderRadius: 32,
    },
    avatarPlaceholder: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#f5f3ee',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#585594',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    userInfo: { flex: 1 },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userName: { fontSize: 20, fontWeight: '700', color: '#1b1c19' },
    editIcon: { marginLeft: 6 },
    nameEditRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    nameInput: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: '#1b1c19',
        borderBottomWidth: 1.5,
        borderBottomColor: '#585594',
        paddingVertical: 2,
        paddingHorizontal: 0,
    },
    saveBtn: {
        marginLeft: 8,
        padding: 4,
    },
    userSub: { fontSize: 14, color: '#666', marginTop: 4 },

    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#474650',
        marginBottom: 12,
        paddingLeft: 2,
    },
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
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rowTextColumn: { flex: 1, paddingRight: 10 },
    rowTitle: { fontSize: 16, fontWeight: '600', color: '#1b1c19' },
    rowSub: { fontSize: 13, color: '#787681', marginTop: 4 },

    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#f0eee9',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    statusActive: {
        backgroundColor: '#34C759',
    },
    statusInactive: {
        backgroundColor: '#c8c5d1',
    },
    statusText: {
        fontSize: 12,
        color: '#787681',
    },
});
