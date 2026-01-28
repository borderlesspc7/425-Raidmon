import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { Language } from '../../types/auth';
import { useAuth } from '../../hooks/useAuth';
import { useNavigation } from '../../routes/NavigationContext';

export default function LanguageSelection() {
  const { language, setLanguage, t, updateUserLanguage } = useLanguage();
  const { user } = useAuth();
  const { navigate } = useNavigation();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);
  const [saving, setSaving] = useState(false);

  // Atualizar selectedLanguage quando o idioma do contexto mudar
  React.useEffect(() => {
    setSelectedLanguage(language);
  }, [language]);

  const handleSelectLanguage = async (lang: Language) => {
    setSelectedLanguage(lang);
    // Atualizar imediatamente o idioma no contexto para ver as mudanças
    await setLanguage(lang);
  };

  const handleContinue = async () => {
    try {
      setSaving(true);
      
      // Se o usuário estiver logado, salvar no perfil
      if (user && updateUserLanguage) {
        await updateUserLanguage(user.id, selectedLanguage);
      }
      
      // Pequeno delay para garantir que o idioma foi salvo
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Navegar para a próxima tela
      if (user) {
        navigate('Dashboard');
      } else {
        navigate('Login');
      }
    } catch (error) {
      console.error('Erro ao salvar idioma:', error);
      // Mesmo com erro, continua para a próxima tela
      if (user) {
        navigate('Dashboard');
      } else {
        navigate('Login');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../../assets/logo1.jpeg')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>{t('languageSelection.title')}</Text>
          <Text style={styles.subtitle}>{t('languageSelection.subtitle')}</Text>
        </View>

        {/* Language Options */}
        <View style={styles.optionsContainer}>
          {/* Portuguese Option */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedLanguage === 'pt' && styles.optionCardSelected,
            ]}
            onPress={() => handleSelectLanguage('pt')}
            activeOpacity={0.7}
          >
            <View style={styles.optionContent}>
              <View style={[
                styles.flagContainer,
                selectedLanguage === 'pt' && styles.flagContainerSelected,
              ]}>
                <Text style={styles.flag}>🇧🇷</Text>
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[
                  styles.optionTitle,
                  selectedLanguage === 'pt' && styles.optionTitleSelected,
                ]}>
                  {t('languageSelection.portuguese')}
                </Text>
                <Text style={[
                  styles.optionSubtitle,
                  selectedLanguage === 'pt' && styles.optionSubtitleSelected,
                ]}>
                  Português
                </Text>
              </View>
              {selectedLanguage === 'pt' && (
                <View style={styles.checkContainer}>
                  <MaterialIcons name="check-circle" size={28} color="#6366F1" />
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Spanish Option */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedLanguage === 'es' && styles.optionCardSelected,
            ]}
            onPress={() => handleSelectLanguage('es')}
            activeOpacity={0.7}
          >
            <View style={styles.optionContent}>
              <View style={[
                styles.flagContainer,
                selectedLanguage === 'es' && styles.flagContainerSelected,
              ]}>
                <Text style={styles.flag}>🇪🇸</Text>
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[
                  styles.optionTitle,
                  selectedLanguage === 'es' && styles.optionTitleSelected,
                ]}>
                  {t('languageSelection.spanish')}
                </Text>
                <Text style={[
                  styles.optionSubtitle,
                  selectedLanguage === 'es' && styles.optionSubtitleSelected,
                ]}>
                  Español
                </Text>
              </View>
              {selectedLanguage === 'es' && (
                <View style={styles.checkContainer}>
                  <MaterialIcons name="check-circle" size={28} color="#6366F1" />
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleContinue}
          disabled={saving}
        >
          <Text style={styles.buttonText}>
            {t('languageSelection.continue')}
          </Text>
          <MaterialIcons name="arrow-forward" size={24} color="#FFFFFF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  optionsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  optionCardSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#F0F4FF',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  flagContainerSelected: {
    backgroundColor: '#E0E7FF',
  },
  flag: {
    fontSize: 40,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  optionTitleSelected: {
    color: '#6366F1',
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  optionSubtitleSelected: {
    color: '#6366F1',
  },
  checkContainer: {
    marginLeft: 8,
  },
  button: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
