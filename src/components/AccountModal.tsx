import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Props {
  visible: boolean;
  email: string | null;
  deleting: boolean;
  onOpenPrivacy: () => void;
  onExportCsv: () => void;
  onLogout: () => void;
  onDeleteAccount: (password: string) => void;
  onClose: () => void;
}

export function AccountModal({
  visible,
  email,
  deleting,
  onOpenPrivacy,
  onExportCsv,
  onLogout,
  onDeleteAccount,
  onClose,
}: Props) {
  const [deletePassword, setDeletePassword] = useState('');

  function handleClose() {
    setDeletePassword('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Account & GDPR</Text>
          <Text style={styles.email}>{email}</Text>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              handleClose();
              onOpenPrivacy();
            }}
          >
            <Text style={styles.secondaryBtnText}>Privacy Policy (GDPR / DSGVO)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onExportCsv}>
            <Text style={styles.secondaryBtnText}>Export My Data (CSV – Art. 20)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              handleClose();
              onLogout();
            }}
          >
            <Text style={styles.secondaryBtnText}>Log Out</Text>
          </TouchableOpacity>

          <View style={styles.dangerBox}>
            <Text style={styles.dangerTitle}>Danger Zone (GDPR Art. 17)</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm password to delete account"
              placeholderTextColor="#888"
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
            />
            <TouchableOpacity
              style={[styles.dangerBtn, deleting && { opacity: 0.6 }]}
              onPress={() => onDeleteAccount(deletePassword)}
              disabled={deleting}
            >
              <Text style={styles.dangerBtnText}>
                {deleting ? 'Deleting...' : 'Delete Account & All Data'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleClose}>
            <Text style={styles.primaryBtnText}>Close</Text>
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
  email: { color: '#38bdf8', fontSize: 13, marginBottom: 4 },
  input: { backgroundColor: '#0f172a', color: '#f8fafc', padding: 10, borderRadius: 8, fontSize: 14 },
  primaryBtn: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { backgroundColor: '#334155', padding: 11, borderRadius: 8, alignItems: 'center' },
  secondaryBtnText: { color: '#f8fafc', fontWeight: '600', fontSize: 14 },
  dangerBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, gap: 8, borderWidth: 1, borderColor: '#7f1d1d' },
  dangerTitle: { color: '#f87171', fontWeight: '700', fontSize: 13 },
  dangerBtn: { backgroundColor: '#dc2626', padding: 11, borderRadius: 8, alignItems: 'center' },
  dangerBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});