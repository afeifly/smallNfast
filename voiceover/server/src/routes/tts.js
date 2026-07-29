import express from 'express';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const groupId = process.env.MINIMAX_GROUP_ID;
    const apiKey = process.env.MINIMAX_API_KEY;

    if (!groupId || !apiKey) {
      return res.status(400).json({
        error: 'Missing MINIMAX_GROUP_ID or MINIMAX_API_KEY in server environment (.env file).'
      });
    }

    const { text, voice_id = 'male-qn-qingse' } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text content is required' });
    }

    const url = `https://api.minimax.chat/v1/t2a_v2?GroupId=${groupId}`;
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    const payload = {
      model: 'speech-01-turbo',
      text: text.trim(),
      stream: false,
      voice_setting: { voice_id },
      audio_setting: { format: 'mp3', sample_rate: 32000 }
    };

    console.log(`[TTS Server] Requesting MiniMax TTS for voice '${voice_id}' (text length: ${text.length})...`);

    const apiRes = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const result = await apiRes.json();

    if (result.base_resp && result.base_resp.status_code !== 0) {
      console.error('[TTS Server] MiniMax API error response:', result.base_resp);
      return res.status(500).json({
        error: result.base_resp.status_msg || 'MiniMax API returned error',
        details: result.base_resp
      });
    }

    if (result.data && result.data.audio) {
      const audioBuffer = Buffer.from(result.data.audio, 'hex');
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.length);
      return res.send(audioBuffer);
    } else {
      console.error('[TTS Server] Unexpected MiniMax response format:', result);
      return res.status(500).json({
        error: 'Audio data missing from MiniMax response',
        result
      });
    }
  } catch (err) {
    console.error('[TTS Server] Exception:', err);
    res.status(500).json({ error: err.message || 'Server internal error' });
  }
});

export default router;
