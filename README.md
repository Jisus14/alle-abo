# Alle Abo (`at.ac.hcw.alleabo`)

A cross-platform mobile subscription manager built with **React Native** and **Expo (SDK 58)** for the *Software Engineering* course at **Hochschule Campus Wien**.

**Alle Abo** centralizes recurring contracts, calculates normalized monthly and annual expenses in Euro (€), computes cancellation deadlines from contract renewal dates and notice periods, injects deadlines into the user's native device calendar, and schedules local push notifications before deadlines expire.

---

## Features

### Implemented (MVP)
- **Subscription Management (CRUD):** Add, view, mark as canceled, reactivate, and delete subscriptions with billing cycles (`weekly`, `monthly`, `quarterly`, `yearly`), renewal dates, and notice periods.
- **Cost & Deadline Engine:** Automatically converts mixed billing intervals into total monthly and annual Euro estimates and calculates exact cancellation deadlines (*Renewal Date − Notice Period*), visually highlighting contracts expiring within 14 days.
- **Native Calendar Injection (`expo-calendar`):** Automatically creates deadline events in the user's primary device calendar (Google Calendar / Apple Calendar) and removes them when a subscription is canceled or deleted.
- **Local Scheduled Notifications (`expo-notifications`):** Schedules reminders 7 days before cancellation deadlines and includes a 5-second test alert trigger.
- **Account & EU Cloud Sync (Firebase Auth + Firestore):** Email/password registration, login, password reset, and automatic cloud synchronization with an offline-first **SQLite (`expo-sqlite`)** cache.
- **GDPR / DSGVO Compliance:**
  - EU/EEA cloud hosting (`europe-west3`, Frankfurt) with strict per-user Firestore security rules.
  - Salted server-side password hashing via Firebase Authentication over HTTPS/TLS.
  - Mandatory GDPR consent on registration and an in-app Privacy Policy reachable within 1 tap.
  - **Right of Data Portability (Art. 20):** One-tap CSV export via the native share sheet.
  - **Right to Erasure (Art. 17):** Permanent deletion of the user account, Firestore records, local SQLite cache, scheduled notifications, and injected calendar events.

### Planned / In Progress
- **Spotify Web API Integration (OAuth 2.0 PKCE):** Connect a Spotify account via `expo-auth-session` and `expo-secure-store` to detect and sync active Spotify plans.
- **Categories, Sorting & Filtering:** Filter active subscriptions by category and sort by price, next payment date, or cancellation deadline.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | React Native + Expo SDK 58 (TypeScript) |
| **Local Storage & Offline Cache** | `expo-sqlite` |
| **Authentication & Cloud Database** | Firebase Authentication & Cloud Firestore (`europe-west3`) |
| **Device Integrations** | `expo-calendar`, `expo-notifications`, `expo-secure-store`, `expo-crypto` |
| **Build & Distribution** | Expo Application Services (EAS Build – Development Client) |

---

## Project Structure

```text
alle-abo/
├── App.tsx                 # Main UI, Auth/Dashboard flows, SQLite, Calendar & Notification logic
├── app.json                # Expo config (package ID at.ac.hcw.alleabo, URL scheme, native permissions)
├── eas.json                # EAS Build profiles (development APK & iOS simulator)
├── .env.example            # Template for required Firebase / Spotify public environment variables
└── src/
    ├── firebase.ts         # Firebase initialization, SQLite auth persistence, Firestore CRUD & GDPR erasure
    └── privacyPolicy.ts    # GDPR / DSGVO privacy policy text
```

---

## Getting Started

### 1. Prerequisites
- **Node.js** (LTS v24+ / v26+)
- **Git**
- **VS Code** (recommended)

### 2. Clone & Install
```bash
git clone [https://github.com/Jisus14/alle-abo.git](https://github.com/Jisus14/alle-abo.git)
cd alle-abo
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` in the project root and fill in the project's Firebase credentials (request the values from the team lead—never commit `.env` to Git):

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. Run on Device or Simulator

This project uses a custom **Expo Development Client** because native calendar and notification modules are compiled into the binary.

#### Android (Physical Device)
1. Install the shared team **Development APK** on your Android phone (enable *Install unknown apps* if prompted).
2. Start the Metro bundler on your PC (ensure PC and phone are on the same Wi-Fi):
   ```bash
   npx expo start --dev-client
   ```
   *(If a firewall or university Wi-Fi blocks local connections, use `npx expo start --dev-client --tunnel`.)*
3. Open **Alle Abo** on your phone and scan the QR code shown in the terminal.

#### macOS (iOS Simulator or Physical iPhone)
1. Install **Xcode** from the Mac App Store, open it once to install the iOS Simulator, and install CocoaPods (`brew install cocoapods`).
2. Build and launch locally:
   ```bash
   npx expo run:ios
   # Or for a USB-connected iPhone (sign with a free Apple ID in Xcode):
   npx expo run:ios --device
   ```

---

## Team Development Rules

1. **Branching & Pull Requests (`NFR-10`):** Never push directly to `main`. Create a feature branch (`git checkout -b feat/your-feature`), push your changes, and open a Pull Request for peer review before merging.
2. **Preserve Cloud Build Quota:** Do **not** run `eas build` unless a new native `expo-*` plugin or `app.json` native permission is added and approved by the team. Expo's free tier is capped at 15 Android and 15 iOS builds per month; all TypeScript/UI changes hot-reload automatically via `npx expo start --dev-client`.
3. **Secrets Hygiene:** Never commit `.env` or API keys to the repository.