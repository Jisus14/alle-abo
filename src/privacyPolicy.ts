export const PRIVACY_POLICY_TEXT = `Alle Abo – Privacy Policy (GDPR / DSGVO)
Version 1.0

1. Controller
Alle Abo Student Project Team (Software Engineering, Hochschule Campus Wien).

2. Data We Collect & Process
• Account Data: Email address and authentication UID. Passwords are never stored in plaintext; Firebase Authentication hashes passwords server-side using salted scrypt over encrypted HTTPS/TLS connections.
• Subscription Data: Contract names, Euro prices, billing cycles, renewal dates, notice periods, and cancellation status that you enter manually.
• Device Permissions (Optional): Local notifications and native calendar access are used solely on your device to schedule deadline alerts and inject calendar events.

3. Storage Location (EU/EEA)
All cloud-synced subscription and account records are stored on servers located inside the European Union (Google Cloud Firestore, region europe-west3 / Frankfurt). A local offline copy is stored in SQLite on your device.

4. No Third-Party Tracking or Advertising
Alle Abo contains no advertising SDKs, analytics trackers, or profiling tools. Your data is never sold or shared with third parties for marketing purposes.

5. Your Rights Under GDPR (Art. 15–20)
• Right of Access & Portability (Art. 15 & 20): Export all your stored subscriptions anytime as CSV via Account → Export Data (CSV).
• Right to Rectification (Art. 16): Edit or update any subscription entry directly in the app.
• Right to Erasure (Art. 17): Permanently delete your account and all cloud + local records anytime via Account → Delete Account & All Data.
• Right to Withdraw Consent (Art. 7): Deleting your account immediately revokes consent and stops all data processing.`;