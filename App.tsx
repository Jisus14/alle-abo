import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
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

type Cycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

interface Subscription {
  id: number;
  name: string;
  price: number;
  cycle: Cycle;
  renewalDate: string; // YYYY-MM-DD
  noticeDays: number;
  canceled: number; // 0 = active, 1 = canceled
  notificationId: string | null;
  calendarEventId: string | null;
}

const CHANNEL_ID = 'alle-abo-reminders';
const db = SQLite.openDatabaseSync('alleabo.db');

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

function AlleAboScreen() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [renewalDate, setRenewalDate] = useState(defaultRenewalDate());
  const [noticeDays, setNoticeDays] = useState('14');
  const [syncCalendar, setSyncCalendar] = useState(true);

  useEffect(() => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    loadSubscriptions();
    setupNotifications();
  }, []);

  function loadSubscriptions() {
    const rows = db.getAllSync<Subscription>(
      'SELECT * FROM subscriptions ORDER BY canceled ASC, id DESC;'
    );
    setSubs(rows);
  }

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

    db.runSync(
      `INSERT INTO subscriptions (name, price, cycle, renewalDate, noticeDays, canceled, notificationId, calendarEventId)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?);`,
      [name.trim(), parsedPrice, cycle, renewalDate, parsedNotice, notificationId, calendarEventId]
    );

    setName('');
    setPrice('');
    loadSubscriptions();
  }

  async function toggleCanceled(sub: Subscription) {
    const nextCanceled = sub.canceled ? 0 : 1;
    if (nextCanceled === 1) {
      if (sub.notificationId) {
        await Notifications.cancelScheduledNotificationAsync(sub.notificationId);
      }
      await deleteCalendarEvent(sub.calendarEventId);
      db.runSync(
        'UPDATE subscriptions SET canceled = 1, notificationId = NULL, calendarEventId = NULL WHERE id = ?;',
        [sub.id]
      );
    } else {
      db.runSync('UPDATE subscriptions SET canceled = 0 WHERE id = ?;', [sub.id]);
    }
    loadSubscriptions();
  }

  async function removeSubscription(sub: Subscription) {
    if (sub.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(sub.notificationId);
    }
    await deleteCalendarEvent(sub.calendarEventId);
    db.runSync('DELETE FROM subscriptions WHERE id = ?;', [sub.id]);
    loadSubscriptions();
  }

  const activeSubs = subs.filter((s) => s.canceled === 0);
  const totalMonthly = activeSubs.reduce((sum, s) => sum + getMonthlyCost(s.price, s.cycle), 0);
  const totalYearly = totalMonthly * 12;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.title}>Alle Abo</Text>
        <TouchableOpacity style={styles.testBtn} onPress={sendTestNotification}>
          <Text style={styles.testBtnText}>Test Alert (5s)</Text>
        </TouchableOpacity>
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
        keyExtractor={(item) => String(item.id)}
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
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AlleAboScreen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', paddingHorizontal: 16, paddingTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 26, fontWeight: '700', color: '#f8fafc' },
  testBtn: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
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
});