# Week 1 Runbook

## Goal
Harden offline-first startup so local DB initialization is deterministic, auditable, and easy to verify.

## Automated verification
Run this from the workspace root:

```bash
npm run verify:week1
```

This command executes:
1. IndexedDB repository tests.
2. Full test suite.
3. Production build.

## Manual verification (browser)
1. Open the app once with a clean browser profile.
2. Open DevTools > Application > IndexedDB > EduHubDatabase.
3. Confirm these tables exist and have records:
   - bursaries
   - institutions
   - meta
4. In `meta`, confirm keys exist:
   - lastSeededAt
   - seedVersion
   - seedSummary
5. Refresh the app and confirm counts are unchanged (no duplicates).

## Troubleshooting
- If startup fails, the app now renders a database initialization error message from `DatabaseProvider`.
- If you need a clean rerun, clear IndexedDB for the site and reload.
