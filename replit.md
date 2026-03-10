# HoopQueue — Basketball Court Live Run App

## Overview
A mobile app showing live basketball runs at parks and gyms across California. Users see real-time player counts, join waitlists, post in a live chat feed, and browse 60+ courts by city and type.

## Tech Stack
- **Frontend**: Expo / React Native (Expo Router file-based routing)
- **Backend**: Express.js (Node.js/TypeScript)
- **Database**: PostgreSQL (Replit built-in) — users table with name, email, skill level
- **Local Persistence**: AsyncStorage (waitlists, player counts, profile cache)
- **Map**: react-native-maps@1.18.0 (Expo Go compatible, platform-split)

## Architecture
- `app/(tabs)/` — Four tabs: Map, Courts, Messages, Profile
- `app/court/[id].tsx` — Court detail + waitlist + live chat feed
- `app/dm/[userId].tsx` — DM conversation thread (friends only)
- `context/AppContext.tsx` — Shared state: courts, waitlists, player counts, profile
- `data/courts.ts` — 70+ courts across CA including 24 Hour Fitness gyms; CITIES array
- `server/routes.ts` — REST API: users, friends, DMs (PostgreSQL), court messages (in-memory)
- `constants/colors.ts` — Dark theme with orange accent

## Database Schema
- **users**: `id`, `user_id` (unique), `username`, `email` (unique), `skill_level`, `created_at`, `updated_at`
- **friendships**: `id`, `requester_id`, `addressee_id`, `status` (pending/accepted), `created_at`, `updated_at`
- **direct_messages**: `id`, `sender_id`, `receiver_id`, `text`, `created_at`
- **dm_read_receipts**: `user_id`, `partner_id`, `last_read`

## Features
- Interactive dark map with court markers (mobile native; list fallback on web)
- Real-time player count updates (simulated — only for courts already active)
- City + indoor/outdoor filtering
- Join/leave waitlists with position tracking
- Live Feed per court: post updates, quick-tap chips, 3-second polling
- Profanity filter on all chat messages and DMs (server-side)
- **Friends + DM system**: search players by username, send/accept friend requests, DM accepted friends only; pending requests shown as badge on tab + banner in Messages screen; long-press friend to unfriend
- User profile with name, **email** (stored in PostgreSQL), and skill level
- Liquid glass tab bar on iOS 26+
- Custom AI-generated app icon and splash screen

## Color Palette
- Background: #0A0A0F
- Card: #141420
- Accent (orange): #FF6B00
- Text: #FFFFFF
- Status: #22C55E (green), #EF4444 (red)

## App Store Metadata (app.json)
- iOS bundle ID: `com.hoopqueue.app`
- Android package: `com.hoopqueue.app`
- Version: 1.0.0 / Build 1

## Workflows
- `Start Backend`: Express on port 5000
- `Start Frontend`: Expo Metro on port 8081

## Key Files
- `metro.config.js` — Blocks `.local` directory from Metro watcher (prevents crash from temp files)
- `components/CourtMap.native.tsx` — Native map
- `components/CourtMap.web.tsx` — Web fallback list
