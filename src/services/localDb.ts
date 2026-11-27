import * as SQLite from 'expo-sqlite';
import { Subscription } from '../firebase';

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

export function getLocalSubscriptions(userId: string): Subscription[] {
  return db.getAllSync<Subscription>(
    'SELECT * FROM subscriptions_v2 WHERE userId = ? ORDER BY canceled ASC, name ASC;',
    [userId]
  );
}

export function upsertLocalSubscription(sub: Subscription): void {
  db.runSync(
    `INSERT OR REPLACE INTO subscriptions_v2
     (id, userId, name, price, cycle, renewalDate, noticeDays, canceled, notificationId, calendarEventId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      sub.id,
      sub.userId,
      sub.name,
      sub.price,
      sub.cycle,
      sub.renewalDate,
      sub.noticeDays,
      sub.canceled,
      sub.notificationId,
      sub.calendarEventId,
    ]
  );
}

export function setLocalSubscriptionCanceled(id: string, canceled: number): void {
  if (canceled === 1) {
    db.runSync(
      'UPDATE subscriptions_v2 SET canceled = 1, notificationId = NULL, calendarEventId = NULL WHERE id = ?;',
      [id]
    );
  } else {
    db.runSync('UPDATE subscriptions_v2 SET canceled = 0 WHERE id = ?;', [id]);
  }
}

export function deleteLocalSubscription(id: string): void {
  db.runSync('DELETE FROM subscriptions_v2 WHERE id = ?;', [id]);
}

export function clearLocalSubscriptionsForUser(userId: string): void {
  db.runSync('DELETE FROM subscriptions_v2 WHERE userId = ?;', [userId]);
}