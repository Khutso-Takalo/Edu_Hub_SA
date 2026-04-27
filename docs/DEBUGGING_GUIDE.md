# EduHub Debugging Guide

A practical guide to diagnose and fix common issues in EduHub.

---

## How to Debug Anything

### **Step 1: Identify the Layer**

```
Is the problem in:
  ├─ UI/Component (what user sees)?
  ├─ Data fetching (search results missing)?
  ├─ Offline mode (Works online, not offline)?
  ├─ Notifications (Email/SMS not sending)?
  ├─ Admin features (Scraper failing)?
  └─ Performance (App slow?)
```

### **Step 2: Check the Logs**

```javascript
// Browser console
F12 → Console tab

// Look for errors (red text)
// Look for warnings (yellow text)
// Search for relevant keywords:
//   - "bursary" / "application" 
//   - "notification" / "email"
//   - "Supabase" / "auth"
//   - Your specific feature name
```

### **Step 3: Check Storage**

```javascript
// Open DevTools → Application tab → IndexedDB
// Look for database named "eduhub"
// Check tables: bursaries, applications, notifications, etc.
// Click table to inspect data

// Also check LocalStorage for:
// - eduhub:search-history:v1
// - eduhub:ui-analytics:v1
// - eduhub:app-state
```

### **Step 4: Check Network**

```
DevTools → Network tab
Reload page
Look for failed requests (red text)
  - Check URL is correct
  - Check response status code
  - Check response body for error message
Common issues:
  ✗ 401 = Auth failed (expired token, wrong key)
  ✗ 403 = Permission denied (RLS policy blocking)
  ✗ CORS = Browser blocking cross-domain request
  ✗ 502 = Server down
```

### **Step 5: Reproduce Consistently**

Before diving deep, try:
```
1. Hard refresh (Ctrl+Shift+R)
2. Clear IndexedDB (DevTools → Storage → clear all)
3. Logout and login again
4. Open in incognito mode (no extensions)
5. Test on different device/browser
```

---

## Common Issues & Solutions

### Issue #1: **App Won't Load / Blank Screen**

**Possible causes:**
1. Supabase URL/key missing or invalid
2. JavaScript error blocking render
3. Service worker cache corrupted

**Debug steps:**
```
1. Open DevTools → Console
2. Look for red errors
3. Check in Network tab for failed requests to Supabase
4. If CORS error: check VITE_SUPABASE_URL is correct

If app still broken:
5. Clear browser storage: DevTools → Storage → Clear All
6. Restart dev server: Ctrl+C, npm run dev
7. Try incognito tab

Check env vars:
8. .env.local file exists?
9. npm run dev sees the file? (should print config on startup)
```

**Fix:**
- Copy `.env.example` to `.env.local`
- Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart dev server

---

### Issue #2: **Search Returns No Bursaries**

**Possible causes:**
1. Bursary data not loaded into IndexedDB
2. Filter too restrictive
3. Search ranking broken

**Debug steps:**
```javascript
// In browser console:

// Check IndexedDB has bursaries
const db = new Dexie('eduhub');
db.bursaries.count().then(count => console.log(`Bursaries: ${count}`));

// Check seed version
db.meta.toArray().then(m => console.log(m));

// List first 5 bursaries
db.bursaries.limit(5).toArray().then(b => console.log(b));
```

**What the output tells you:**
- `count = 0` → No bursaries loaded. Seed failed or DB cleared.
- `count > 0` → Bursaries exist. Problem is search/filter logic.
- `seedVersion` mismatch → App didn't re-import seed on update.

**Fix:**
- Manually import seed: Admin Panel → Import JSON from `src/data/seed/bursaries.json`
- Or: Clear IndexedDB and reload (forces re-seed)
  ```javascript
  db.delete().then(() => location.reload());
  ```

---

### Issue #3: **Can't Login / Auth Error**

**Possible causes:**
1. Supabase auth REST API not responding
2. Wrong credentials
3. CORS blocking request
4. Auth token expired

**Debug steps:**
```
1. Check browser console for "Auth error" or specific message
2. DevTools → Network → Filter by "auth" or "signup"
3. Check the POST request to Supabase:
   - URL should be: [VITE_SUPABASE_URL]/auth/v1/signup
   - Response: Look for error_description field

Common Supabase auth errors:
- "User already registered" → Use different email or reset password
- "Invalid login credentials" → Wrong password
- "Email is not confirmed" → Check email for verification link
- "SMTP connection failed" → Email service down (Supabase issue)
```

**Fix:**
- Verify `VITE_SUPABASE_ANON_KEY` is correct
- Check Supabase dashboard: Auth → Policies
- Try password reset
- Confirm email if new signup

---

### Issue #4: **Notifications Not Sending (Email/SMS)**

**Possible causes:**
1. Webhook URL wrong or endpoint down
2. Twilio/Sendgrid credentials invalid
3. Application has no deadline set
4. NotificationService never ran

**Debug steps:**
```javascript
// In console, check if notifications exist:
const db = new Dexie('eduhub');
db.notifications.toArray().then(n => console.log(n));

// If empty: Notifications not created
// If populated: Check delivery status

// Check if NotificationService is running:
console.log(window.__NOTIFICATION_SERVICE__);  // Should exist
```

**Manual test:**
```
1. Go to Admin Panel → Notifications
2. Look at "Delivery Log"
3. Find a failed notification (if any)
4. Check error message:
   - "Connection refused" → Webhook endpoint down
   - "401 Unauthorized" → API key wrong
   - "Timeout" → Endpoint too slow

5. Test webhook manually:
   curl -X POST https://your-webhook-url/send \
     -H "Content-Type: application/json" \
     -d '{"to":"your-email@test.com","subject":"Test"}'
```

**Fix:**
- Check `VITE_NOTIFICATION_EMAIL_WEBHOOK_URL` in `.env.local`
- Test webhook is working
- Check Sendgrid/Twilio API keys if using fallback
- Verify retry count not exhausted: Admin Panel → check if notification has "max retries" status

---

### Issue #5: **Application Won't Save / Status Stuck**

**Possible causes:**
1. Application in local IndexedDB but not synced to server
2. User not authenticated
3. Supabase RLS policy blocking write

**Debug steps:**
```javascript
// Check app in local DB
const db = new Dexie('eduhub');
db.applications.where('id').equals('app-id-here').first()
  .then(app => console.log(app));

// If it's in local DB with correct data:
// Problem is server sync, not local save

// Check if user is authenticated:
const { user } = await supabaseClient.auth.getUser();
console.log(user);  // Should show user object, not null

// If null: User not logged in, or token expired
```

**Manual test:**
```
1. Create application
2. Dev Tools → Network → Filter "applications"
3. Look for POST request
4. If no request: Sync not running (check console for errors)
5. If 403 error: RLS policy blocking (check Supabase RLS setup)
6. If timeout: Supabase slow or down
```

**Fix:**
- Ensure user is logged in
- Check Supabase dashboard: SQL Editor → Run verification query:
  ```sql
  SELECT * FROM applications WHERE user_id = auth.uid();
  ```
- If error: RLS policy issue. Verify [`supabase/sql/admin-rbac-policies.sql`](../supabase/sql/admin-rbac-policies.sql) is applied.

---

### Issue #6: **App Works Online, Breaks Offline**

**Possible causes:**
1. Service worker not installed
2. Offline data stale or deleted
3. Offline page tries to call server API

**Debug steps:**
```javascript
// Check if service worker registered:
navigator.serviceWorker.getRegistrations()
  .then(regs => console.log(`Service workers: ${regs.length}`));
// Should show 1+, not 0

// Check PWA status:
window.dispatchEvent(new Event('eduhub:check-pwa-status'));
// Should trigger banner update

// Check if fetch fails offline:
// Open DevTools, Network tab
// Go offline (check box in Network tab)
// Perform action that would require server call
// Network tab should show request attempted but failed
// But UI should still work (pulling from local DB)
```

**Manual test:**
```
1. Online: Create application with deadline
2. Offline: Go to Admin Panel → Notifications
3. Should see past notifications
4. Should NOT see real-time sync updates (expected)
5. Go back online
6. Should sync new changes
```

**Fix:**
- If service worker not installed: `npm run build` then redeploy
- If offline data stale: Sync it before going offline
- If page broken offline: Check that all API calls have offline fallback

---

### Issue #7: **Admin Scraper Failing**

**Possible causes:**
1. Source URL changed or down
2. HTML structure changed (scraper regex broken)
3. Network timeout

**Debug steps:**
```
1. Admin Panel → Scraper
2. Click "Run Live Scrape"
3. Check browser console for errors
4. Look at "Source Catalog Registry" to see which sources responded

If stuck:
  • Wait 30 seconds (retry backoff)
  • Check browser internet connection
  • Try from different network

Check source health:
  • Admin Panel → Data Quality → Source Heartbeat
  • Green = responding, Red = down/timeout
```

**Fix:**
- If all sources red: Network issue or Supabase down
  - Try `curl https://nsfas.gov.za` to test external connectivity
- If specific sources failing:
  - Check that source URL is still valid
  - Report in admin notes (source may have restructured)
- Use manual import as fallback: Admin Panel → Import JSON

---

### Issue #8: **Performance Slow / App Freezing**

**Possible causes:**
1. Too many bursaries loaded (IndexedDB slow)
2. Search ranking algorithm slow
3. Component re-rendering too often

**Debug steps:**
```javascript
// Check IndexedDB size:
const db = new Dexie('eduhub');
const size = await db.bursaries.count();
console.log(`Total bursaries: ${size}`);
// If > 50,000: Might be slow on old devices

// Measure search speed:
console.time('search');
db.bursaries.where('province').equals('WC').toArray();
console.timeEnd('search');
// Should be < 100ms, if > 1000ms: Index problem

// Check React re-renders:
// Add to component:
console.log('AdminPanel rendered', performance.now());
// Search console logs, high frequency = re-rendering issue
```

**Fix:**
- Profile with React DevTools:
  - Install React DevTools extension
  - Profiler tab → Record → Perform action → Stop
  - Look for slow components (red bars)
- Optimize with `useMemo` / `useCallback` if indicated
- Clear old data: Admin Panel → Reset / purge stale records

---

### Issue #9: **RLS Error: "New row violates row-level security policy"**

**This error means:** Supabase is blocking a write because RLS policy doesn't allow it.

**Common causes:**
1. RLS policies not applied to Supabase yet
2. User role not set correctly in JWT
3. Trying to write to someone else's data

**Debug steps:**
```
1. Supabase dashboard → SQL Editor
2. Run:
   SELECT * FROM auth.users WHERE email = 'your-email@test.com';
3. Look at "user_metadata" field
4. Check if "role" is present and = "admin" (if you're admin)

5. Also check profiles table:
   SELECT * FROM profiles WHERE id = (auth current user id);
6. Check if role field is set
```

**Fix:**
- Ensure admin role is set: Supabase dashboard → Auth → User
  - Edit user → Metadata → Add: `{"role": "admin"}`
- Re-apply RLS policies: 
  - SQL Editor → Clear all old policies → Paste [`supabase/sql/admin-rbac-policies.sql`](../supabase/sql/admin-rbac-policies.sql) → Execute
- If still broken, temporarily disable RLS for testing:
  ```sql
  ALTER TABLE bursaries DISABLE ROW LEVEL SECURITY;
  -- Fix data, then re-enable
  ALTER TABLE bursaries ENABLE ROW LEVEL SECURITY;
  ```

---

### Issue #10: **"Module not found" or Build Error**

**Common causes:**
1. Missing file after Git merge
2. Import path typo
3. Missing dependency

**Debug steps:**
```bash
# Check if file exists:
ls -la src/path/to/file.ts

# Check imports:
grep -r "import.*from.*missing-file" src/

# Clear dist and node_modules:
rm -rf node_modules dist
npm install
npm run build

# Type-check:
npm run typecheck  # Catches TypeScript errors
```

**Fix:**
- Verify import paths are correct (no typos)
- Run `npm install` to fetch missing packages
- Run `npm run typecheck` before `npm run build`

---

## Testing & Verification Commands

### **Local Testing**
```bash
# Start dev server with error overlay
npm run dev

# Run full test suite
npm run test

# Run specific test file
npm run test -- src/components/eduhub/__tests__/BursarySearch.test.tsx

# Test in watch mode (reruns on file change)
npm run test -- --watch
```

### **Production Checks**
```bash
# Full pipeline: typecheck → lint → test → build → budget
npm run verify:production

# Check for lint issues only
npm run lint

# Type check only
npm run typecheck

# Test only
npm run test

# Build only
npm run build

# Analyze bundle size
npm run build:analyze  # Opens dist/bundle-analysis.html
```

---

## Debugging Tools & Techniques

### **DevTools for IndexedDB**
```
1. F12 → Application tab
2. Left sidebar → Storage → IndexedDB → eduhub
3. Click each table to inspect records
4. Right-click record → Edit / Delete

Useful for:
- Checking if data was seeded
- Finding duplicate records
- Cleaning up test data
```

### **React DevTools**
```
1. Chrome Web Store: Install React DevTools extension
2. F12 → Components tab
3. Click element to inspect React props
4. Edit props in real-time to test

Profiler tab:
5. Click Profiler → Record
6. Perform action
7. Stop recording
8. See which components re-rendered and why
9. Identify performance bottlenecks
```

### **Supabase Dashboard**
```
1. Go to https://supabase.io
2. Open your project
3. SQL Editor: Run queries to inspect/fix data
4. Auth: Check user metadata and roles
5. Logs: See realtime server errors
```

### **Console Tricks**
```javascript
// Pretty-print large objects
console.table(data)

// Measure code performance
console.time('name'); 
// ... code to measure ...
console.timeEnd('name');

// Conditional logging (only errors)
db.bursaries.where('price').above(1000).toArray()
  .then(expensive => {
    if (expensive.length > 100) {
      console.warn('Too many expensive items!', expensive);
    }
  });

// See all events fired
window.addEventListener('*', e => console.log(e.type, e));
// (Note: doesn't work for all events, but helpful for custom events)
```

---

## Getting Help

### **Before Asking for Help, Check:**
1. ✓ Browser console for errors (red text)
2. ✓ Network tab for failed requests
3. ✓ IndexedDB has data (DevTools → Storage)
4. ✓ `.env.local` has required vars
5. ✓ Try hard refresh (Ctrl+Shift+R)
6. ✓ Try incognito mode

### **When Reporting a Bug:**
Include:
1. What you did (steps to reproduce)
2. What you expected
3. What actually happened
4. Error from console (if any)
5. Browser / OS / Network (online/offline?)
6. Env config sample (without secrets)

Example:
```
Steps:
1. Logged in as student
2. Searched for "engineering"
3. Clicked first result
4. Clicked "Apply"
5. Set deadline to Dec 25, 2024
6. Clicked "Save"

Expected: Application saved, visible in tracker

Actual: Got error in console:
"RLS policy error: new row violates security policy"

Setup:
- Chrome on Windows
- Online mode
- Supabase project: [project-id]
```

---

## Summary

**Debugging checklist:**
1. Check browser console (errors?)
2. Check Network tab (failed requests?)
3. Check IndexedDB (data present?)
4. Check env vars (configured?)
5. Hard refresh and clear storage
6. Test in incognito mode
7. Check Supabase logs/status
8. Reproduce consistently before deep dive

**Key files to understand:**
- `src/hooks/useAuth.ts` – Auth logic
- `src/services/NotificationService.ts` – Reminder logic
- `src/infrastructure/database/indexeddb/schema.ts` – Data model
- [`supabase/sql/admin-rbac-policies.sql`](../supabase/sql/admin-rbac-policies.sql) – Authorization rules
- `vite.config.ts` – Build config

**Last resort:** Check `npm run verify:production` output to see if build/tests reveal the issue.

Good luck debugging! 🐛
