# HoopQueue — Basketball Court Finder App

## Overview
A mobile app for finding basketball courts across the entire United States. Users discover real courts from OpenStreetMap data, see real-time player check-ins, post in a social feed, DM friends, and browse 1,443 courts by state and city.

## Tech Stack
- **Frontend**: Expo / React Native (Expo Router file-based routing)
- **Backend**: Express.js (Node.js/TypeScript)
- **Database**: PostgreSQL (Supabase — session pooler, IPv4 compatible)
- **Local Persistence**: AsyncStorage (waitlists, player counts, profile cache)
- **Map**: react-native-maps@1.18.0 (Expo Go compatible, platform-split)

## Architecture
- `app/(tabs)/` — Four tabs: Map, Courts, Feed, Profile
- `app/court/[id].tsx` — Court detail + waitlist + live chat
- `app/dm/[userId].tsx` — DM conversation thread (friends only)
- `context/AppContext.tsx` — Shared state: courts, waitlists, player counts, profile
- `server/ca-courts.ts` — 169 real California courts (OpenStreetMap)
- `server/us-courts.ts` — 1,274 real courts from all 50 states + DC (OpenStreetMap)
- `server/routes.ts` — REST API + auto-seeding logic
- `constants/colors.ts` — Dark theme with orange accent

## Court Data
- **Total**: 1,443 real basketball courts from OpenStreetMap (zero fake/generated courts)
- **Coverage**: All 51 jurisdictions (50 states + DC)
- **Player counts**: All set to 0 — only real check-ins drive player counts
- **Top states**: CA (169), NY (101), NJ (99), TX (94), FL (84)
- Seeding: on startup, server auto-seeds CA courts (checks for `venice-beach` ID),
  then inserts all US courts if no non-CA court exists

## Authentication
- Instagram-style auth screen (`app/auth.tsx`) gates the entire app
- Users register with username + email + password (bcrypt hashed, min 6 chars)
- Login works with email, username, OR handle
- Forgot password: 6-digit code sent via email (SMTP via nodemailer) with 15min expiry
- Session persisted in AsyncStorage; logout clears everything
- `login()`, `register()`, `logout()` methods in AppContext
- Apple Review demo credentials: username `hqdemo`, password `HoopQueue2024!`
- Demo account auto-created on server startup if missing (email: demo@hoopqueue.app)
- Email reset requires SMTP env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`

## Auth API Endpoints
- `POST /api/auth/register` — create account with bcrypt password
- `POST /api/auth/login` — validate credentials (checks email, username, handle)
- `POST /api/auth/forgot-password` — send 6-digit code to email
- `POST /api/auth/reset-password` — validate code, update password
- `POST /api/auth/change-password` — change password for logged-in user

## Database Schema (Supabase)
- **courts**: real OpenStreetMap courts for all US states
- **users**: `id`, `user_id` (unique), `username`, `handle`, `email`, `password_hash`, `skill_level`, `created_at`
- **password_reset_codes**: `user_id`, `code`, `expires_at`, `used`
- **friendships**: `requester_id`, `addressee_id`, `status` (pending/accepted)
- **direct_messages**: `sender_id`, `receiver_id`, `text`, `created_at`
- **dm_read_receipts**: `user_id`, `partner_id`, `last_read`
- **posts**: social feed posts with optional images
- **post_comments**: comments on posts
- **post_likes**: likes on posts

## Database Connection
- Supabase session pooler: `aws-0-us-west-2.pooler.supabase.com:5432`
- Must use pooler (not direct) — Replit is IPv4 only
- Set via `DATABASE_URL` secret in Replit environment

## Features
- Interactive dark map with real court markers (mobile native; list fallback on web)
- Real player check-in counts (no fake data)
- Social feed with photo sharing, likes, comments
- Private DMs between friends
- Friend system (send/accept requests)
- State + city court browsing
- Court detail with live chat

## Build
- `npm run server:build` — Builds production server via esbuild → `server_dist/index.js`
- `npm run server:dev` — Dev server via tsx
- `npm run expo:dev` — Expo dev server on port 8081
