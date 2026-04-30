import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  PanResponder,
} from 'react-native';
import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import { useNavigation } from '../../routes/NavigationContext';
import { useTheme } from '../../hooks/useTheme';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentScreen } = useNavigation();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          const { dx, dy, x0 } = gestureState;

          // Prefer horizontal gestures
          if (Math.abs(dx) < 10) return false;
          if (Math.abs(dx) < Math.abs(dy)) return false;

          // Open: swipe from left edge to right
          if (!sidebarOpen && x0 <= 24 && dx > 10) return true;

          // Close: swipe left when sidebar is open
          if (sidebarOpen && dx < -10) return true;

          return false;
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const { dx, x0 } = gestureState;

          if (!sidebarOpen && x0 <= 24 && dx > 60) {
            setSidebarOpen(true);
          } else if (sidebarOpen && dx < -60) {
            setSidebarOpen(false);
          }
        },
        onPanResponderTerminate: () => {},
      }),
    [sidebarOpen],
  );

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Header onMenuPress={toggleSidebar} />
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        currentRoute={currentScreen}
      />
      <View style={styles.content}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      backgroundColor: theme.colors.background,
      minHeight: "100%",
    },
  });
