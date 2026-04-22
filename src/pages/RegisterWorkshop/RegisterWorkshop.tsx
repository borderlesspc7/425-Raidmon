import React, { useEffect, useState } from "react";
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
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "../../routes/NavigationContext";
import { useAuth } from "../../hooks/useAuth";
import { paths } from "../../routes/paths";

export default function RegisterWorkshop() {
  const { navigate } = useNavigation();
  const { register, loading, error, clearError } = useAuth();

  const [workshopName, setWorkshopName] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    clearError();
  }, [clearError]);

  const formatPhone = (text: string) => {
    const numbers = text.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const validateField = (field: string, value: string) => {
    const nextErrors = { ...errors };

    switch (field) {
      case "workshopName":
        if (!value.trim()) nextErrors.workshopName = "Nome da oficina é obrigatório";
        else if (value.trim().length < 3) nextErrors.workshopName = "Nome da oficina deve ter pelo menos 3 caracteres";
        else delete nextErrors.workshopName;
        break;
      case "responsibleName":
        if (!value.trim()) nextErrors.responsibleName = "Nome do responsável é obrigatório";
        else if (value.trim().length < 3) nextErrors.responsibleName = "Nome do responsável deve ter pelo menos 3 caracteres";
        else delete nextErrors.responsibleName;
        break;
      case "email":
        if (!value.trim()) nextErrors.email = "E-mail é obrigatório";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) nextErrors.email = "E-mail inválido";
        else delete nextErrors.email;
        break;
      case "phone":
        if (!value.trim()) nextErrors.phone = "Telefone é obrigatório";
        else if (value.replace(/\D/g, "").length < 10) nextErrors.phone = "Telefone inválido";
        else delete nextErrors.phone;
        break;
      case "password":
        if (!value) nextErrors.password = "Senha é obrigatória";
        else if (value.length < 6) nextErrors.password = "Senha deve ter pelo menos 6 caracteres";
        else delete nextErrors.password;
        if (confirmPassword && confirmPassword !== value) nextErrors.confirmPassword = "As senhas não coincidem";
        else if (confirmPassword) delete nextErrors.confirmPassword;
        break;
      case "confirmPassword":
        if (!value) nextErrors.confirmPassword = "Confirmação de senha é obrigatória";
        else if (value !== password) nextErrors.confirmPassword = "As senhas não coincidem";
        else delete nextErrors.confirmPassword;
        break;
      default:
        break;
    }

    setErrors(nextErrors);
    return !nextErrors[field];
  };

  const handleRegisterWorkshop = async () => {
    const isWorkshopNameValid = validateField("workshopName", workshopName);
    const isResponsibleNameValid = validateField("responsibleName", responsibleName);
    const isEmailValid = validateField("email", email);
    const isPhoneValid = validateField("phone", phone);
    const isPasswordValid = validateField("password", password);
    const isConfirmPasswordValid = validateField("confirmPassword", confirmPassword);

    if (!isWorkshopNameValid || !isResponsibleNameValid || !isEmailValid || !isPhoneValid || !isPasswordValid || !isConfirmPasswordValid) {
      return;
    }

    try {
      await register({
        name: responsibleName.trim(),
        companyName: workshopName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.replace(/\D/g, ""),
        userType: "workshop",
        password,
        confirmPassword,
        cpf: "",
      });
    } catch {
      // erro tratado no contexto de auth
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigate(paths.registerSelection)} style={styles.backButton}>
              <MaterialIcons name="arrow-back-ios" size={24} color="#6366F1" />
            </TouchableOpacity>
            <Text style={styles.title}>Cadastro da Oficina</Text>
            <Text style={styles.subtitle}>Crie sua conta como oficina de confeccao</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nome da oficina</Text>
              <View style={[styles.inputWrapper, errors.workshopName ? styles.inputError : null]}>
                <MaterialIcons name="business" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Digite o nome da oficina"
                  placeholderTextColor="#999"
                  value={workshopName}
                  onChangeText={(text) => {
                    setWorkshopName(text);
                    if (errors.workshopName) validateField("workshopName", text);
                  }}
                  onBlur={() => validateField("workshopName", workshopName)}
                />
              </View>
              {errors.workshopName ? <Text style={styles.errorText}>{errors.workshopName}</Text> : null}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nome do responsável</Text>
              <View style={[styles.inputWrapper, errors.responsibleName ? styles.inputError : null]}>
                <MaterialIcons name="person" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Digite o nome do responsável"
                  placeholderTextColor="#999"
                  value={responsibleName}
                  onChangeText={(text) => {
                    setResponsibleName(text);
                    if (errors.responsibleName) validateField("responsibleName", text);
                  }}
                  onBlur={() => validateField("responsibleName", responsibleName)}
                />
              </View>
              {errors.responsibleName ? <Text style={styles.errorText}>{errors.responsibleName}</Text> : null}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>E-mail</Text>
              <View style={[styles.inputWrapper, errors.email ? styles.inputError : null]}>
                <MaterialIcons name="email" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="seu@email.com"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) validateField("email", text);
                  }}
                  onBlur={() => validateField("email", email)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Telefone</Text>
              <View style={[styles.inputWrapper, errors.phone ? styles.inputError : null]}>
                <MaterialIcons name="phone" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor="#999"
                  value={phone}
                  onChangeText={(text) => {
                    const formatted = formatPhone(text);
                    setPhone(formatted);
                    if (errors.phone) validateField("phone", formatted);
                  }}
                  onBlur={() => validateField("phone", phone)}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </View>
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Senha</Text>
              <View style={[styles.inputWrapper, errors.password ? styles.inputError : null]}>
                <MaterialIcons name="lock" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) validateField("password", text);
                    if (confirmPassword && errors.confirmPassword) validateField("confirmPassword", confirmPassword);
                  }}
                  onBlur={() => validateField("password", password)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirmar senha</Text>
              <View style={[styles.inputWrapper, errors.confirmPassword ? styles.inputError : null]}>
                <MaterialIcons name="lock" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Digite a senha novamente"
                  placeholderTextColor="#999"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errors.confirmPassword) validateField("confirmPassword", text);
                  }}
                  onBlur={() => validateField("confirmPassword", confirmPassword)}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton}>
                  <MaterialIcons name={showConfirmPassword ? "visibility" : "visibility-off"} size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <MaterialIcons name="warning" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={styles.errorMessage}>{error}</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegisterWorkshop} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Criar Conta</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 },
  header: { alignItems: "center", marginBottom: 32, position: "relative" },
  backButton: { position: "absolute", left: 0, top: 0, padding: 12 },
  title: { fontSize: 28, fontWeight: "bold", color: "#1F2937", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", paddingHorizontal: 20 },
  form: { width: "100%" },
  inputContainer: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    height: 56,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: { borderColor: "#EF4444" },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: "#1F2937" },
  eyeButton: { padding: 4 },
  errorText: { color: "#EF4444", fontSize: 12, marginTop: 4, marginLeft: 4 },
  errorContainer: {
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
    flexDirection: "row",
    alignItems: "center",
  },
  errorMessage: { color: "#DC2626", fontSize: 14, fontWeight: "500", flex: 1 },
  button: {
    backgroundColor: "#6366F1",
    borderRadius: 12,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "600" },
});
