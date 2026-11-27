import { Alert, Platform } from 'react-native';
import * as Calendar from 'expo-calendar';

export async function injectCalendarEvent(
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

export async function deleteCalendarEvent(eventId: string | null): Promise<void> {
  if (!eventId) return;
  try {
    const event = await Calendar.ExpoCalendarEvent.get(eventId);
    await event.delete();
  } catch {}
}