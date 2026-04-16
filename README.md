# Insight Board

Expo Router app for the Speer Health frontend assignment. Includes a four-stage insight pipeline board, detail/form workflow, analytics dashboard, and a setup screen for the live Supabase/Apollo integration.

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- For iOS builds: Xcode 15+ and CocoaPods
- For Android builds: Android Studio with an SDK configured

## Env setup

Copy `.env.example` to `.env` and fill in your Supabase project values:

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

The derived GraphQL endpoint is `${EXPO_PUBLIC_SUPABASE_URL}/graphql/v1`, exposed from `lib/env.ts`.

### Demo account passwords

The Setup screen includes quick-sign-in buttons for the two seeded demo accounts. The email addresses are pre-set (`alice@test.com`, `bob@test.com`) but **passwords are not committed** — open `components/providers/backend-provider.tsx` and fill in the `password` field for each account:

```ts
const demoAccounts: DemoAccount[] = [
  {
    label: "Alice demo",
    email: "alice@test.com",
    password: "<alice-password>",
  },
  { label: "Bob demo", email: "bob@test.com", password: "<bob-password>" },
];
```

The analytics screen also expects the `public.get_insight_analytics(integer)` SQL function documented in `InsightBoard_Setup_Guide_full_fidelity.md`.

## Running the app

Install dependencies first:

```bash
npm install
```

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run start`     | Start the Metro bundler (Expo Go)   |
| `npm run ios`       | Run on iOS simulator via Expo Go    |
| `npm run android`   | Run on Android emulator via Expo Go |
| `npm run web`       | Run in browser                      |
| `npm run lint`      | ESLint                              |
| `npm run typecheck` | TypeScript type check               |
| `npm test`          | Jest unit tests                     |

> **Note:** Expo Go supports most features but does not run custom native modules. See below for the development build required to test speech-to-text.

## Development build — speech-to-text

Speech recognition (`expo-speech-recognition`) is a custom native module that **cannot run inside Expo Go**. A native development build is required.

### iOS

```bash
# 1. Generate native project files
npx expo prebuild --clean

# 2. Install CocoaPods
cd ios && pod install && cd ..

# 3. Build and run (simulator or connected device)
npx expo run:ios
```

> **Real device recommended.** On-device speech recognition works fully; the iOS simulator has limited microphone support and may not produce transcripts. Connect a physical iPhone and select it as the run target in Xcode or via `--device`.

Permissions are already declared in `app.json`:

- `NSSpeechRecognitionUsageDescription`
- `NSMicrophoneUsageDescription`

### Android

```bash
# 1. Generate native project files (skip if already done)
npx expo prebuild --clean

# 2. Build and run on emulator or connected device
npx expo run:android
```

The `android.permission.RECORD_AUDIO` permission is already declared in `app.json`. An emulator with a working microphone input works for basic testing; a real device gives better recognition accuracy.

### Testing the hook in isolation

```bash
npm test -- hooks/use-speech-recognition
```

The test suite (`__tests__/hooks/use-speech-recognition.test.ts`) mocks the native module so it runs without a device.

## Routes

| Route                      | Description                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `app/(tabs)/index.tsx`     | Insight Pipeline Board — list/overview modes, filters, activity feed, detail sheet, create/edit form |
| `app/(tabs)/analytics.tsx` | KPI dashboard, funnel, trend, distribution, heatmap, leaderboard, PDF export                         |
| `app/(tabs)/setup.tsx`     | Supabase/Apollo/env setup status and demo account sign-in                                            |

## Key files

| File                                              | Purpose                                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `components/providers/insight-board-provider.tsx` | Shared board state — paged stage reads, stage counts, activity, Realtime signals |
| `components/providers/backend-provider.tsx`       | Supabase auth session and demo account credentials                               |
| `lib/insight-board-schema.ts`                     | Shared domain types and reference constants                                      |
| `lib/services/apollo.ts`                          | Apollo client wired to the Supabase GraphQL endpoint                             |
| `lib/services/insight-board-graphql.ts`           | GraphQL documents for board reads and mutations                                  |
| `lib/services/insight-board-data.ts`              | Server-filtered stage paging, hydration, and count helpers                       |
| `lib/services/insight-board-analytics.ts`         | Analytics summary RPC and export helpers                                         |
| `lib/services/openfda.ts`                         | Cached OpenFDA label and adverse-event lookups                                   |
| `lib/insight-utils.ts`                            | Filtering, stage transitions, and relative-time helpers                          |
| `lib/services/report-export.ts`                   | HTML-to-PDF report export                                                        |
| `constants/theme.ts`                              | Material 3 palette anchored to the Speer brand colors                            |
| `hooks/use-speech-recognition.ts`                 | Speech recognition hook wrapping `expo-speech-recognition`                       |

## Live integration status

| Feature                                              | Status                                      |
| ---------------------------------------------------- | ------------------------------------------- |
| Stage-scoped insight loading with pagination         | ✅                                          |
| Supabase GraphQL reads and mutations                 | ✅                                          |
| Supabase Realtime subscriptions and presence signals | ✅                                          |
| OpenFDA label and adverse-event lookups              | ✅                                          |
| Analytics with PDF export                            | ✅                                          |
| Native speech recognition                            | ✅ (requires development build — see above) |

See `ARCHITECTURE.md` for the full frontend structure and data flow.
