import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { loginUser, registerUser, resetPassword } from '../firebase';
import { mapFirebaseError } from '../utils/subscriptionMath';

interface Props {
  onOpenPrivacy: () => void;
}

export function AuthScreen({ onOpenPrivacy }: Props) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || password.length < 6) {
      Alert.alert('Invalid input', 'Enter a valid email and a password of at least 6 characters.');
      return;
    }
    if (isRegister && !gdprAccepted) {
      Alert.alert('GDPR Consent Required', 'Please accept the Privacy Policy to create an account.');
      return;
    }

    setBusy(true);
    try {
      if (isRegister) {
        await registerUser(email, password);
      } else {
        await loginUser(email, password);
      }
    } catch (err) {
      Alert.alert('Authentication Error', mapFirebaseError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      Alert.alert('Enter Email', 'Type your account email above, then tap Forgot Password.');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email);
      Alert.alert('Email Sent', `Password reset instructions sent to ${email.trim()}.`);
    } catch (err) {
      Alert.alert('Reset Error', mapFirebaseError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.box}>
        <Text style={styles.title}>Alle Abo</Text>
        <Text style={styles.subtitle}>
          {isRegister ? 'Create an EU-hosted account' : 'Sign in to sync your subscriptions'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor="#888"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min. 6 characters)"
          placeholderTextColor="#888"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {isRegister && (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              I consent to data processing as described in the GDPR Privacy Policy.
            </Text>
            <Switch value={gdprAccepted} onValueChange={setGdprAccepted} />
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, busy && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#052e16" />
          ) : (
            <Text style={styles.submitBtnText}>{isRegister ? 'Register' : 'Log In'}</Text>
          )}
        </TouchableOpacity>

        {!isRegister && (
          <TouchableOpacity onPress={handleForgotPassword} disabled={busy}>
            <Text style={styles.centerLink}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => setIsRegister((prev) => !prev)} disabled={busy}>
          <Text style={styles.centerLink}>
            {isRegister ? 'Already have an account? Log In' : 'No account yet? Register'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onOpenPrivacy} style={styles.privacyFooterBtn}>
          <Text style={styles.privacyLink}>View Privacy Policy (GDPR / DSGVO)</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: '#1e293b', padding: 20, borderRadius: 14, gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: '#f8fafc' },
  subtitle: { color: '#94a3b8', fontSize: 14, marginBottom: 4 },
  input: { backgroundColor: '#0f172a', color: '#f8fafc', padding: 10, borderRadius: 8, fontSize: 14 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { color: '#cbd5e1', fontSize: 13, flex: 1, marginRight: 10 },
  submitBtn: { backgroundColor: '#22c55e', padding: 12, borderRadius: 8, alignItems: 'center' },
  submitBtnText: { color: '#052e16', fontWeight: '700', fontSize: 15 },
  centerLink: { color: '#38bdf8', textAlign: 'center', fontSize: 13, fontWeight: '600', marginTop: 4 },
  privacyFooterBtn: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  privacyLink: { color: '#94a3b8', textAlign: 'center', fontSize: 12, textDecorationLine: 'underline' },
});