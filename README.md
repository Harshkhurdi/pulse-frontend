# Pulse Frontend

Pulse is a modern, high-performance project vitals monitor and task board built with React, Vite, Supabase, and `@dnd-kit`. It features Google OAuth authentication, AI executive status generator, board export tools, and sleek dark mode design.

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

Edit `.env` and fill in your Supabase credentials & Backend API URL:
```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=http://localhost:3001
```

### 3. Start Development Server
```bash
npm run dev:frontend
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ⭐️ Key Features

- **Supabase Authentication**: Email/password authentication and Google OAuth (`signInWithOAuth({ provider: 'google' })`).
- **Drag & Drop Task Board**: Touch-friendly status column drag & drop powered by `@dnd-kit`.
- **AI Status Generator**: Reads board state and generates executive summaries and risk assessments.
- **Copy & Export Tools**: One-click "Copy Report" for status updates and "Export JSON" for full board backups.
- **Vercel Routing**: Configured with `vercel.json` SPA rewrites for seamless single-page application routing.

---

## ☁️ Vercel Deployment & Supabase Setup Guide

### Step 1: Deploy Backend API
Deploy `pulse-backend` first to obtain your production backend API URL (e.g. `https://pulse-backend.vercel.app`).

### Step 2: Deploy Frontend on Vercel
1. Go to [Vercel Dashboard](https://vercel.com/new) -> Import `Harshkhurdi/pulse-frontend`.
2. Configure **Environment Variables**:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL (`https://your-supabase-project.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key
   - `VITE_API_URL`: Your production backend URL from Step 1 (`https://pulse-backend.vercel.app`)
3. Click **Deploy**. Note down your deployed Frontend URL (e.g. `https://pulse-frontend.vercel.app`).

### Step 3: Configure Supabase Authentication & Google OAuth
1. In your **Supabase Dashboard** -> **Authentication** -> **URL Configuration**:
   - Add your Vercel Frontend URL to **Site URL** and **Redirect URLs** (e.g. `https://pulse-frontend.vercel.app`).
2. In **Authentication** -> **Providers** -> **Google**:
   - Enable Google Provider.
   - Enter Client ID & Secret from Google Cloud Console.
   - Copy the Supabase Callback URL into your Google Cloud Authorized Redirect URIs.
