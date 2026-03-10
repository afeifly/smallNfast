# Third-Party Lab Sensor Calibration Server

Full-stack solution for managing sensor calibrations.

## Architecture
- **Backend**: Node.js, Express, Prisma (SQLite).
- **Frontend**: Vue 3, Vite, Pinia, Vanilla CSS.

## Features
- Admin dashboard with JWT authentication.
- Company user management (passcode generation, service time control).
- Device binding (locks passcode to first mobile device ID).
- Sensor data ingestion (JSON storage for complex settings/points).

## Setup & Running

### 1. Prerequisites
- Node.js (v18+)
- npm

### 2. Backend Setup
```bash
cd server
npm install
npx prisma migrate dev --name init
node prisma/seed.js # Creates admin/Password123!
npm start # Runs on http://localhost:3001
```

### 3. Frontend Setup
```bash
cd client
npm install
npm run dev # Runs on http://localhost:5174
```

## API Endpoints
- `POST /api/auth/login`: Admin login.
- `POST /api/sensors/verify`: Mobile app verification (passcode + deviceId).
- `POST /api/sensors/upload`: Mobile app data upload.
- `GET /api/sensors/company/:id`: Admin sensor view.
