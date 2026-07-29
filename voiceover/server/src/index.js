import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ttsRouter from './routes/tts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from root directory or server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/tts', ttsRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGroupId: Boolean(process.env.MINIMAX_GROUP_ID),
    hasApiKey: Boolean(process.env.MINIMAX_API_KEY)
  });
});

// Serve frontend static build if available
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(`
      <div style="font-family: sans-serif; padding: 40px; text-align: center; background: #090d16; color: #fff; min-height: 100vh;">
        <h2>SUTO VoiceOver TTS Server is Running! 🚀</h2>
        <p style="color: #94a3b8;">For development, please open the React app at: <a href="http://localhost:5173" style="color: #6366f1; font-weight: bold;">http://localhost:5173</a></p>
        <p style="color: #64748b; font-size: 0.9rem;">(Or run <code>npm run build</code> inside the client directory to serve production build from this port)</p>
      </div>
    `);
  });
}

app.listen(PORT, () => {
  console.log(`[TTS Server] Running on http://localhost:${PORT}`);
});
