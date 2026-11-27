import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PRIVACY_POLICY_TEXT } from '../privacyPolicy';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function PrivacyModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Privacy Policy (GDPR / DSGVO)</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.policyText}>{PRIVACY_POLICY_TEXT}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 18 },
  card: { backgroundColor: '#1e293b', borderRadius: 14, padding: 18, gap: 10, maxHeight: '85%' },
  title: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  scroll: { maxHeight: 340 },
  policyText: { color: '#cbd5e1', fontSize: 13, lineHeight: 20 },
  closeBtn: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center' },
  closeBtnText: { color: '#fff', fontWeight: '700' },
});