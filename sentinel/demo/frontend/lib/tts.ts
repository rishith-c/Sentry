const API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY ?? '';
const VOICE_ID = 'CwhRBWXzGAHq8TQ4Fs17'; // Roger
const MODEL_ID = 'eleven_flash_v2_5';
const MAX_WORDS = 25; // ~10 seconds at normal TTS speed

let currentAudio: HTMLAudioElement | null = null;
let interruptTimeout: ReturnType<typeof setTimeout> | null = null;

function humanize(text: string): string {
  // crew_001 -> Crew 1, crew_005 -> Crew 5, etc.
  return text.replace(/crew_0*(\d+)/gi, 'Crew $1');
}

function truncate(text: string): string {
  const words = text.split(/\s+/);
  if (words.length <= MAX_WORDS) return text;
  return words.slice(0, MAX_WORDS).join(' ') + '...';
}

function cleanup() {
  if (currentAudio) {
    currentAudio.pause();
    URL.revokeObjectURL(currentAudio.src);
    currentAudio = null;
  }
  if (interruptTimeout) {
    clearTimeout(interruptTimeout);
    interruptTimeout = null;
  }
}

async function playText(text: string) {
  if (!API_KEY) return;

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) return;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  audio.addEventListener('ended', () => {
    URL.revokeObjectURL(url);
    if (currentAudio === audio) currentAudio = null;
  });
  audio.play();
}

export function speakActionCard(card: {
  actionType: string;
  resourceLabel: string;
  rationale: string;
}) {
  const text = `${card.resourceLabel}. ${truncate(humanize(card.rationale))}`;

  if (currentAudio) {
    cleanup();
    interruptTimeout = setTimeout(() => {
      playText(text);
    }, 200);
  } else {
    playText(text);
  }
}
