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
- `app/(tabs)/` — Three tabs: Map, Courts, Profile
- `app/court/[id].tsx` — Court detail + waitlist + live chat feed
- `context/AppContext.tsx` — Shared state: courts, waitlists, player counts, profile
- `data/courts.ts` — 60+ courts across CA including 24 Hour Fitness gyms; CITIES array
- `server/routes.ts` — REST API: user registration (PostgreSQL), court messages (in-memory)
- `constants/colors.ts` — Dark theme with orange accent

## Database Schema
- **users** table: `id`, `user_id` (unique), `username`, `email` (unique), `skill_level`, `created_at`, `updated_at`

## Features
- Interactive dark map with court markers (mobile native; list fallback on web)
- Real-time player count updates (simulated — only for courts already active)
- City + indoor/outdoor filtering
- Join/leave waitlists with position tracking
- Live Feed per court: post updates, quick-tap chips, 3-second polling
- Profanity filter on all chat messages (server-side)
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
