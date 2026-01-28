import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNavigation } from '../../routes/NavigationContext';

interface HeaderProps {
  onMenuPress?: () => void;
}

export default function Header({ onMenuPress }: HeaderProps) {
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { navigate } = useNavigation();

  const toggleLanguage = async () => {
    const newLang = language === 'pt' ? 'es' : 'pt';
    await setLanguage(newLang);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('Login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Left Section - Menu and Logo */}
        <View style={styles.leftSection}>
          {onMenuPress && (
            <TouchableOpacity
              onPress={onMenuPress}
              style={styles.menuButton}
            >
              <MaterialIcons name="menu" size={26} color="#1F2937" />
            </TouchableOpacity>
          )}
          <View style={styles.logoContainer}>
            <MaterialIcons name="content-cut" size={22} color="#6366F1" />
          </View>
          <Text style={styles.logoText} numberOfLines={1}>Costura Conectada</Text>
        </View>

        {/* Right Section - Compact actions */}
        <View style={styles.rightSection}>
          {/* Language Toggle */}
          <TouchableOpacity
            onPress={toggleLanguage}
            style={styles.iconButton}
          >
            <MaterialIcons name="language" size={22} color="#6366F1" />
          </TouchableOpacity>

          {/* User Avatar */}
          {user && (
            <TouchableOpacity style={styles.userAvatar}>
              <MaterialIcons name="person" size={18} color="#6366F1" />
            </TouchableOpacity>
          )}

          {/* Logout Button */}
          <TouchableOpacity
            onPress={handleLogout}
            style={styles.iconButton}
          >
            <MaterialIcons name="logout" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 60,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  menuButton: {
    padding: 6,
    marginRight: 8,
  },
  logoContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
