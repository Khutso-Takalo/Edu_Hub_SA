# EduHub System Overview

## What is EduHub?

**EduHub** is a comprehensive South African student educational platform that helps learners:
- Find bursaries matching their profile (grades, interests, province)
- Track bursary applications with checklists and deadline reminders
- Discover institutions and career paths
- Build CVs and practice skills
- Learn offline with cached resources

**Key insight:** The app works fully offline using browser storage, so students can use it even without internet.

---

## How It Works (Simple Explanation)

### The Big Picture

```
Student installs app
    ↓
Logs in (or browses anonymously)
    ↓
App loads bursaries from local storage (IndexedDB)
    ↓
Student searches, filters, applies
    ↓
App tracks progress locally
    ↓
When online: optional sync with server, notifications
    ↓
Works offline: all data stays on device until sync
```

---

## Core Components Explained

### 1. **Bursary Discovery**
- **What:** Search and filter available bursaries by province, field, grades
- **Where:** BursarySearch component
- **Data:** Loaded from IndexedDB (local browser storage) on startup
- **How it updates:** Weekly scraper adds new bursaries; admin imports seed data

### 2. **Application Tracker**
- **What:** Manage applications with status, checklists (documents needed), deadlines
- **Where:** ApplicationTracker component
- **Data:** Stored locally in IndexedDB; synced to Supabase when logged in
- **Statuses:** draft → submitted → under-review → successful/unsuccessful

### 3. **Smart Reminders**
- **What:** Automatic deadline notifications (7 days out = medium, 3 days = high, <3 days = critical)
- **Where:** NotificationService
- **How:** Checks application deadlines, sends via:
  - In-app notifications (always works)
  - Email (if configured)
  - SMS (if configured)
- **Retry:** Auto-retries failed sends up to 3 times

### 4. **Offline Support (PWA)**
- **What:** App works completely offline
- **How:** Service worker caches app code + images + fonts
- **Data:** Local storage (IndexedDB) stays even when offline
- **Sync:** When you go back online, app syncs profile/application changes

### 5. **Gamification**
- **What:** Earn points, streaks, badges for daily check-ins and actions
- **Where:** Dashboard and activity tracking
- **Data:** Points/streaks stored locally and on server

### 6. **Admin Panel**
- **What:** Data lab for admins to:
  - Scrape new bursaries
  - Review link health
  - Monitor notification delivery
  - View analytics on user behavior
- **Data:** Pulls from IndexedDB, shows real-time monitoring

---

## Data Layers (Where Data Lives)

### **Layer 1: Client-Side (Browser)**
**IndexedDB** (local browser database)
- Stores: Bursaries, institutions, applications, notifications, drafts, gamification data
- Pros: Works offline, fast, unlimited storage
- Con: Each browser/device has its own copy
- Survives page refresh and browser restart

**LocalStorage** 
- Small data: Search history, analytics events, app state
- Pros: Simple, fast
- Con: Limited to ~5-10 MB

### **Layer 2: Server-Side (Supabase)**
**PostgreSQL Database**
- Stores: User profiles, authentication, backup of applications
- Accessed when online
- Enforced by RLS policies (only see your own data, admins see all)

### **Layer 3: Seed Data (Static)**
**Bundled JSON files**
- Bursaries seed (`src/data/seed/bursaries.json`)
- Institutions seed
- Loaded on first startup

---

## How Data Flows

### **Bursary Search Flow**
```
App starts
  ↓
Check local IndexedDB for bursaries
  ↓
If empty → Load from bundled seed JSON
  ↓
Student types search query
  ↓
App ranks bursaries by relevance (keyword match + freshness + trust tier)
  ↓
Shows results immediately (no server call needed)
```

### **Application Creation Flow**
```
Student clicks "Apply" on bursary
  ↓
App creates application in local IndexedDB (draft status)
  ↓
Student adds checklist items (documents needed)
  ↓
Set deadline reminder
  ↓
Goes to Supabase when online
  ↓
Can sync across devices
```

### **Notification Delivery Flow**
```
Application deadline approaches
  ↓
NotificationService detects it
  ↓
Classifies severity (days until deadline)
  ↓
Creates in-app notification (always works offline)
  ↓
If online: tries to send email/SMS via webhooks
  ↓
If fails: retries up to 3 times with delays
  ↓
If still fails: stores in dead-letter queue for manual review
```

---

## Key Concepts

### **Freshness Scoring**
Every bursary has a "freshness score" (0-1):
- **1.0** = Just verified
- **Decays** = Loses points over 60 days without re-verification
- **< 0.4** = Automatically hidden from feeds (marked as potentially stale)

Admins can manually verify bursaries to reset the score to 1.0.

### **Trust Tiers**
Bursaries are labeled by source confidence:
- **Official** – Government sources (NSFAS, etc.)
- **Admin Verified** – Admins have confirmed it's current
- **Community** – Scraped from web, not verified
- **Unverified** – Needs checking (default for web scrapes)

### **User Roles**
- **Student/Learner** – Can search, apply, create profile
- **Teacher** – Can create a classroom and manage students
- **Admin** – Can import/scrape bursaries, manage data, review analytics

### **RLS Policies** (Row-Level Security)
Database rules that control who can read/write what:
- Bursaries: Anyone can read, only admins can modify
- Applications: Users can only access their own
- Profiles: Users can only update their own (except admins)

---

## The Admin Panel Explained

Admins have a data lab with 6 main tools:

### **1. Scraper**
- Runs keyword extraction against known sources
- Falls back to manual entry when sources are down
- Used to import new bursaries

### **2. Source Catalog Registry**
- Shows which bursary sources are responding
- Displays health status (matched, fallback, unreachable)
- Helps debug why scrapes might be incomplete

### **3. Export/Import**
- Export current bursaries to JSON (for backup or transfer)
- Import JSON to load new batch

### **4. Data Quality**
- Shows bursary count by trust tier
- Displays freshness distribution (how many are stale?)
- Finds broken links
- Shows source heartbeat status

### **5. Notifications**
- View all sent notifications
- Failed sends stored in dead-letter queue
- SLO tracking (are we hitting delivery targets?)
- Circuit breaker status (auto-stops if too many failures)

### **6. Analytics**
- UI experiment outcomes (which features drive action?)
- Lightweight telemetry, stored locally
- Trend sparklines for key metrics

---

## Key Files & What They Do

| File | Purpose |
|------|---------|
| `src/hooks/useAuth.ts` | Login/logout, profile management, role checking |
| `src/hooks/useBursaries.ts` | Search, filter, rank bursaries |
| `src/hooks/useApplications.ts` | CRUD operations on applications |
| `src/services/NotificationService.ts` | Deadline reminders, delivery tracking, retry logic |
| `src/services/VerificationScheduler.ts` | Background link checking, freshness updates |
| `src/infrastructure/database/indexeddb/` | IndexedDB schema and seed logic |
| `src/components/eduhub/AdminPanel.tsx` | Data lab for admins |
| `src/lib/dataQuality.ts` | Freshness scoring, link validation |
| `supabase/sql/admin-rbac-policies.sql` | Authorization rules (RLS) |

---

## Environment Variables Needed

**Required:**
- `VITE_SUPABASE_URL` – Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` – Supabase anon key

**Optional (but recommended):**
- `VITE_NOTIFICATION_EMAIL_WEBHOOK_URL` – For email reminders
- `VITE_NOTIFICATION_SMS_WEBHOOK_URL` – For SMS reminders
- `VITE_GOOGLE_CUSTOM_SEARCH_API_KEY` – For knowledge hub search

See `.env.example` for full list.

---

## Common Workflows

### **Deploy a Fresh Seed of Bursaries**
```bash
npm run scrape:bursaries          # Scrape fresh data
npm run data:qa                    # Validate links
npm run scrape:bursaries:merge    # Import into seed
npm run build                      # Rebuild app
# Deploy
```

### **Force Update All Freshness Scores**
1. Open Admin Panel
2. Click "Review Data Quality"
3. See stale bursaries (< 0.4 freshness)
4. Click "Reset to Verified" for ones you confirm
5. Freshness score resets to 1.0

### **Debug Why Email Isn't Sending**
1. Go to Admin Panel → Notifications
2. Check "Delivery Log" for failed sends
3. Click failed notification to see error reason
4. Check webhook URL is correct in env vars
5. Test webhook manually with curl

### **Enable MFA for Your Account**
1. Sign in
2. Click account dropdown → Security Settings
3. Click "Set up Two-Factor Authentication"
4. Scan QR code with authenticator app (Google Authenticator, Authy, etc.)
5. Enter 6-digit code to confirm
6. Save backup codes

---

## Testing & Verification

### **Run Full Checks**
```bash
npm run verify:production   # TypeScript + lint + tests + build + budget
```

### **Run Just Tests**
```bash
npm run test                # Run all tests
npm run test -- [file]      # Run specific test file
```

### **Check Bundle Size**
```bash
npm run build:analyze       # Generates HTML bundle analysis
npm run build               # Shows assets and sizes
```

### **Check Lint Issues**
```bash
npm run lint                # Show all lint errors/warnings
```

---

## Technology Stack at a Glance

| Layer | Tech |
|-------|------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS + Radix UI |
| **State** | Context API + React Query |
| **Local DB** | Dexie.js (IndexedDB wrapper) |
| **Backend** | Supabase (PostgreSQL + Auth) |
| **Offline** | Workbox (PWA caching) |
| **Testing** | Vitest + React Testing Library |
| **Build** | Vite with PWA support |

---

## Quick Mental Model

Think of EduHub as:
- **A search engine** that helps students find bursaries
- **A personal organizer** that tracks applications and deadlines
- **A backup system** that stores everything locally so it works offline
- **A data quality tool** that hides stale/broken bursaries
- **A notification engine** that reminds students about deadlines
- **A laboratory** (for admins) to manage the bursary dataset

All of these work **together** with:
- **Offline storage** (IndexedDB)
- **Server sync** (Supabase when online)
- **Admin controls** (RLS + UI gates)
- **Smart reminders** (automatic deadline tracking)
- **Quality signals** (freshness scores + link health)

---

## Summary

**EduHub is a completely offline-capable student resource platform** built with a local-first architecture:
1. Bursaries and data are stored locally (IndexedDB)
2. Works offline with full functionality
3. Syncs with Supabase when online
4. Admins can scrape/import/verify data
5. Smart reminders notify students automatically
6. Everything is type-safe, tested, and bundled efficiently

The system prioritizes **user control, data ownership, and offline resilience** over always-online functionality.
