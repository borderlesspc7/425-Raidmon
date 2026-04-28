import React, { useEffect, useMemo, useState } from "react";
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
  Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { getDoc, doc } from "firebase/firestore";
import { useNavigation } from "../../routes/NavigationContext";
import { useAuth } from "../../hooks/useAuth";
import { paths } from "../../routes/paths";
import { db, auth } from "../../lib/firebaseconfig";
import type { WorkshopAsaasFormData } from "../../types/auth";

const COMPANY_TYPES: { id: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION"; label: string }[] = [
  { id: "MEI", label: "MEI" },
  { id: "LIMITED", label: "Ltda" },
  { id: "INDIVIDUAL", label: "Individual" },
  { id: "ASSOCIATION", label: "Associação" },
];

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

function formatCpfCnpjForDisplay(digits: string) {
  const d = onlyDigits(digits);
  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
  }
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

function formatCep(s: string) {
  const d = onlyDigits(s).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export default function RegisterWorkshop() {
  const { navigate } = useNavigation();
  const { register, loading, error, clearError } = useAuth();

  const [workshopName, setWorkshopName] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [companyType, setCompanyType] = useState<"MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION" | "">(
    "MEI"
  );
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    clearError();
  }, [clearError]);

  const idDigits = useMemo(() => onlyDigits(cpfCnpj), [cpfCnpj]);
  const isPf = idDigits.length === 11;
  const isPj = idDigits.length === 14;

  const formatPhone = (text: string) => {
    const numbers = text.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const formatBirth = (t: string) => {
    const d = t.replace(/\D/g, "").slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  };

  const validateField = (field: string, value: string) => {
    const nextErrors = { ...errors };
    const incomeNum = parseFloat(monthlyIncome.replace(/\./g, "").replace(",", "."));

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
      case "cpfCnpj": {
        const n = onlyDigits(value);
        if (n.length !== 11 && n.length !== 14) nextErrors.cpfCnpj = "CPF (11) ou CNPJ (14) dígitos";
        else delete nextErrors.cpfCnpj;
        break;
      }
      case "birthDate":
        if (isPf) {
          const b = onlyDigits(value);
          if (b.length !== 8) nextErrors.birthDate = "Data completa (DD/MM/AAAA)";
          else delete nextErrors.birthDate;
        } else delete nextErrors.birthDate;
        break;
      case "companyType":
        if (isPj) {
          if (!companyType) nextErrors.companyType = "Selecione o tipo de empresa";
          else delete nextErrors.companyType;
        } else delete nextErrors.companyType;
        break;
      case "monthlyIncome":
        if (!monthlyIncome.trim() || !Number.isFinite(incomeNum) || incomeNum <= 0) {
          nextErrors.monthlyIncome = "Informe o faturamento estimado (valor > 0)";
        } else delete nextErrors.monthlyIncome;
        break;
      case "address":
        if (!value.trim()) nextErrors.address = "Obrigatório";
        else delete nextErrors.address;
        break;
      case "addressNumber":
        if (!value.trim()) nextErrors.addressNumber = "Obrigatório";
        else delete nextErrors.addressNumber;
        break;
      case "province":
        if (!value.trim()) nextErrors.province = "Obrigatório";
        else delete nextErrors.province;
        break;
      case "postalCode": {
        const c = onlyDigits(value);
        if (c.length !== 8) nextErrors.postalCode = "CEP com 8 dígitos";
        else delete nextErrors.postalCode;
        break;
      }
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
    const incomeNum = parseFloat(monthlyIncome.replace(/\./g, "").replace(",", "."));
    const checks = [
      validateField("workshopName", workshopName),
      validateField("responsibleName", responsibleName),
      validateField("email", email),
      validateField("phone", phone),
      validateField("cpfCnpj", cpfCnpj),
      validateField("monthlyIncome", monthlyIncome),
      validateField("address", address),
      validateField("addressNumber", addressNumber),
      validateField("province", province),
      validateField("postalCode", postalCode),
      validateField("password", password),
      validateField("confirmPassword", confirmPassword),
    ];
    if (isPf) checks.push(validateField("birthDate", birthDate));
    if (isPj) checks.push(validateField("companyType", ""));

    if (checks.includes(false) || (isPj && !companyType)) {
      if (isPj && !companyType) {
        setErrors((e) => ({ ...e, companyType: "Selecione o tipo de empresa" }));
      }
      return;
    }

    const wa: WorkshopAsaasFormData = {
      address: address.trim(),
      addressNumber: addressNumber.trim(),
      province: province.trim(),
      postalCode: onlyDigits(postalCode),
      incomeValue: incomeNum,
      complement: complement.trim() || undefined,
    };
    if (isPf) {
      wa.birthDate = birthDate.trim();
    }
    if (isPj) {
      wa.companyType = (companyType || "MEI") as WorkshopAsaasFormData["companyType"];
    }

    try {
      await register({
        name: responsibleName.trim(),
        companyName: workshopName.trim(),
        email: email.trim().toLowerCase(),
        phone: onlyDigits(phone),
        userType: "workshop",
        password,
        confirmPassword,
        cpf: onlyDigits(cpfCnpj),
        workshopAsaas: wa,
      });
      const u = auth.currentUser;
      if (u) {
        const d = await getDoc(doc(db, "users", u.uid));
        const emsg = d.data()?.asaasSubaccountError as string | undefined;
        if (emsg) {
          Alert.alert(
            "Conta criada",
            "Sua conta foi criada, mas a subconta de pagamento (Asaas) não pôde ser concluída. Entre em contato com o suporte ou tente novamente mais tarde.\n\n" +
              emsg
          );
        }
      }
    } catch {
      // erro no contexto de auth
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Cadastro da Oficina</Text>
            <Text style={styles.subtitle}>
              Crie sua conta. Os dados fiscais e endereço são necessários para a conta de pagamento (Asaas).
            </Text>
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
              <Text style={styles.label}>Celular (Whatsapp)</Text>
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
              <Text style={styles.label}>CPF ou CNPJ</Text>
              <View style={[styles.inputWrapper, errors.cpfCnpj ? styles.inputError : null]}>
                <MaterialIcons name="badge" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="CPF ou CNPJ"
                  placeholderTextColor="#999"
                  value={cpfCnpj}
                  onChangeText={(t) => {
                    const f = formatCpfCnpjForDisplay(onlyDigits(t).slice(0, 14));
                    setCpfCnpj(f);
                    if (errors.cpfCnpj) validateField("cpfCnpj", f);
                  }}
                  onBlur={() => validateField("cpfCnpj", cpfCnpj)}
                  keyboardType="number-pad"
                />
              </View>
              {errors.cpfCnpj ? <Text style={styles.errorText}>{errors.cpfCnpj}</Text> : null}
            </View>

            {isPf ? (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Data de nascimento (CPF)</Text>
                <View style={[styles.inputWrapper, errors.birthDate ? styles.inputError : null]}>
                  <MaterialIcons name="event" size={20} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor="#999"
                    value={birthDate}
                    onChangeText={(t) => {
                      setBirthDate(formatBirth(t));
                      if (errors.birthDate) validateField("birthDate", formatBirth(t));
                    }}
                    onBlur={() => validateField("birthDate", birthDate)}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>
                {errors.birthDate ? <Text style={styles.errorText}>{errors.birthDate}</Text> : null}
              </View>
            ) : null}

            {isPj ? (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Tipo de empresa (CNPJ)</Text>
                <View style={styles.pillRow}>
                  {COMPANY_TYPES.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.pill,
                        (companyType || "MEI") === c.id ? styles.pillActive : null,
                        errors.companyType ? styles.pillError : null,
                      ]}
                      onPress={() => {
                        setCompanyType(c.id);
                        setErrors((e) => {
                          const n = { ...e };
                          delete n.companyType;
                          return n;
                        });
                      }}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          (companyType || "MEI") === c.id ? styles.pillTextActive : null,
                        ]}
                      >
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.companyType ? <Text style={styles.errorText}>{errors.companyType}</Text> : null}
              </View>
            ) : null}

            {idDigits.length > 0 && !isPf && !isPj ? (
              <Text style={styles.hintText}>Complete o CPF (11) ou o CNPJ (14) dígitos</Text>
            ) : null}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Faturamento estimado (R$)</Text>
              <View style={[styles.inputWrapper, errors.monthlyIncome ? styles.inputError : null]}>
                <MaterialIcons name="attach-money" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="ex: 5000 ou 12.000,50"
                  placeholderTextColor="#999"
                  value={monthlyIncome}
                  onChangeText={(t) => {
                    setMonthlyIncome(t);
                    if (errors.monthlyIncome) validateField("monthlyIncome", t);
                  }}
                  onBlur={() => validateField("monthlyIncome", monthlyIncome)}
                  keyboardType="decimal-pad"
                />
              </View>
              {errors.monthlyIncome ? <Text style={styles.errorText}>{errors.monthlyIncome}</Text> : null}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Rua / logradouro</Text>
              <View style={[styles.inputWrapper, errors.address ? styles.inputError : null]}>
                <MaterialIcons name="map" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Endereço"
                  placeholderTextColor="#999"
                  value={address}
                  onChangeText={(t) => {
                    setAddress(t);
                    if (errors.address) validateField("address", t);
                  }}
                  onBlur={() => validateField("address", address)}
                />
              </View>
              {errors.address ? <Text style={styles.errorText}>{errors.address}</Text> : null}
            </View>

            <View style={styles.row2}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Número</Text>
                <View style={[styles.inputWrapper, errors.addressNumber ? styles.inputError : null]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Nº"
                    placeholderTextColor="#999"
                    value={addressNumber}
                    onChangeText={(t) => {
                      setAddressNumber(t);
                      if (errors.addressNumber) validateField("addressNumber", t);
                    }}
                    onBlur={() => validateField("addressNumber", addressNumber)}
                  />
                </View>
                {errors.addressNumber ? <Text style={styles.errorText}>{errors.addressNumber}</Text> : null}
              </View>
              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Complemento</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Apto, bloco..."
                    placeholderTextColor="#999"
                    value={complement}
                    onChangeText={setComplement}
                  />
                </View>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Bairro</Text>
              <View style={[styles.inputWrapper, errors.province ? styles.inputError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="Bairro"
                  placeholderTextColor="#999"
                  value={province}
                  onChangeText={(t) => {
                    setProvince(t);
                    if (errors.province) validateField("province", t);
                  }}
                  onBlur={() => validateField("province", province)}
                />
              </View>
              {errors.province ? <Text style={styles.errorText}>{errors.province}</Text> : null}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>CEP</Text>
              <View style={[styles.inputWrapper, errors.postalCode ? styles.inputError : null]}>
                <MaterialIcons name="place" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="00000-000"
                  placeholderTextColor="#999"
                  value={postalCode}
                  onChangeText={(t) => {
                    const f = formatCep(t);
                    setPostalCode(f);
                    if (errors.postalCode) validateField("postalCode", f);
                  }}
                  onBlur={() => validateField("postalCode", postalCode)}
                  keyboardType="number-pad"
                  maxLength={9}
                />
              </View>
              {errors.postalCode ? <Text style={styles.errorText}>{errors.postalCode}</Text> : null}
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
  title: { fontSize: 28, fontWeight: "bold", color: "#1F2937", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", paddingHorizontal: 8 },
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
  row2: { flexDirection: "row", alignItems: "flex-start" },
  hintText: { color: "#6B7280", fontSize: 12, marginBottom: 8, marginTop: -8 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
  },
  pillActive: { backgroundColor: "#6366F1" },
  pillError: { borderWidth: 1, borderColor: "#EF4444" },
  pillText: { color: "#374151", fontSize: 12, fontWeight: "600" },
  pillTextActive: { color: "#fff" },
});
