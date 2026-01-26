import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '../../routes/NavigationContext';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';

export default function Register() {
  const { navigate } = useNavigation();
  const { register, loading, error, clearError } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    clearError();
    console.log('Register - Idioma atual:', language);
  }, [language, clearError]);

  const toggleLanguage = async () => {
    const newLang = language === 'pt' ? 'es' : 'pt';
    await setLanguage(newLang);
  };

  const formatPhone = (text: string) => {
    const numbers = text.replace(/\D/g, '');
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    } else {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  const validateField = (field: string, value: string) => {
    const newErrors = { ...errors };

    switch (field) {
      case 'name':
        if (!value.trim()) {
          newErrors.name = t('register.nameRequired');
        } else if (value.trim().length < 3) {
          newErrors.name = t('register.nameMinLength');
        } else {
          delete newErrors.name;
        }
        break;

      case 'companyName':
        if (!value.trim()) {
          newErrors.companyName = t('register.companyNameRequired');
        } else if (value.trim().length < 3) {
          newErrors.companyName = t('register.companyNameMinLength');
        } else {
          delete newErrors.companyName;
        }
        break;

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!value) {
          newErrors.email = t('register.emailRequired');
        } else if (!emailRegex.test(value)) {
          newErrors.email = t('register.emailInvalid');
        } else {
          delete newErrors.email;
        }
        break;

      case 'phone':
        const phoneNumbers = value.replace(/\D/g, '');
        if (!value) {
          newErrors.phone = t('register.phoneRequired');
        } else if (phoneNumbers.length < 10) {
          newErrors.phone = t('register.phoneInvalid');
        } else {
          delete newErrors.phone;
        }
        break;

      case 'password':
        if (!value) {
          newErrors.password = t('register.passwordRequired');
        } else if (value.length < 6) {
          newErrors.password = t('register.passwordMinLength');
        } else {
          delete newErrors.password;
        }
        if (confirmPassword && value !== confirmPassword) {
          newErrors.confirmPassword = t('register.passwordsDontMatch');
        } else if (confirmPassword) {
          delete newErrors.confirmPassword;
        }
        break;

      case 'confirmPassword':
        if (!value) {
          newErrors.confirmPassword = t('register.confirmPasswordRequired');
        } else if (value !== password) {
          newErrors.confirmPassword = t('register.passwordsDontMatch');
        } else {
          delete newErrors.confirmPassword;
        }
        break;
    }

    setErrors(newErrors);
    return !newErrors[field];
  };

  const handleRegister = async () => {
    const isNameValid = validateField('name', name);
    const isCompanyNameValid = validateField('companyName', companyName);
    const isEmailValid = validateField('email', email);
    const isPhoneValid = validateField('phone', phone);
    const isPasswordValid = validateField('password', password);
    const isConfirmPasswordValid = validateField('confirmPassword', confirmPassword);

    if (!isNameValid || !isCompanyNameValid || !isEmailValid || !isPhoneValid || !isPasswordValid || !isConfirmPasswordValid) {
      return;
    }

    try {
      const phoneNumbers = phone.replace(/\D/g, '');
      await register({
        name: name.trim(),
        companyName: companyName.trim(),
        email: email.trim().toLowerCase(),
        phone: phoneNumbers,
        password,
        confirmPassword,
      });
    } catch (err) {
      // Erro já é tratado pelo AuthContext
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigate('Login')}
              style={styles.backButton}
            >
              <MaterialIcons name="arrow-back" size={24} color="#6366F1" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleLanguage}
              style={styles.languageButton}
            >
              <MaterialIcons name="language" size={24} color="#6366F1" />
              <Text style={styles.languageText}>{language.toUpperCase()}</Text>
            </TouchableOpacity>

            <View style={styles.logoContainer}>
              <MaterialIcons name="content-cut" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>{t('register.title')}</Text>
            <Text style={styles.subtitle}>{t('register.subtitle')}</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('register.name')}</Text>
              <View style={[styles.inputWrapper, errors.name ? styles.inputError : null]}>
                <MaterialIcons name="person" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.namePlaceholder')}
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (errors.name) validateField('name', text);
                  }}
                  onBlur={() => validateField('name', name)}
                  autoCapitalize="words"
                />
              </View>
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
            </View>

            {/* Company Name Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('register.companyName')}</Text>
              <View style={[styles.inputWrapper, errors.companyName ? styles.inputError : null]}>
                <MaterialIcons name="business" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.companyNamePlaceholder')}
                  placeholderTextColor="#999"
                  value={companyName}
                  onChangeText={(text) => {
                    setCompanyName(text);
                    if (errors.companyName) validateField('companyName', text);
                  }}
                  onBlur={() => validateField('companyName', companyName)}
                  autoCapitalize="words"
                />
              </View>
              {errors.companyName ? <Text style={styles.errorText}>{errors.companyName}</Text> : null}
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('register.email')}</Text>
              <View style={[styles.inputWrapper, errors.email ? styles.inputError : null]}>
                <MaterialIcons name="email" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.emailPlaceholder')}
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) validateField('email', text);
                  }}
                  onBlur={() => validateField('email', email)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            {/* Phone Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('register.phone')}</Text>
              <View style={[styles.inputWrapper, errors.phone ? styles.inputError : null]}>
                <MaterialIcons name="phone" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.phonePlaceholder')}
                  placeholderTextColor="#999"
                  value={phone}
                  onChangeText={(text) => {
                    const formatted = formatPhone(text);
                    setPhone(formatted);
                    if (errors.phone) validateField('phone', formatted);
                  }}
                  onBlur={() => validateField('phone', phone)}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </View>
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('register.password')}</Text>
              <View style={[styles.inputWrapper, errors.password ? styles.inputError : null]}>
                <MaterialIcons name="lock" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.passwordPlaceholder')}
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) validateField('password', text);
                    if (confirmPassword && errors.confirmPassword) validateField('confirmPassword', confirmPassword);
                  }}
                  onBlur={() => validateField('password', password)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <MaterialIcons 
                    name={showPassword ? "visibility" : "visibility-off"} 
                    size={20} 
                    color="#6B7280" 
                  />
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('register.confirmPassword')}</Text>
              <View style={[styles.inputWrapper, errors.confirmPassword ? styles.inputError : null]}>
                <MaterialIcons name="lock" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.confirmPasswordPlaceholder')}
                  placeholderTextColor="#999"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errors.confirmPassword) validateField('confirmPassword', text);
                  }}
                  onBlur={() => validateField('confirmPassword', confirmPassword)}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                >
                  <MaterialIcons 
                    name={showConfirmPassword ? "visibility" : "visibility-off"} 
                    size={20} 
                    color="#6B7280" 
                  />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <MaterialIcons name="warning" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={styles.errorMessage}>{error}</Text>
              </View>
            )}

            {/* Register Button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>{t('register.createAccount')}</Text>
              )}
            </TouchableOpacity>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>{t('register.hasAccount')}</Text>
              <TouchableOpacity
                onPress={() => navigate('Login')}
              >
                <Text style={styles.loginLink}>{t('register.login')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  languageButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  languageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
    marginLeft: 4,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  eyeButton: {
    padding: 4,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorMessage: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  button: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  loginText: {
    fontSize: 14,
    color: '#6B7280',
  },
  loginLink: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
  },
});
