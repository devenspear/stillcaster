import { NextRequest, NextResponse } from 'next/server'
import { createVoiceSynthesis, VoiceSynthesis } from '@/lib/voiceSynthesis'

// Standard test text for measuring WPM (exactly 100 words)
const TEST_TEXT_100_WORDS = `
Welcome to this peaceful meditation session. Take a moment to find a comfortable position.
Close your eyes gently and begin to notice your breath. Breathe in deeply through your nose,
filling your lungs completely. Hold for a moment. Now exhale slowly through your mouth,
releasing all tension. Feel your body becoming more relaxed with each breath. Notice the
gentle rise and fall of your chest. Let go of any thoughts that arise. Simply observe your
breath flowing in and out. You are safe. You are calm. You are present in this moment.
`.trim()

// Count words in text
function countWords(text: string): number {
  return text.trim().split(/\s+/).length
}

export async function POST(request: NextRequest) {
  try {
    const { voiceId } = await request.json()

    if (!voiceId) {
      return NextResponse.json(
        { error: 'voiceId is required' },
        { status: 400 }
      )
    }

    const voiceSynthesis = createVoiceSynthesis()

    // Check if ElevenLabs is available
    if (!(voiceSynthesis instanceof VoiceSynthesis)) {
      return NextResponse.json(
        { error: 'ElevenLabs API not available' },
        { status: 503 }
      )
    }

    console.log(`🧪 Testing WPM for voice: ${voiceId}`)
    console.log(`📝 Test text: ${TEST_TEXT_100_WORDS.substring(0, 100)}...`)
    console.log(`📊 Word count: ${countWords(TEST_TEXT_100_WORDS)} words`)

    const startTime = Date.now()

    // Generate audio
    const audioBuffer = await voiceSynthesis.synthesizeText(TEST_TEXT_100_WORDS, voiceId)

    const generationTime = Date.now() - startTime

    // Create audio element to measure duration
    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' })

    // We need to return the audio and let the client measure it
    // Server-side we can't accurately measure audio duration without decoding MP3

    const wordCount = countWords(TEST_TEXT_100_WORDS)

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'X-Word-Count': wordCount.toString(),
        'X-Generation-Time-Ms': generationTime.toString(),
        'X-Voice-Id': voiceId,
      },
    })

  } catch (error) {
    console.error('❌ WPM test error:', error)
    return NextResponse.json(
      {
        error: 'Failed to test WPM',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to return test page
export async function GET() {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>ElevenLabs Voice WPM Tester</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      background: #1a1a2e;
      color: #fff;
    }
    h1 {
      color: #6366f1;
      margin-bottom: 30px;
    }
    .voice-card {
      background: #2a2a3e;
      border: 1px solid #3a3a4e;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .voice-name {
      font-size: 18px;
      font-weight: 600;
      color: #a5b4fc;
      margin-bottom: 8px;
    }
    .voice-desc {
      font-size: 14px;
      color: #9ca3af;
      margin-bottom: 15px;
    }
    button {
      background: #6366f1;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      margin-right: 10px;
    }
    button:hover {
      background: #4f46e5;
    }
    button:disabled {
      background: #4b5563;
      cursor: not-allowed;
    }
    .results {
      margin-top: 15px;
      padding: 15px;
      background: #1e293b;
      border-radius: 8px;
      font-family: monospace;
      font-size: 13px;
    }
    .wpm {
      font-size: 24px;
      font-weight: 700;
      color: #34d399;
      margin-top: 10px;
    }
    .loading {
      color: #fbbf24;
    }
    .error {
      color: #f87171;
    }
  </style>
</head>
<body>
  <h1>🎙️ ElevenLabs Voice WPM Tester</h1>
  <p style="color: #9ca3af; margin-bottom: 30px;">
    Test each meditation voice to measure actual words per minute (WPM) for accurate script timing.
  </p>

  <div id="voices"></div>

  <script>
    const voices = [
      { id: 'female-1', name: 'Kelli-2', description: '50-year-old female, extremely pleasing and comforting for deep guided meditation' },
      { id: 'female-2', name: 'Sarah', description: 'Professional & reassuring' },
      { id: 'male-1', name: 'Bernard-1', description: 'Soft & subdued for meditations' },
      { id: 'male-2', name: 'George', description: 'Warm British resonance' }
    ];

    const WORD_COUNT = 100;
    let currentAudio = null;

    voices.forEach(voice => {
      const card = document.createElement('div');
      card.className = 'voice-card';
      card.innerHTML = \`
        <div class="voice-name">\${voice.name}</div>
        <div class="voice-desc">\${voice.description}</div>
        <button onclick="testVoice('\${voice.id}', this)">🧪 Test WPM</button>
        <button onclick="playAudio('\${voice.id}', this)" style="background: #10b981;">▶ Play</button>
        <div id="results-\${voice.id}" class="results" style="display: none;"></div>
      \`;
      document.getElementById('voices').appendChild(card);
    });

    async function testVoice(voiceId, button) {
      const resultsDiv = document.getElementById('results-' + voiceId);
      resultsDiv.style.display = 'block';
      resultsDiv.innerHTML = '<div class="loading">⏳ Testing voice...</div>';
      button.disabled = true;

      try {
        const startTime = Date.now();
        const response = await fetch('/api/voice/test-wpm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voiceId })
        });

        if (!response.ok) {
          throw new Error('Failed to generate test audio');
        }

        const generationTime = Date.now() - startTime;
        const wordCount = parseInt(response.headers.get('X-Word-Count') || '100');

        // Create audio element to measure duration
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        // Store for playback
        window['audio_' + voiceId] = audio;

        audio.onloadedmetadata = () => {
          const duration = audio.duration;
          const wpm = (wordCount / duration) * 60;

          resultsDiv.innerHTML = \`
            <strong>Test Results:</strong><br>
            📊 Words: \${wordCount}<br>
            ⏱️ Duration: \${duration.toFixed(2)}s<br>
            🎙️ Generation: \${generationTime}ms<br>
            <div class="wpm">\${wpm.toFixed(1)} WPM</div>
            <div style="margin-top: 10px; padding: 10px; background: #0f172a; border-radius: 6px;">
              <strong>For Script Generation:</strong><br>
              Use <span style="color: #34d399; font-weight: 700;">\${Math.floor(wpm)}</span> words per minute<br>
              <small style="color: #9ca3af;">with SSML pauses included</small>
            </div>
          \`;
          button.disabled = false;
        };

        audio.onerror = () => {
          resultsDiv.innerHTML = '<div class="error">❌ Error loading audio</div>';
          button.disabled = false;
        };

      } catch (error) {
        resultsDiv.innerHTML = '<div class="error">❌ Error: ' + error.message + '</div>';
        button.disabled = false;
      }
    }

    function playAudio(voiceId, button) {
      const audio = window['audio_' + voiceId];
      if (!audio) {
        alert('Please test the voice first to generate audio');
        return;
      }

      if (currentAudio && currentAudio !== audio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      currentAudio = audio;
      audio.play();
      button.textContent = '⏸ Playing...';

      audio.onended = () => {
        button.textContent = '▶ Play';
      };
    }
  </script>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
