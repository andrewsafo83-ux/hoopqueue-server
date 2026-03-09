# RunUp — Basketball Court Live Run App

## Overview
A mobile app that shows live basketball runs at parks and gyms. Users can see real-time player counts, join waitlists, and browse courts before heading out.

## Tech Stack
- **Frontend**: Expo / React Native (Expo Router file-based routing)
- **Backend**: Express.js (Node.js/TypeScript)
- **Persistence**: AsyncStorage (local, device-only)
- **Map**: react-native-maps@1.18.0 (Expo Go compatible)

## Architecture
- `app/(tabs)/` — Three main tabs: Map, Courts, Profile
- `app/court/[id].tsx` — Court detail + waitlist management
- `context/AppContext.tsx` — Shared state: courts, waitlists, player counts, profile
- `data/courts.ts` — Static court data (8 LA-area courts)
- `constants/colors.ts` — Dark theme with orange accent

## Features
- Interactive dark map with custom court markers (mobile only, web shows list)
- Real-time-feeling player count updates (simulated via interval)
- Court filter by indoor/outdoor
- Join/leave waitlists with position tracking
- User profile with skill level (Beginner/Intermediate/Advanced/Pro)
- Court detail: player count, progress bar, waitlist with positions
- Liquid glass tab bar on iOS 26+

## Color Palette
- Background: #0A0A0F
- Card: #141420
- Accent (orange): #FF6B00
- Text: #FFFFFF
- Status: #22C55E (green), #EF4444 (red)

## Workflows
- `Start Backend`: Express on port 5000
- `Start Frontend`: Expo Metro on port 8081
