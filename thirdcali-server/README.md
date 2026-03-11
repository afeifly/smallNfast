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

## Deployment

In production, the backend server serves both the API and the static frontend assets.

### 1. Build & Start with PM2

```bash
# Build the frontend
cd client
npm run build

# Start the server with PM2 from the server directory
cd ../server
pm2 start index.js --name "thirdcali-server"
```

### 2. Caddy2 Configuration

Configure Caddy to proxy all traffic to the backend port (default `3001`). The backend is automatically configured to detect and serve the built frontend assets from `client/dist`.

Example `Caddyfile`:
```caddy
your-domain.com {
    reverse_proxy localhost:3001
}
```

### How it Works:
- **API**: Paths starting with `/api/` are handled by Express routes.
- **Static Assets**: All other paths attempt to serve files from `client/dist`.
- **SPA Routing**: If a file isn't found, it falls back to `index.html` to support Vue Router navigation.

