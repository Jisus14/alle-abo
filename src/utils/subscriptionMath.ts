import { Cycle } from '../firebase';

export function defaultRenewalDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

export function getMonthlyCost(price: number, cycle: Cycle): number {
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

export function getDeadlineDate(renewalDate: string, noticeDays: number): Date {
  const d = new Date(`${renewalDate}T09:00:00`);
  d.setDate(d.getDate() - noticeDays);
  return d;
}

export function daysUntil(date: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((date.getTime() - Date.now()) / msPerDay);
}

export function mapFirebaseError(err: unknown): string {
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