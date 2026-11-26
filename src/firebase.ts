import { getApp, getApps, initializeApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import {
  EmailAuthProvider,
  User,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  initializeAuth,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import * as SQLite from 'expo-sqlite';

export type Cycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  price: number;
  cycle: Cycle;
  renewalDate: string; // YYYY-MM-DD
  noticeDays: number;
  canceled: number; // 0 = active, 1 = canceled
  notificationId: string | null;
  calendarEventId: string | null;
}

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Persist Firebase Auth session using expo-sqlite (already built into the Dev APK)
const authDb = SQLite.openDatabaseSync('alleabo_auth.db');
authDb.execSync(`
  CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
`);

const sqlitePersistenceStorage = {
  async getItem(key: string): Promise<string | null> {
    const row = authDb.getFirstSync<{ value: string }>(
      'SELECT value FROM kv_store WHERE key = ?;',
      [key]
    );
    return row ? row.value : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    authDb.runSync(
      'INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?);',
      [key, value]
    );
  },
  async removeItem(key: string): Promise<void> {
    authDb.runSync('DELETE FROM kv_store WHERE key = ?;', [key]);
  },
};

function createAuthInstance() {
  const getRNPersistence = (firebaseAuth as Record<string, unknown>)
    .getReactNativePersistence as
    | ((storage: typeof sqlitePersistenceStorage) => firebaseAuth.Persistence)
    | undefined;

  if (typeof getRNPersistence === 'function') {
    try {
      return initializeAuth(app, {
        persistence: getRNPersistence(sqlitePersistenceStorage),
      });
    } catch {
      // Already initialized during Fast Refresh
      return getAuth(app);
    }
  }
  return getAuth(app);
}

export const auth = createAuthInstance();
export const firestore = getFirestore(app);

// FR-01: Register + record GDPR consent timestamp
export async function registerUser(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await setDoc(doc(firestore, 'users', cred.user.uid), {
    email: cred.user.email,
    gdprConsentVersion: '1.0',
    gdprConsentAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  return cred.user;
}

// FR-02: Login
export async function loginUser(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

// FR-03: Password Reset
export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email.trim());
}

// Logout
export async function logoutUser() {
  await signOut(auth);
}

// FR-29: Push single subscription to EU Firestore
export async function upsertCloudSubscription(sub: Subscription) {
  const user = auth.currentUser;
  if (!user) return;
  await setDoc(doc(firestore, 'users', user.uid, 'subscriptions', sub.id), {
    id: sub.id,
    name: sub.name,
    price: sub.price,
    cycle: sub.cycle,
    renewalDate: sub.renewalDate,
    noticeDays: sub.noticeDays,
    canceled: sub.canceled,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCloudSubscription(subId: string) {
  const user = auth.currentUser;
  if (!user) return;
  await deleteDoc(doc(firestore, 'users', user.uid, 'subscriptions', subId));
}

// FR-29: Fetch all subscriptions for the logged-in user
export async function fetchCloudSubscriptions(userId: string): Promise<Subscription[]> {
  const snap = await getDocs(collection(firestore, 'users', userId, 'subscriptions'));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId,
      name: String(data.name ?? ''),
      price: Number(data.price ?? 0),
      cycle: (data.cycle as Cycle) ?? 'monthly',
      renewalDate: String(data.renewalDate ?? ''),
      noticeDays: Number(data.noticeDays ?? 0),
      canceled: Number(data.canceled ?? 0),
      notificationId: null,
      calendarEventId: null,
    };
  });
}

// FR-04 + GDPR Art. 17: Re-authenticate and permanently delete all user data + account
export async function deleteAccountCompletely(user: User, currentPassword: string) {
  if (!user.email) throw new Error('Account has no email address.');

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);

  const subSnap = await getDocs(collection(firestore, 'users', user.uid, 'subscriptions'));
  await Promise.all(subSnap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(firestore, 'users', user.uid));
  await deleteUser(user);
}