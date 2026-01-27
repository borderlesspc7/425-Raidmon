import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Layout from '../../components/Layout/Layout';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../hooks/useAuth';

export default function Dashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();

  return (
    <Layout>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('navigation.dashboard')}</Text>
          <Text style={styles.subtitle}>
            Bem-vindo, {user?.name || 'Usuário'}!
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          {/* Placeholder para cards do dashboard */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dashboard em construção</Text>
            <Text style={styles.cardText}>
              Esta é a página principal do sistema. Aqui você terá uma visão geral de todas as informações importantes.
            </Text>
          </View>
        </View>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});
