export interface VoiceOptions {
  voice_id: string
  text: string
  model_id?: string
  // voice_settings omitted - ElevenLabs will use the voice profile defaults
}

export class VoiceSynthesis {
  private apiKey: string
  private baseUrl = 'https://api.elevenlabs.io/v1'

  // Available voices with their IDs
  private voices = {
    'female-1': {
      id: 'YRROo374F8CyWnUy6mdE', // Kelli-2 - your custom meditation voice
      name: 'Kelli-2',
      description: '50-year-old female, extremely pleasing and comforting for deep guided meditation'
    },
    'female-2': {
      id: 'lVmv79IJaUdqekJlBLHn', // Shelia-1 - custom meditation voice
      name: 'Shelia-1',
      description: 'Calming female voice for guided meditations'
    },
    'female-3': {
      id: 'Atp5cNFg1Wj5gyKD7HWV', // Natasha - meditation voice
      name: 'Natasha',
      description: 'Soothing female voice for meditation guidance'
    },
    'male-1': {
      id: 'xtwJZRzZhlI4QAgP0tT3', // Bernard-1 - custom meditation voice
      name: 'Bernard-1',
      description: 'Soft and subdued male voice, optimal for meditations and narrations'
    }
  }

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  // Clean and format meditation script text for natural TTS reading
  private processScriptText(text: string, speed: number = 0.85): string {
    let processedText = text

    // Remove script formatting tags that shouldn't be read aloud
    processedText = processedText.replace(/\[Pause\]/gi, '')
    processedText = processedText.replace(/\[Core Message\]/gi, '')
    processedText = processedText.replace(/\[Deep Breath\]/gi, '')
    processedText = processedText.replace(/\[Gentle Guidance\]/gi, '')
    processedText = processedText.replace(/\[Closing\]/gi, '')
    processedText = processedText.replace(/\[Introduction\]/gi, '')

    // Add natural pauses at sentence endings using SSML breaks
    // NOTE: Prosody rate control removed (was causing audio artifacts)
    // MEDITATION PACING: Longer pauses for deeper meditation experience
    processedText = processedText.replace(/\./g, '.<break time="2.5s"/>') // Increased from 1.5s
    processedText = processedText.replace(/,/g, ',<break time="1.2s"/>') // Increased from 0.8s
    processedText = processedText.replace(/:/g, ':<break time="1.5s"/>') // Increased from 1.0s
    processedText = processedText.replace(/;/g, ';<break time="1.5s"/>') // Increased from 1.0s

    // Add emphasis on key meditation words for natural delivery
    processedText = processedText.replace(/\b(breathe|breath|relax|release|peace|calm)\b/gi, '<emphasis level="moderate">$1</emphasis>')

    // Wrap in SSML speak tags (WITHOUT prosody rate - that caused compression artifacts)
    processedText = `<speak>${processedText}</speak>`

    return processedText
  }

  async synthesizeText(text: string, voiceId: string, speed: number = 0.85): Promise<ArrayBuffer> {
    const voice = this.voices[voiceId as keyof typeof this.voices]
    if (!voice) {
      throw new Error(`Voice ID ${voiceId} not found`)
    }

    // Process the text to remove formatting tags
    // NOTE: speed parameter currently ignored - control speed via ElevenLabs voice profile
    const processedText = this.processScriptText(text, speed)

    const options: VoiceOptions = {
      voice_id: voice.id,
      text: processedText,
      model_id: 'eleven_multilingual_v2'
      // Note: voice_settings intentionally omitted to use ElevenLabs voice profile defaults
    }

    try {
      const response = await fetch(`${this.baseUrl}/text-to-speech/${voice.id}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text: options.text,
          model_id: options.model_id
          // voice_settings omitted - uses voice profile defaults from ElevenLabs
        }),
      })

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`)
      }

      return await response.arrayBuffer()
    } catch (error) {
      console.error('Voice synthesis failed:', error)
      throw error
    }
  }

  async synthesizeScript(
    intro: string,
    main: string,
    closing: string,
    voiceId: string,
    onProgress?: (progress: number) => void
  ): Promise<{ intro: ArrayBuffer; main: ArrayBuffer; closing: ArrayBuffer }> {
    try {
      onProgress?.(0.1)
      const introAudio = await this.synthesizeText(intro, voiceId)

      onProgress?.(0.4)
      const mainAudio = await this.synthesizeText(main, voiceId)

      onProgress?.(0.8)
      const closingAudio = await this.synthesizeText(closing, voiceId)

      onProgress?.(1.0)

      return {
        intro: introAudio,
        main: mainAudio,
        closing: closingAudio
      }
    } catch (error) {
      console.error('Script synthesis failed:', error)
      throw error
    }
  }

  // Create audio URLs from ArrayBuffers for playback
  createAudioUrl(audioBuffer: ArrayBuffer): string {
    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' })
    return URL.createObjectURL(blob)
  }

  // Clean up created URLs to prevent memory leaks
  revokeAudioUrl(url: string) {
    URL.revokeObjectURL(url)
  }

  // Get available voices for UI selection
  getAvailableVoices() {
    return Object.entries(this.voices).map(([key, voice]) => ({
      id: key,
      name: voice.name,
      description: voice.description
    }))
  }

  // Preview a voice with sample text
  async previewVoice(voiceId: string): Promise<ArrayBuffer> {
    const sampleText = "Welcome to your personalized meditation session. Take a deep breath and let yourself relax."
    return await this.synthesizeText(sampleText, voiceId)
  }
}

// Fallback text-to-speech using browser's Speech Synthesis API
export class FallbackVoiceSynthesis {
  private synth: SpeechSynthesis | null = null
  private voices: SpeechSynthesisVoice[] = []

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis
      this.loadVoices()
    }
  }

  private loadVoices() {
    if (!this.synth) return

    this.voices = this.synth.getVoices()

    // If voices aren't loaded yet, wait for the voiceschanged event
    if (this.voices.length === 0) {
      this.synth.onvoiceschanged = () => {
        this.voices = this.synth!.getVoices()
      }
    }
  }

  async synthesizeText(text: string, voiceId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        reject(new Error('Speech synthesis not supported'))
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)

      // Select voice based on preference
      const preferredVoice = this.voices.find(voice =>
        voice.name.toLowerCase().includes('female') && voice.lang.includes('en')
      ) || this.voices.find(voice => voice.lang.includes('en')) || this.voices[0]

      if (preferredVoice) {
        utterance.voice = preferredVoice
      }

      // Set speech parameters for meditation
      utterance.rate = 0.7 // Slower speech
      utterance.pitch = 0.9 // Slightly lower pitch
      utterance.volume = 0.8

      utterance.onend = () => resolve()
      utterance.onerror = (event) => reject(new Error(event.error))

      this.synth.speak(utterance)
    })
  }

  getAvailableVoices() {
    return this.voices
      .filter(voice => voice.lang.includes('en'))
      .map(voice => ({
        id: voice.name,
        name: voice.name,
        description: `${voice.lang} - ${(voice as any).gender || 'Unknown'}`
      }))
  }

  // Preview a voice with sample text (fallback implementation)
  async previewVoice(voiceId: string): Promise<void> {
    const sampleText = "Welcome to your personalized meditation session."
    return await this.synthesizeText(sampleText, voiceId)
  }

  // Stub methods for compatibility
  createAudioUrl(audioBuffer: ArrayBuffer | void): string {
    return '' // No audio URL needed for browser TTS
  }

  revokeAudioUrl(url: string) {
    // No-op for browser TTS
  }
}

// Factory function
export const createVoiceSynthesis = (): VoiceSynthesis | FallbackVoiceSynthesis => {
  const apiKey = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY

  if (apiKey) {
    return new VoiceSynthesis(apiKey)
  } else {
    console.warn('ElevenLabs API key not found, using fallback browser speech synthesis')
    return new FallbackVoiceSynthesis()
  }
}