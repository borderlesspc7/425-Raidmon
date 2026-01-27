import React, { useState } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import { useNavigation } from '../../routes/NavigationContext';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentScreen } = useNavigation();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <View style={styles.container}>
      <Header onMenuPress={toggleSidebar} />
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        currentRoute={currentScreen}
      />
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
  },
});
