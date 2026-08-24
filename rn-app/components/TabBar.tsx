import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  index: 'sensors',
  interpretation: 'auto-awesome',
  story: 'auto-stories',
  archive: 'history',
  profile: 'person',
};

const LABELS: Record<string, string> = {
  index: 'Event',
  interpretation: 'Interp',
  story: 'Story',
  archive: 'Archive',
  profile: 'Profile',
};

const TAB_ACTIVE_COLOR = '#585594';
const TAB_INACTIVE_COLOR = '#8f8ca0';

export function GlassTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const tabCount = state.routes.length;
  const tabWidth = containerWidth > 0 ? (containerWidth - 12) / tabCount : 0;
  const indicatorWidth = tabWidth > 0 ? tabWidth - 12 : 0;
  const indicatorTop = containerHeight > 0 ? (containerHeight - 52) / 2 : 0;

  const translateX = useSharedValue(0);

  useEffect(() => {
    if (tabWidth > 0) {
      translateX.value = withSpring(
        6 + state.index * tabWidth + (tabWidth - indicatorWidth) / 2,
        { damping: 25, stiffness: 250, mass: 0.5 }
      );
    }
  }, [state.index, tabWidth, indicatorWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: indicatorWidth,
  }));

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View
        style={styles.container}
        onLayout={(e) => {
          setContainerWidth(e.nativeEvent.layout.width);
          setContainerHeight(e.nativeEvent.layout.height);
        }}
      >
        {/* Animated pill indicator */}
        <Animated.View
          style={[
            styles.indicator,
            indicatorStyle,
            { top: indicatorTop, height: 52 },
          ]}
        />

        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const iconName = ICONS[route.name] || 'circle';
          const label = LABELS[route.name] || route.name;

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              style={styles.tab}
            >
              <MaterialIcons
                name={iconName}
                size={22}
                color={isFocused ? TAB_ACTIVE_COLOR : TAB_INACTIVE_COLOR}
              />
              <Text style={[styles.label, isFocused && styles.labelActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 12,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#f8f7fc',
    borderRadius: 28,
    paddingVertical: 6,
    paddingHorizontal: 6,
    shadowColor: TAB_ACTIVE_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(88,85,148,0.15)',
  },
  indicator: {
    position: 'absolute',
    backgroundColor: '#e9e5ff',
    borderRadius: 26,
    opacity: 0.75,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    zIndex: 1,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '600',
    color: TAB_INACTIVE_COLOR,
    marginTop: 3,
    textAlign: 'center',
  },
  labelActive: {
    color: TAB_ACTIVE_COLOR,
    fontWeight: '700',
  },
});
