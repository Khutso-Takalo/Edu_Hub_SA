# EduHub Architecture

## Core Layers

- UI layer: React + TypeScript components in src/components.
- Domain data: static and seed datasets in src/data.
- Persistence: IndexedDB via Dexie schema in src/infrastructure/database/indexeddb.
- Auth and identity: Supabase-based profile and MFA flows.

## Product Readiness Extensions

- Aha moment:
  - Quick onboarding modal captures grade, APS, province.
  - Dashboard generates a personalized Top Picks feed for near-deadline bursaries.
- Data sustainability:
  - Weekly scraper workflow updates seed data automatically.
  - User stale-data reports mark records unverified and hidden from normal feeds.
  - Golden 50 curation flags top bursaries.
- Distribution:
  - Classroom mode supports class code creation and join flow.
  - Bursary detail includes WhatsApp sharing.
- Monetization alignment:
  - Premium flags gate advanced CV capabilities.
  - Sponsored bursary labels are explicit and transparent.
- Feedback loop:
  - Feedback widget persists in IndexedDB for review/export.

## Database Notes

Current schema version includes:

- bursaries, institutions, applications, users, notifications
- bursaryFlags, gamificationProfiles, gamificationEvents
- feedbackEntries, classrooms, classroomMembers

## Quality Principles

- Verified data over placeholder data.
- Truthful unavailable states when links/content are unverified.
- Automated freshness updates and manual admin curation.
