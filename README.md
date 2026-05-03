# LiftLog

Mobile-first resistance training tracker. React + Vite + Firebase Auth + Firestore.

## Setup — start to finish, ~20 min

### 1. Firebase console (browser, no code)

Go to https://console.firebase.google.com.

1. **Add project** → name it `liftlog` (or whatever) → disable Google Analytics → Create.
2. **Add a web app** (the `</>` icon on the overview page). Nickname `liftlog-web`. Skip "Firebase Hosting" — we'll do that later. Copy the `firebaseConfig` block it shows you. Keep it open or paste it somewhere.
3. **Build → Authentication → Get started.** Enable **Email/Password** and **Google** (set yourself as the support email for Google).
4. **Build → Firestore Database → Create database.** Pick a region near you (e.g. `us-east1`). Start in **test mode** — we'll lock it down with the rules in this repo before going live.

### 2. Local setup

In a terminal, from this project folder:

```bash
npm install
cp .env.example .env.local
```

Open `.env.local` and paste in the values from your `firebaseConfig`:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=liftlog-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=liftlog-xxxxx
VITE_FIREBASE_STORAGE_BUCKET=liftlog-xxxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Then run:

```bash
npm run dev
```

Open the URL it prints (usually http://localhost:5173). Sign up, log a set, confirm it shows up. You're live locally.

### 3. Lock down security rules (before sharing the URL)

Install the Firebase CLI and deploy the rules in this repo:

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # pick your project
firebase deploy --only firestore:rules
```

This replaces the open "test mode" rules with the proper ones in `firestore.rules`: each user can only read/write sets they own.

### 4. Deploy to Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

You'll get a URL like `https://liftlog-xxxxx.web.app`. That's your live app.

### 5. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
```

Create a new repo on github.com (don't initialize it with anything), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/liftlog.git
git branch -M main
git push -u origin main
```

`.env.local` is gitignored, so your Firebase keys stay out of the repo. (They're not really secrets, but it's cleaner.)

## File map

```
src/
├── main.jsx        # React entry
├── App.jsx         # Auth gate: shows Login or LiftLog based on signed-in state
├── Login.jsx       # Email/password + Google sign-in
├── LiftLog.jsx     # Main app — log/history/progress views, all Firestore-backed
├── firebase.js     # Firebase init, exports auth + db
└── index.css       # Tailwind + custom font classes

firestore.rules     # Security rules (deployed via firebase CLI)
firebase.json       # Firebase project config
.env.example        # Template — copy to .env.local and fill in
```

## Data model

Single Firestore collection `setLogs`. Each document is one set:

```js
{
  userId: string,        // owner — security rule enforces match
  loggedAt: Timestamp,   // when this set was logged
  exercise: string,      // one of 9 exercises
  setNumber: number,     // 1-indexed within exercise+day
  weight: number,
  reps: number
}
```

## Future improvements (not implemented yet)

- **Per-day summary documents** for cheaper History reads at scale (write a `daySummaries/{userId_date}` doc on each set log; History list reads summaries, only fetches sets when a day is expanded).
- **Email allowlist** if you want to lock down signup later — easiest done in `Login.jsx` by checking the email domain before allowing account creation, or via a Cloud Function.
- **Export to CSV** for offline analysis.
- **Native iOS app** using SwiftUI against the same Firestore collection.
