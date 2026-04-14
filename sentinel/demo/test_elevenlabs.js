/**
 * ElevenLabs API test script (Node.js, no dependencies).
 *
 * Usage:
 *   ELEVENLABS_API_KEY=your_key_here node test_elevenlabs.js
 */

const fs = require("fs");
const https = require("https");

const API_KEY = process.env.ELEVENLABS_API_KEY || "";

if (!API_KEY) {
  console.error("ERROR: Set ELEVENLABS_API_KEY environment variable before running.");
  console.error("  export ELEVENLABS_API_KEY=your_key_here");
  process.exit(1);
}

function request(path, { method = "GET", body, acceptBinary = false } = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.elevenlabs.io",
      path: `/v1${path}`,
      method,
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${buf.toString()}`));
          return;
        }
        resolve(acceptBinary ? buf : JSON.parse(buf.toString()));
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testAuth() {
  console.log("\n[1] Testing authentication -- GET /user ...");
  const info = await request("/user");
  const name = info.first_name || "unknown";
  const tier = info.subscription?.tier || "unknown";
  const used = info.subscription?.character_count ?? "?";
  const limit = info.subscription?.character_limit ?? "?";
  console.log(`    OK  user=${name}  tier=${tier}  chars_used=${used}/${limit}`);
}

async function testListVoices() {
  console.log("\n[2] Listing voices -- GET /voices ...");
  const data = await request("/voices");
  const voices = data.voices || [];
  console.log(`    OK  ${voices.length} voices available`);
  voices.slice(0, 5).forEach((v) => {
    console.log(`       - ${v.voice_id}  ${v.name}`);
  });
  if (voices.length > 5) console.log(`       ... and ${voices.length - 5} more`);
  return voices;
}

async function testTTS(voiceId) {
  console.log(`\n[3] Text-to-speech -- POST /text-to-speech/${voiceId} ...`);
  const audio = await request(`/text-to-speech/${voiceId}`, {
    method: "POST",
    body: {
      text: "I am Aarnav and I am short.",
      model_id: "eleven_flash_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    },
    acceptBinary: true,
  });
  const outPath = "test_output.mp3";
  fs.writeFileSync(outPath, audio);
  console.log(`    OK  ${audio.length} bytes written to ${outPath}`);
}

async function main() {
  console.log("==================================================");
  console.log("ElevenLabs API Test");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  try {
    await testAuth();
    passed++;
  } catch (e) {
    console.log(`    FAIL  ${e.message}`);
    failed++;
  }

  let voices = [];
  try {
    voices = await testListVoices();
    passed++;
  } catch (e) {
    console.log(`    FAIL  ${e.message}`);
    failed++;
  }

  if (voices.length > 0) {
    try {
      await testTTS(voices[0].voice_id);
      passed++;
    } catch (e) {
      console.log(`    FAIL  ${e.message}`);
      failed++;
    }
  } else {
    console.log("\n[3] Skipping TTS -- no voices available");
  }

  console.log("\n==================================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("==================================================");
  process.exit(failed === 0 ? 0 : 1);
}

main();
