import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const CHANNEL_ID = 'alle-abo-default';
export const VIBRATION_PATTERN = [0, 350, 200, 350];

const LEGACY_CHANNEL_IDS = [
  'alle-abo-reminders',
  'alle-abo-reminders-v2',
  'alle-abo-reminders-v3',
  'alle-abo-reminders-v4',
  'alle-abo-reminders-v5',
];

export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    for (const oldId of LEGACY_CHANNEL_IDS) {
      try {
        await Notifications.deleteNotificationChannelAsync(oldId);
      } catch {}
    }

    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      vibrationPattern: VIBRATION_PATTERN,
      showBadge: true,
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleTestNotification(): Promise<void> {
  const granted = await setupNotifications();
  if (!granted) {
    Alert.alert('Permission needed', 'Enable notification permissions in phone settings.');
    return;
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'This is a test notification',
      body: 'This is a test notification to verify that notifications are working correctly.',
      sound: true,
      vibrate: VIBRATION_PATTERN,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      sticky: true,
      autoDismiss: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: CHANNEL_ID,
    },
  });
  Alert.alert('Scheduled', 'Alert will fire in 5 seconds.');
}

export async function scheduleDeadlineNotification(
  subName: string,
  deadline: Date
): Promise<string | null> {
  const reminderDate = new Date(deadline.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (reminderDate.getTime() <= Date.now()) return null;
  if (!(await setupNotifications())) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `Cancel ${subName} soon`,
      body: `Cancellation deadline is ${deadline.toISOString().split('T')[0]}.`,
      sound: true,
      vibrate: VIBRATION_PATTERN,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      sticky: true,
      autoDismiss: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelScheduledNotification(notificationId: string | null): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {}
}