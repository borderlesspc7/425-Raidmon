import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNavigation } from '../../routes/NavigationContext';
import { useTheme } from '../../hooks/useTheme';

interface HeaderProps {
  onMenuPress?: () => void;
}

export default function Header({ onMenuPress }: HeaderProps) {
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { navigate } = useNavigation();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Left Section - Menu and Logo */}
        <View style={styles.leftSection}>
          {onMenuPress && (
            <TouchableOpacity
              onPress={onMenuPress}
              style={styles.menuButton}
            >
              <MaterialIcons name="menu" size={26} color={theme.colors.text} />
            </TouchableOpacity>
          )}
          <View style={styles.logoContainer}>
            <MaterialIcons name="content-cut" size={22} color={theme.colors.primary} />
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
            <MaterialIcons name="language" size={22} color={theme.colors.primary} />
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity
            onPress={handleLogout}
            style={styles.iconButton}
          >
            <MaterialIcons name="logout" size={20} color={theme.colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    safeArea: {
      backgroundColor: theme.colors.surface,
    },
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme.mode === "dark" ? 0.2 : 0.05,
      shadowRadius: 4,
      elevation: 2,
      minHeight: 52,
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
      backgroundColor: theme.colors.iconSoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
    logoText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.text,
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
      backgroundColor: theme.colors.iconSoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
