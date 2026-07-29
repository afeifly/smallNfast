export async function fetchTTSAudio({ text, voiceId }) {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      voice_id: voiceId || 'male-qn-qingse'
    })
  });

  if (!response.ok) {
    let errorMsg = 'Failed to generate voice';
    try {
      const errJson = await response.json();
      errorMsg = errJson.error || errorMsg;
    } catch (e) {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const arrayBuffer = await response.arrayBuffer();
  return arrayBuffer; // ArrayBuffer of MP3 data
}

export const VOICE_OPTIONS = [
  { id: 'male-qn-qingse', name: 'Male Qingse (Standard Male - 青色)' },
  { id: 'female-shaonv', name: 'Female Shaonv (Young Female - 少女)' },
  { id: 'male-qn-jingying', name: 'Male Elite (Business Male - 精英)' },
  { id: 'female-yujie', name: 'Female Yujie (Mature Female - 御姐)' },
  { id: 'presenter_male', name: 'Presenter Male (Narrator)' },
  { id: 'presenter_female', name: 'Presenter Female (Narrator)' }
];
