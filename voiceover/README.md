# SUTO VoiceOver Studio

A client-side video editor and voice-over generator built with **React (Vite)** and **Node.js (Express)** using the **MiniMax T2A v2 (Speech-01-Turbo) TTS API**.

## Features

- 🔒 **Fixed Password Gate**: Simple password protection (`SUTOuser1234`).
- 📁 **Project Management**: Create, load, and delete projects (stored locally via `localStorage`).
- 🎬 **Local Video Processing**: Load MP4/MOV videos directly in the browser; duration and timeline auto-detected.
- 🗣️ **MiniMax TTS Voice Generation**: Input custom narration text, select voice characters (`male-qn-qingse`, `female-shaonv`, etc.), and generate high quality MP3 voiceover.
- ⏱️ **Timeline Voice Synchronization**: Position voice tracks at precise video timestamps. Preview speech narration synchronized with video playback using the Web Audio API.
- 📹 **Client-Side Composite Export**: Mix canvas video frames and scheduled Web Audio tracks into a combined downloadable video file (.webm / .mp4).
- 🔑 **Secure API Key Proxy**: Node server acts as a thin proxy for MiniMax API keys, keeping `.env` credentials hidden from browser client exposure.

## Getting Started

### 1. Configure Environment Variables
Edit `.env` in the root or `voiceover/.env`:
```env
MINIMAX_GROUP_ID=your_group_id_here
MINIMAX_API_KEY=your_api_key_here
PORT=3001
```

### 2. Start Development Server
From the root directory:
```bash
npm run dev
```

Or run separately:
```bash
# Terminal 1: Node TTS Server (Port 3001)
cd server && npm run dev

# Terminal 2: React Vite Client (Port 5173)
cd client && npm run dev
```

Open `http://localhost:5173` in your browser.
Login password: `SUTOuser1234`
