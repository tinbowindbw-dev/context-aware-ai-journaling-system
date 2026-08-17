import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

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

export function GlassTabBar({ state, navigation }: any) {
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
    <View style={styles.wrapper}>
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
                color={isFocused ? '#585594' : '#b0adb8'}
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
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(228,225,245,0.82)',
    borderRadius: 28,
    paddingVertical: 6,
    paddingHorizontal: 6,
    shadowColor: '#585594',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  indicator: {
    position: 'absolute',
    backgroundColor: '#e3dfff',
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
    color: '#b0adb8',
    marginTop: 3,
    textAlign: 'center',
  },
  labelActive: {
    color: '#585594',
    fontWeight: '700',
  },
});
