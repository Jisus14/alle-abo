import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Crypto from 'expo-crypto';
import { User } from 'firebase/auth';
import {
  Cycle,
  Subscription,
  deleteAccountCompletely,
  deleteCloudSubscription,
  fetchCloudSubscriptions,
  logoutUser,
  upsertCloudSubscription,
} from '../firebase';
import {
  daysUntil,
  defaultRenewalDate,
  getDeadlineDate,
  getMonthlyCost,
  mapFirebaseError,
} from '../utils/subscriptionMath';
import {
  clearLocalSubscriptionsForUser,
  deleteLocalSubscription,
  getLocalSubscriptions,
  setLocalSubscriptionCanceled,
  upsertLocalSubscription,
} from '../services/localDb';
import { deleteCalendarEvent, injectCalendarEvent } from '../services/calendar';
import {
  cancelScheduledNotification,
  scheduleDeadlineNotification,
  scheduleTestNotification,
  setupNotifications,
} from '../services/notifications';
import { DatePickerModal } from '../components/DatePickerModal';
import { AccountModal } from '../components/AccountModal';

interface Props {
  user: User;
  onOpenPrivacy: () => void;
}

export function DashboardScreen({ user, onOpenPrivacy }: Props) {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [renewalDate, setRenewalDate] = useState(defaultRenewalDate());
  const [noticeDays, setNoticeDays] = useState('14');
  const [syncCalendar, setSyncCalendar] = useState(true);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncNote, setSyncNote] = useState('');

  useEffect(() => {
    loadLocalSubscriptions();
    syncFromCloud();
    setupNotifications();
  }, [user.uid]);

  function loadLocalSubscriptions() {
    setSubs(getLocalSubscriptions(user.uid));
  }

  async function syncFromCloud() {
    try {
      setSyncNote('Syncing...');
      const cloudSubs = await fetchCloudSubscriptions(user.uid);
      const localMap = new Map(getLocalSubscriptions(user.uid).map((r) => [r.id, r]));

      for (const item of cloudSubs) {
        const existing = localMap.get(item.id);
        upsertLocalSubscription({
          ...item,
          userId: user.uid,
          notificationId: existing?.notificationId ?? null,
          calendarEventId: existing?.calendarEventId ?? null,
        });
      }
      loadLocalSubscriptions();
      setSyncNote('Synced (EU Cloud)');
    } catch {
      setSyncNote('Offline Mode (Cached)');
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
      Alert.alert('Invalid date', 'Select a valid renewal date.');
      return;
    }

    const notificationId = await scheduleDeadlineNotification(name.trim(), deadline);
    const calendarEventId = syncCalendar
      ? await injectCalendarEvent(name.trim(), deadline, parsedPrice)
      : null;

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

    upsertLocalSubscription(newSub);
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
      await cancelScheduledNotification(sub.notificationId);
      await deleteCalendarEvent(sub.calendarEventId);
      updatedSub = { ...updatedSub, notificationId: null, calendarEventId: null };
    }

    setLocalSubscriptionCanceled(sub.id, nextCanceled);
    loadLocalSubscriptions();

    try {
      await upsertCloudSubscription(updatedSub);
    } catch {
      setSyncNote('Saved Locally (Offline)');
    }
  }

  async function removeSubscription(sub: Subscription) {
    await cancelScheduledNotification(sub.notificationId);
    await deleteCalendarEvent(sub.calendarEventId);
    deleteLocalSubscription(sub.id);
    loadLocalSubscriptions();

    try {
      await deleteCloudSubscription(sub.id);
    } catch {
      setSyncNote('Deleted Locally (Offline)');
    }
  }

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

  async function handleDeleteAccount(password: string) {
    if (password.length < 6) {
      Alert.alert('Password Required', 'Enter your current password to confirm permanent deletion.');
      return;
    }
    setDeleting(true);
    try {
      for (const s of subs) {
        await cancelScheduledNotification(s.notificationId);
        await deleteCalendarEvent(s.calendarEventId);
      }
      await deleteAccountCompletely(user, password);
      clearLocalSubscriptionsForUser(user.uid);
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
          <TouchableOpacity style={styles.testBtn} onPress={scheduleTestNotification}>
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
          <TouchableOpacity
            style={[styles.input, styles.dateBtn, { flex: 1.5 }]}
            onPress={() => setDatePickerOpen(true)}
          >
            <Text style={styles.dateBtnText}>Renewal: {renewalDate}</Text>
          </TouchableOpacity>
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

      <DatePickerModal
        visible={datePickerOpen}
        value={renewalDate}
        title="Select Renewal Date"
        onSelect={setRenewalDate}
        onClose={() => setDatePickerOpen(false)}
      />

      <AccountModal
        visible={accountModalOpen}
        email={user.email}
        deleting={deleting}
        onOpenPrivacy={onOpenPrivacy}
        onExportCsv={handleExportCsv}
        onLogout={logoutUser}
        onDeleteAccount={handleDeleteAccount}
        onClose={() => setAccountModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', paddingHorizontal: 16, paddingTop: 12 },
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
  dateBtn: { justifyContent: 'center' },
  dateBtnText: { color: '#f8fafc', fontSize: 14 },
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