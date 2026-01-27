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
        {/* Left Section - Logo and Menu */}
        <View style={styles.leftSection}>
          {onMenuPress && (
            <TouchableOpacity
              onPress={onMenuPress}
              style={styles.menuButton}
            >
              <MaterialIcons name="menu" size={28} color="#1F2937" />
            </TouchableOpacity>
          )}
          <View style={styles.logoContainer}>
            <MaterialIcons name="content-cut" size={24} color="#6366F1" />
          </View>
          <Text style={styles.logoText}>Costura Conectada</Text>
        </View>

        {/* Right Section - Language, User, Logout */}
        <View style={styles.rightSection}>
          {/* Language Toggle */}
          <TouchableOpacity
            onPress={toggleLanguage}
            style={styles.languageButton}
          >
            <MaterialIcons name="language" size={20} color="#6366F1" />
            <Text style={styles.languageText}>{language.toUpperCase()}</Text>
          </TouchableOpacity>

          {/* User Info */}
          {user && (
            <View style={styles.userContainer}>
              <View style={styles.userAvatar}>
                <MaterialIcons name="person" size={20} color="#6366F1" />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user.name}
                </Text>
                {user.companyName && (
                  <Text style={styles.userCompany} numberOfLines={1}>
                    {user.companyName}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Logout Button */}
          <TouchableOpacity
            onPress={handleLogout}
            style={styles.logoutButton}
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuButton: {
    marginRight: 12,
    padding: 4,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F4FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  languageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
    marginLeft: 4,
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 200,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  userCompany: {
    fontSize: 12,
    color: '#6B7280',
  },
  logoutButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
});
