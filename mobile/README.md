# Matkis Leaderboard Mobile (React Native / Expo)

This is a lightweight React Native (Expo) client for the Matkis leaderboard backend.

## Prereqs
- Node + npm
- Expo CLI (`npx expo-cli --version` — auto-installed via `npx expo start`)

## Install & run
```bash
cd mobile
npm install
npx expo start
```
Then open in the Expo Go app (Android/iOS) or run on a simulator/emulator.

## API base URL
- Default: `https://matkis-assesment-2.onrender.com`
- Override with env: `EXPO_PUBLIC_API_BASE=https://your-backend` (Expo automatically injects `EXPO_PUBLIC_*` vars).

## Features
- Health check display
- Bootstrap Redis from Postgres (`POST /api/users`)
- Leaderboard paging (`GET /api/leadboard?page=&limit=20`)
- Username/prefix search (`GET /api/username?username=...`)
- Simulation trigger (`POST /api/simulate`)

## Files
- `App.js` – main UI and API calls
- `package.json`, `app.json`, `babel.config.js` – Expo project config

## Notes
- Uses plain React Native components (no TypeScript).
- Keep backend running with valid `POSTGRES_URL` and `REDIS_URL` envs. 

