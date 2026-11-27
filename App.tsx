import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Calendar from 'expo-calendar';
import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  Cycle,
  Subscription,
  auth,
  deleteAccountCompletely,
  deleteCloudSubscription,
  fetchCloudSubscriptions,
  loginUser,
  logoutUser,
  registerUser,
  resetPassword,
  upsertCloudSubscription,
} from './src/firebase';
import { PRIVACY_POLICY_TEXT } from './src/privacyPolicy';

const CHANNEL_ID = 'alle-abo-reminders';
const db = SQLite.openDatabaseSync('alleabo.db');

db.execSync(`
  CREATE TABLE IF NOT EXISTS subscriptions_v2 (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    cycle TEXT NOT NULL,
    renewalDate TEXT NOT NULL,
    noticeDays INTEGER NOT NULL,
    canceled INTEGER NOT NULL DEFAULT 0,
    notificationId TEXT,
    calendarEventId TEXT
  );
`);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function defaultRenewalDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

function getMonthlyCost(price: number, cycle: Cycle): number {
  switch (cycle) {
    case 'weekly':
      return (price * 52) / 12;
    case 'monthly':
      return price;
    case 'quarterly':
      return price / 3;
    case 'yearly':
      return price / 12;
  }
}

function getDeadlineDate(renewalDate: string, noticeDays: number): Date {
  const d = new Date(`${renewalDate}T09:00:00`);
  d.setDate(d.getDate() - noticeDays);
  return d;
}

function daysUntil(date: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((date.getTime() - Date.now()) / msPerDay);
}

function mapFirebaseError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('auth/invalid-email')) return 'Please enter a valid email address.';
  if (msg.includes('auth/email-already-in-use')) return 'An account with this email already exists.';
  if (msg.includes('auth/weak-password')) return 'Password must be at least 6 characters long.';
  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
    return 'Incorrect email or password.';
  }
  if (msg.includes('auth/too-many-requests')) return 'Too many attempts. Try again later.';
  return msg;
}

function PrivacyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Privacy Policy (GDPR / DSGVO)</Text>
          <ScrollView style={styles.modalScroll}>
            <Text style={styles.policyText}>{PRIVACY_POLICY_TEXT}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
            <Text style={styles.primaryBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function AuthScreen({ onOpenPrivacy }: { onOpenPrivacy: () => void }) {
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
    <SafeAreaView style={styles.authContainer} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.authBox}>
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
            <Text style={[styles.switchLabel, { flex: 1, marginRight: 10 }]}>
              I consent to data processing as described in the GDPR Privacy Policy.
            </Text>
            <Switch value={gdprAccepted} onValueChange={setGdprAccepted} />
          </View>
        )}

        <TouchableOpacity
          style={[styles.addBtn, busy && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#052e16" />
          ) : (
            <Text style={styles.addBtnText}>{isRegister ? 'Register' : 'Log In'}</Text>
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

function DashboardScreen({
  user,
  onOpenPrivacy,
}: {
  user: User;
  onOpenPrivacy: () => void;
}) {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [renewalDate, setRenewalDate] = useState(defaultRenewalDate());
  const [noticeDays, setNoticeDays] = useState('14');
  const [syncCalendar, setSyncCalendar] = useState(true);

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [syncNote, setSyncNote] = useState<string>('');

  useEffect(() => {
    loadLocalSubscriptions();
    syncFromCloud();
    setupNotifications();
  }, [user.uid]);

  function loadLocalSubscriptions() {
    const rows = db.getAllSync<Subscription>(
      'SELECT * FROM subscriptions_v2 WHERE userId = ? ORDER BY canceled ASC, name ASC;',
      [user.uid]
    );
    setSubs(rows);
  }

  async function syncFromCloud() {
    try {
      setSyncNote('Syncing...');
      const cloudSubs = await fetchCloudSubscriptions(user.uid);
      const localRows = db.getAllSync<Subscription>(
        'SELECT * FROM subscriptions_v2 WHERE userId = ?;',
        [user.uid]
      );
      const localMap = new Map(localRows.map((r) => [r.id, r]));

      for (const item of cloudSubs) {
        const existing = localMap.get(item.id);
        db.runSync(
          `INSERT OR REPLACE INTO subscriptions_v2
           (id, userId, name, price, cycle, renewalDate, noticeDays, canceled, notificationId, calendarEventId)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            item.id,
            user.uid,
            item.name,
            item.price,
            item.cycle,
            item.renewalDate,
            item.noticeDays,
            item.canceled,
            existing?.notificationId ?? null,
            existing?.calendarEventId ?? null,
          ]
        );
      }
      loadLocalSubscriptions();
      setSyncNote('Synced (EU Cloud)');
    } catch {
      // NFR-05: Stay crash-free offline and keep showing cached SQLite data
      setSyncNote('Offline Mode (Cached)');
    }
  }

  const CHANNEL_ID = 'alle-abo-reminders-v2';
  async function setupNotifications(): Promise<boolean> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Subscription Reminders',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  async function sendTestNotification() {
    const granted = await setupNotifications();
    if (!granted) {
      Alert.alert('Permission needed', 'Enable notification permissions in phone settings.');
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Alle Abo Reminder',
        body: 'Test alert: Your Netflix cancellation deadline is in 7 days!',
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        channelId: CHANNEL_ID,
      },
    });
    Alert.alert('Scheduled', 'Notification will fire in 5 seconds. Lock your screen to test it.');
  }

  async function injectCalendarEvent(
    subName: string,
    deadline: Date,
    subPrice: number
  ): Promise<string | null> {
    try {
      const { status } = await Calendar.requestCalendarPermissions();
      if (status !== 'granted') {
        Alert.alert('Calendar skipped', 'Calendar permission was denied.');
        return null;
      }

      let targetCalendar: Calendar.ExpoCalendar | undefined;
      if (Platform.OS === 'ios') {
        targetCalendar = Calendar.getDefaultCalendarSync();
      } else {
        const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
        targetCalendar =
          calendars.find((c) => c.allowsModifications && c.isPrimary) ??
          calendars.find((c) => c.allowsModifications);
      }

      if (!targetCalendar) {
        Alert.alert('No writable calendar', 'Could not find a local or Google calendar to write to.');
        return null;
      }

      const endDate = new Date(deadline.getTime() + 60 * 60 * 1000);
      const event = await targetCalendar.createEvent({
        title: `Cancel ${subName} (€${subPrice.toFixed(2)})`,
        startDate: deadline,
        endDate,
        notes: 'Automatically added by Alle Abo.',
      });
      return event.id;
    } catch (err) {
      Alert.alert('Calendar Error', String(err));
      return null;
    }
  }

  async function deleteCalendarEvent(eventId: string | null) {
    if (!eventId) return;
    try {
      const event = await Calendar.ExpoCalendarEvent.get(eventId);
      await event.delete();
    } catch {
      // Event may have been deleted manually by the user
    }
  }

  async function addSubscription() {
    const parsedPrice = parseFloat(price.replace(',', '.'));
    const parsedNotice = parseInt(noticeDays, 10) || 0;

    if (!name.trim() || isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Invalid input', 'Enter a subscription name and valid price in €.');
      return;
    }

    const deadline = getDeadlineDate(renewalDate, parsedNotice);
    if (isNaN(deadline.getTime())) {
      Alert.alert('Invalid date', 'Use format YYYY-MM-DD (e.g. 2026-12-31).');
      return;
    }

    let notificationId: string | null = null;
    const reminderDate = new Date(deadline.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (reminderDate.getTime() > Date.now() && (await setupNotifications())) {
      notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Cancel ${name.trim()} soon`,
          body: `Cancellation deadline is ${deadline.toISOString().split('T')[0]}.`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
          channelId: CHANNEL_ID,
        },
      });
    }

    let calendarEventId: string | null = null;
    if (syncCalendar) {
      calendarEventId = await injectCalendarEvent(name.trim(), deadline, parsedPrice);
    }

    const newSub: Subscription = {
      id: Crypto.randomUUID(),
      userId: user.uid,
      name: name.trim(),
      price: parsedPrice,
      cycle,
      renewalDate,
      noticeDays: parsedNotice,
      canceled: 0,
      notificationId,
      calendarEventId,
    };

    db.runSync(
      `INSERT INTO subscriptions_v2
       (id, userId, name, price, cycle, renewalDate, noticeDays, canceled, notificationId, calendarEventId)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?);`,
      [
        newSub.id,
        newSub.userId,
        newSub.name,
        newSub.price,
        newSub.cycle,
        newSub.renewalDate,
        newSub.noticeDays,
        newSub.notificationId,
        newSub.calendarEventId,
      ]
    );

    setName('');
    setPrice('');
    loadLocalSubscriptions();

    try {
      await upsertCloudSubscription(newSub);
      setSyncNote('Synced (EU Cloud)');
    } catch {
      setSyncNote('Saved Locally (Offline)');
    }
  }

  async function toggleCanceled(sub: Subscription) {
    const nextCanceled = sub.canceled ? 0 : 1;
    let updatedSub: Subscription = { ...sub, canceled: nextCanceled };

    if (nextCanceled === 1) {
      if (sub.notificationId) {
        await Notifications.cancelScheduledNotificationAsync(sub.notificationId);
      }
      await deleteCalendarEvent(sub.calendarEventId);
      updatedSub = { ...updatedSub, notificationId: null, calendarEventId: null };
      db.runSync(
        'UPDATE subscriptions_v2 SET canceled = 1, notificationId = NULL, calendarEventId = NULL WHERE id = ?;',
        [sub.id]
      );
    } else {
      db.runSync('UPDATE subscriptions_v2 SET canceled = 0 WHERE id = ?;', [sub.id]);
    }
    loadLocalSubscriptions();

    try {
      await upsertCloudSubscription(updatedSub);
    } catch {
      setSyncNote('Saved Locally (Offline)');
    }
  }

  async function removeSubscription(sub: Subscription) {
    if (sub.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(sub.notificationId);
    }
    await deleteCalendarEvent(sub.calendarEventId);
    db.runSync('DELETE FROM subscriptions_v2 WHERE id = ?;', [sub.id]);
    loadLocalSubscriptions();

    try {
      await deleteCloudSubscription(sub.id);
    } catch {
      setSyncNote('Deleted Locally (Offline)');
    }
  }

  // FR-30 + GDPR Art. 20: Export user data as CSV
  async function handleExportCsv() {
    const header = 'Name,Price_EUR,Cycle,RenewalDate,NoticeDays,Status';
    const lines = subs.map((s) => {
      const safeName = `"${s.name.replace(/"/g, '""')}"`;
      const status = s.canceled ? 'Canceled' : 'Active';
      return `${safeName},${s.price.toFixed(2)},${s.cycle},${s.renewalDate},${s.noticeDays},${status}`;
    });
    const csv = [header, ...lines].join('\n');
    await Share.share({ title: 'alle-abo-export.csv', message: csv });
  }

  // FR-04 + GDPR Art. 17: Wipe local alerts, calendar events, SQLite, Firestore, and Firebase Auth user
  async function handleDeleteAccount() {
    if (deletePassword.length < 6) {
      Alert.alert('Password Required', 'Enter your current password to confirm permanent deletion.');
      return;
    }
    setDeleting(true);
    try {
      for (const s of subs) {
        if (s.notificationId) {
          await Notifications.cancelScheduledNotificationAsync(s.notificationId);
        }
        await deleteCalendarEvent(s.calendarEventId);
      }
      await deleteAccountCompletely(user, deletePassword);
      db.runSync('DELETE FROM subscriptions_v2 WHERE userId = ?;', [user.uid]);
      setAccountModalOpen(false);
      Alert.alert('Account Deleted', 'Your account and all stored data have been permanently erased.');
    } catch (err) {
      Alert.alert('Deletion Failed', mapFirebaseError(err));
    } finally {
      setDeleting(false);
    }
  }

  const activeSubs = subs.filter((s) => s.canceled === 0);
  const totalMonthly = activeSubs.reduce((sum, s) => sum + getMonthlyCost(s.price, s.cycle), 0);
  const totalYearly = totalMonthly * 12;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Alle Abo</Text>
          <Text style={styles.syncBadge}>{syncNote || user.email}</Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.testBtn} onPress={sendTestNotification}>
            <Text style={styles.testBtnText}>Test 5s</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.accountBtn} onPress={() => setAccountModalOpen(true)}>
            <Text style={styles.testBtnText}>Account</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Monthly Total</Text>
          <Text style={styles.summaryValue}>€{totalMonthly.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Annual Total</Text>
          <Text style={styles.summaryValue}>€{totalYearly.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.form}>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="Name (e.g. Spotify)"
            placeholderTextColor="#888"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Price €"
            placeholderTextColor="#888"
            keyboardType="decimal-pad"
            value={price}
            onChangeText={setPrice}
          />
        </View>

        <View style={styles.cycleRow}>
          {(['weekly', 'monthly', 'quarterly', 'yearly'] as Cycle[]).map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, cycle === c && styles.chipActive]}
              onPress={() => setCycle(c)}
            >
              <Text style={[styles.chipText, cycle === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1.5 }]}
            placeholder="Renewal YYYY-MM-DD"
            placeholderTextColor="#888"
            value={renewalDate}
            onChangeText={setRenewalDate}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Notice days"
            placeholderTextColor="#888"
            keyboardType="number-pad"
            value={noticeDays}
            onChangeText={setNoticeDays}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Inject deadline into device calendar</Text>
          <Switch value={syncCalendar} onValueChange={setSyncCalendar} />
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={addSubscription}>
          <Text style={styles.addBtnText}>+ Add Subscription</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={subs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={<Text style={styles.empty}>No subscriptions yet.</Text>}
        renderItem={({ item }) => {
          const deadline = getDeadlineDate(item.renewalDate, item.noticeDays);
          const remaining = daysUntil(deadline);
          const isUrgent = item.canceled === 0 && remaining <= 14;

          return (
            <View
              style={[
                styles.card,
                isUrgent && styles.cardUrgent,
                item.canceled === 1 && styles.cardCanceled,
              ]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardName}>
                  {item.name} {item.canceled === 1 ? '(Canceled)' : ''}
                </Text>
                <Text style={styles.cardPrice}>
                  €{item.price.toFixed(2)} / {item.cycle}
                </Text>
              </View>
              <Text style={styles.cardMeta}>
                Cancel by: {deadline.toISOString().split('T')[0]} ({remaining}d)
                {item.calendarEventId ? ' • In Calendar' : ''}
              </Text>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => toggleCanceled(item)}>
                  <Text style={styles.actionLink}>
                    {item.canceled === 1 ? 'Reactivate' : 'Mark Canceled'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeSubscription(item)}>
                  <Text style={[styles.actionLink, { color: '#ef4444' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* Account & GDPR Modal (reachable in 1 tap from main screen) */}
      <Modal visible={accountModalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Account & GDPR</Text>
            <Text style={styles.accountEmail}>{user.email}</Text>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                setAccountModalOpen(false);
                onOpenPrivacy();
              }}
            >
              <Text style={styles.secondaryBtnText}>Privacy Policy (GDPR / DSGVO)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={handleExportCsv}>
              <Text style={styles.secondaryBtnText}>Export My Data (CSV – Art. 20)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={async () => {
                setAccountModalOpen(false);
                await logoutUser();
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
                onPress={handleDeleteAccount}
                disabled={deleting}
              >
                <Text style={styles.dangerBtnText}>
                  {deleting ? 'Deleting...' : 'Delete Account & All Data'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                setDeletePassword('');
                setAccountModalOpen(false);
              }}
            >
              <Text style={styles.primaryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [privacyVisible, setPrivacyVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <SafeAreaProvider>
      {authLoading ? (
        <View style={[styles.authContainer, { alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      ) : user ? (
        <DashboardScreen user={user} onOpenPrivacy={() => setPrivacyVisible(true)} />
      ) : (
        <AuthScreen onOpenPrivacy={() => setPrivacyVisible(true)} />
      )}
      <PrivacyModal visible={privacyVisible} onClose={() => setPrivacyVisible(false)} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', paddingHorizontal: 16, paddingTop: 12 },
  authContainer: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', padding: 20 },
  authBox: { backgroundColor: '#1e293b', padding: 20, borderRadius: 14, gap: 12 },
  subtitle: { color: '#94a3b8', fontSize: 14, marginBottom: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 26, fontWeight: '700', color: '#f8fafc' },
  syncBadge: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  testBtn: { backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  accountBtn: { backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  testBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  summaryBox: { flex: 1, backgroundColor: '#1e293b', padding: 12, borderRadius: 10 },
  summaryLabel: { color: '#94a3b8', fontSize: 12 },
  summaryValue: { color: '#38bdf8', fontSize: 20, fontWeight: '700', marginTop: 2 },
  form: { backgroundColor: '#1e293b', padding: 12, borderRadius: 12, marginBottom: 14, gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  input: { backgroundColor: '#0f172a', color: '#f8fafc', padding: 10, borderRadius: 8, fontSize: 14 },
  cycleRow: { flexDirection: 'row', gap: 6 },
  chip: { flex: 1, paddingVertical: 6, borderRadius: 6, backgroundColor: '#334155', alignItems: 'center' },
  chipActive: { backgroundColor: '#38bdf8' },
  chipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#0f172a' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { color: '#cbd5e1', fontSize: 13 },
  addBtn: { backgroundColor: '#22c55e', padding: 12, borderRadius: 8, alignItems: 'center' },
  addBtnText: { color: '#052e16', fontWeight: '700', fontSize: 15 },
  centerLink: { color: '#38bdf8', textAlign: 'center', fontSize: 13, fontWeight: '600', marginTop: 4 },
  privacyFooterBtn: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  privacyLink: { color: '#94a3b8', textAlign: 'center', fontSize: 12, textDecorationLine: 'underline' },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 24 },
  card: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#38bdf8',
  },
  cardUrgent: { borderLeftColor: '#ef4444' },
  cardCanceled: { opacity: 0.55, borderLeftColor: '#64748b' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardName: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  cardPrice: { color: '#38bdf8', fontSize: 15, fontWeight: '600' },
  cardMeta: { color: '#94a3b8', fontSize: 12, marginBottom: 8 },
  cardActions: { flexDirection: 'row', gap: 18 },
  actionLink: { color: '#60a5fa', fontSize: 13, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 18, gap: 10, maxHeight: '85%' },
  modalTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  modalScroll: { maxHeight: 340 },
  policyText: { color: '#cbd5e1', fontSize: 13, lineHeight: 20 },
  accountEmail: { color: '#38bdf8', fontSize: 13, marginBottom: 4 },
  primaryBtn: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { backgroundColor: '#334155', padding: 11, borderRadius: 8, alignItems: 'center' },
  secondaryBtnText: { color: '#f8fafc', fontWeight: '600', fontSize: 14 },
  dangerBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, gap: 8, borderWidth: 1, borderColor: '#7f1d1d' },
  dangerTitle: { color: '#f87171', fontWeight: '700', fontSize: 13 },
  dangerBtn: { backgroundColor: '#dc2626', padding: 11, borderRadius: 8, alignItems: 'center' },
  dangerBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});