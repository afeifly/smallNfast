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
const PORT = process.env.PORT || 9025;

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

// Serve frontend static files dynamically
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// Fallback for SPA routing
app.get('*', (req, res) => {
  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <div style="font-family: sans-serif; padding: 40px; text-align: center; background: #090d16; color: #fff; min-height: 100vh;">
        <h2>SUTO VoiceOver Studio 🚀</h2>
        <p style="color: #94a3b8; margin-top: 12px;">Frontend bundle not found. Please build the UI by running:</p>
        <div style="margin: 20px 0;">
          <code style="background: rgba(255,255,255,0.1); padding: 10px 18px; border-radius: 8px; color: #8b5cf6; font-size: 1rem;">cd voiceover && npm run build</code>
        </div>
      </div>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`[TTS Server] Running on http://localhost:${PORT}`);
});
