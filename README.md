# Pulse Frontend

Pulse is a modern, high-performance project vitals monitor and task board built with React, Vite, Firebase (Auth + Firestore), and `@dnd-kit`. It features Google OAuth authentication, AI executive status generator, board export tools, and sleek dark mode design.

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` and fill in your Firebase web app credentials (Firebase console → Project settings → General → Your apps) & Backend API URL:
```env
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_API_URL=http://localhost:3001
```

### 3. Firebase Console Setup (one time)
1. **Authentication → Sign-in method**: enable **Email/Password** and **Google**.
2. **Firestore Database**: create a database (Production mode).
3. **Firestore → Rules**: paste the contents of `firestore.rules` from this repo and publish — each user can then only read/write their own tasks.

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ⭐️ Key Features

- **Firebase Authentication**: Email/password authentication and Google OAuth (`signInWithPopup`).
- **Firestore Task Storage**: Tasks are stored per-user in the `tasks` collection (`user_id` = Firebase uid), protected by security rules.
- **Drag & Drop Task Board**: Touch-friendly status column drag & drop powered by `@dnd-kit`.
- **AI Status Generator**: Reads board state and generates executive summaries and risk assessments.
- **Copy & Export Tools**: One-click "Copy Report" for status updates and "Export JSON" for full board backups.
- **Vercel Routing**: Configured with `vercel.json` SPA rewrites for seamless single-page application routing.

---

## ☁️ Vercel Deployment & Firebase Setup Guide

### Step 1: Deploy Backend API
Deploy `pulse-backend` first to obtain your production backend API URL (e.g. `https://pulse-backend.vercel.app`).

### Step 2: Deploy Frontend on Vercel
1. Go to [Vercel Dashboard](https://vercel.com/new) -> Import `Harshkhurdi/pulse-frontend`.
2. Configure **Environment Variables**:
   - The six `VITE_FIREBASE_*` variables from your Firebase web app config
   - `VITE_API_URL`: Your production backend URL from Step 1 (`https://pulse-backend.vercel.app`)
3. Click **Deploy**. Note down your deployed Frontend URL (e.g. `https://pulse-frontend.vercel.app`).

### Step 3: Configure Firebase Authentication & Google OAuth
1. In the **Firebase console** → **Authentication** → **Sign-in method**:
   - Enable **Email/Password** and **Google** (Google asks for a support email).
2. **Authentication** → **Settings** → **Authorized domains**: add your Vercel frontend domain (e.g. `pulse-frontend.vercel.app`) so Google sign-in works from production.
3. **Firestore** → **Rules**: publish the rules from `firestore.rules` in this repo.
