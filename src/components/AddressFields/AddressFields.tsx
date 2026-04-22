import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export type AddressValue = {
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  uf: string;
};

type LockedFields = {
  street: boolean;
  neighborhood: boolean;
  city: boolean;
  uf: boolean;
};

type Props = {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  title: string;
  cepOptionalLabel?: string;
};

const UF_MAX_LEN = 2;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCep(value: string) {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function cepDigits(value: string) {
  return onlyDigits(value).slice(0, 8);
}

export default function AddressFields({
  value,
  onChange,
  title,
  cepOptionalLabel = "(opcional)",
}: Props) {
  const [locked, setLocked] = useState<LockedFields>({
    street: false,
    neighborhood: false,
    city: false,
    uf: false,
  });
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cep = value.cep;
  const cep8 = useMemo(() => cepDigits(cep), [cep]);

  const setField = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });

  // If user changes CEP, we should unlock auto-filled fields (they may want manual edits)
  useEffect(() => {
    setCepError(null);
    setLoadingCep(false);
    if (abortRef.current) abortRef.current.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // CEP empty => unlock everything
    if (!cep8) {
      setLocked({ street: false, neighborhood: false, city: false, uf: false });
      return;
    }

    // Only query when it is a full CEP
    if (cep8.length !== 8) {
      setLocked({ street: false, neighborhood: false, city: false, uf: false });
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoadingCep(true);
      setCepError(null);

      try {
        const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep8}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error("CEP não encontrado");
        }

        const data: any = await res.json();
        const street = (data.street ?? "").trim();
        const neighborhood = (data.neighborhood ?? "").trim();
        const city = (data.city ?? "").trim();
        const uf = String(data.state ?? "").trim().toUpperCase();

        setField({
          street: street || value.street,
          neighborhood: neighborhood || value.neighborhood,
          city: city || value.city,
          uf: uf || value.uf,
        });

        // Lock only fields that were actually filled by API
        setLocked({
          street: Boolean(street),
          neighborhood: Boolean(neighborhood),
          city: Boolean(city),
          uf: Boolean(uf),
        });
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setLocked({ street: false, neighborhood: false, city: false, uf: false });
        setCepError(e?.message || "Erro ao consultar CEP");
      } finally {
        setLoadingCep(false);
      }
    }, 450);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cep8]);

  return (
    <View style={styles.block}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>CEP {cepOptionalLabel}</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="local-post-office" size={20} color="#6B7280" />
            <TextInput
              style={styles.input}
              value={formatCep(cep)}
              onChangeText={(text) => setField({ cep: formatCep(text) })}
              placeholder="00000-000"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={9}
            />
            {loadingCep ? <ActivityIndicator size="small" color="#6366F1" /> : null}
          </View>
          {cepError ? <Text style={styles.errorText}>{cepError}</Text> : null}
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>Rua</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="place" size={20} color="#6B7280" />
            <TextInput
              style={styles.input}
              value={value.street}
              onChangeText={(text) => setField({ street: text })}
              placeholder="Rua / Avenida"
              placeholderTextColor="#9CA3AF"
              editable={!locked.street}
            />
          </View>
        </View>

        <View style={[styles.inputGroup, { width: 110 }]}>
          <Text style={styles.label}>Número</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="tag" size={20} color="#6B7280" />
            <TextInput
              style={styles.input}
              value={value.number}
              onChangeText={(text) => setField({ number: text })}
              placeholder="123"
              placeholderTextColor="#9CA3AF"
              keyboardType="default"
            />
          </View>
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>Bairro</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="my-location" size={20} color="#6B7280" />
            <TextInput
              style={styles.input}
              value={value.neighborhood}
              onChangeText={(text) => setField({ neighborhood: text })}
              placeholder="Bairro"
              placeholderTextColor="#9CA3AF"
              editable={!locked.neighborhood}
            />
          </View>
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>Cidade</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="location-city" size={20} color="#6B7280" />
            <TextInput
              style={styles.input}
              value={value.city}
              onChangeText={(text) => setField({ city: text })}
              placeholder="Cidade"
              placeholderTextColor="#9CA3AF"
              editable={!locked.city}
            />
          </View>
        </View>

        <View style={[styles.inputGroup, { width: 90 }]}>
          <Text style={styles.label}>UF</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="map" size={20} color="#6B7280" />
            <TextInput
              style={styles.input}
              value={value.uf}
              onChangeText={(text) =>
                setField({ uf: text.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, UF_MAX_LEN) })
              }
              placeholder="SP"
              placeholderTextColor="#9CA3AF"
              editable={!locked.uf}
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

export function composeAddressString(a: AddressValue) {
  const street = a.street.trim();
  const number = a.number.trim();
  const neighborhood = a.neighborhood.trim();
  const city = a.city.trim();
  const uf = a.uf.trim().toUpperCase();

  const first = [street, number ? `, ${number}` : ""].join("").trim();
  const second = neighborhood ? neighborhood : "";
  const third = [city, uf ? ` - ${uf}` : ""].join("").trim();

  return [first, second, third].filter(Boolean).join(" • ");
}

const styles = StyleSheet.create({
  block: {
    gap: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 2,
  },
});

