'use client'

import { useState, useEffect, useRef } from 'react'
import { useAppStore, type SessionConfig, type AssessmentData } from '@/lib/store'
import { getAudioEngine } from '@/lib/audioEngineV2'
import { type MeditationScript } from '@/lib/scriptGenerator'
import { createVoiceSynthesis, FallbackVoiceSynthesis } from '@/lib/voiceSynthesis'
import { createMusicSynthesis, type MusicGenerationOptions } from '@/lib/musicSynthesis'
import { DEFAULT_AUDIO_TIMING } from '@/lib/audioConfig'

// Audio timing configuration
const VOICE_START_DELAY = DEFAULT_AUDIO_TIMING.voiceStartDelay // Voice starts after music (10s)
const MUSIC_FADE_AFTER_VOICE = DEFAULT_AUDIO_TIMING.musicFadeAfterVoice // Music continues after voice (10s)

interface SessionPlayerProps {
  session: SessionConfig
  onClose: () => void
}

type SessionPhase = 'loading' | 'ready' | 'playing' | 'paused' | 'completed'

export default function SessionPlayer({ session, onClose }: SessionPlayerProps) {
  const [phase, setPhase] = useState<SessionPhase>('loading')

  // Update phase ref whenever phase changes
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])
  const [currentTime, setCurrentTime] = useState(0)
  const [totalTime, setTotalTime] = useState(session.duration * 60) // Convert to seconds
  const [actualVoiceDuration, setActualVoiceDuration] = useState(0) // Track actual voice duration
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingMessage, setLoadingMessage] = useState('Initializing...')
  const [volumes, setVolumes] = useState(session.layers)
  const [voiceSpeed, setVoiceSpeed] = useState(0.85) // Speaking rate: 0.85 = 85% of normal speed

  const audioEngine = useRef(getAudioEngine())
  const musicSynthesis = useRef(createMusicSynthesis())
  // Helper function to generate scripts with authentication
  const generateScript = async (assessmentData: AssessmentData, promptPrimer?: string): Promise<MeditationScript> => {
    // Always use authenticated production endpoint
    const { authClient } = await import('@/lib/authClient')
    const authToken = authClient.getToken()

    if (!authToken) {
      throw new Error('Authentication required. Please log in.')
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }

    const response = await fetch('/api/scripts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        assessment: assessmentData,
        promptPrimer: promptPrimer || assessmentData.userPrimer
      })
    })

    if (!response.ok) {
      const data = await response.json()

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.')
      }

      throw new Error(`HTTP ${response.status}: ${data.error || 'Script generation failed'}`)
    }

    const { script } = await response.json()
    return script
  }
  const voiceSynthesis = useRef(createVoiceSynthesis())
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const phaseRef = useRef<SessionPhase>('loading')
  const audioElementsRef = useRef<{
    intro?: HTMLAudioElement
    main?: HTMLAudioElement
    closing?: HTMLAudioElement
  }>({})

  const { saveSession, updateUserStats } = useAppStore()

  useEffect(() => {
    initializeSession()
    return () => {
      cleanup()
    }
  }, [])

  const initializeSession = async () => {
    try {
      setLoadingMessage('🤖 Generating personalized script with AI...')
      setLoadingProgress(0.1)

      // Generate the meditation script via API
      const script = await generateScript(session.assessment_data)

      console.log('📝 Script generated:', {
        hasScript: !!script,
        scriptType: typeof script,
        scriptKeys: script ? Object.keys(script) : [],
        hasIntroText: script?.intro_text !== undefined,
        hasMainContent: script?.main_content !== undefined,
        hasClosingText: script?.closing_text !== undefined,
        introLength: script?.intro_text?.length || 0,
        mainLength: script?.main_content?.length || 0,
        closingLength: script?.closing_text?.length || 0
      })
      console.log('📝 Full script object:', script)

      // Workaround: If main_content is missing or empty, use intro_text as fallback
      if (!script.main_content || script.main_content.trim().length === 0) {
        console.warn('⚠️ main_content is empty, using intro_text as fallback')
        script.main_content = script.intro_text || 'Take a deep breath and relax.'
      }

      setLoadingMessage('🎵 Loading background music...')
      setLoadingProgress(0.2)

      // Load simple MP3 background music
      if (session.layers.music_type === 'mp3' && session.layers.music_file) {
        try {
          console.log('🎵 Loading MP3 background music:', session.layers.music_file)

          const musicAudio = await audioEngine.current.playMusic(session.layers.music_file, session.layers.music_volume)
          musicAudio.pause() // Don't start playing yet
          musicAudio.loop = true // Loop the background music
          console.log('🎵 MP3 background music loaded and ready to play')
        } catch (musicError) {
          console.error('🎵 MP3 music loading failed:', musicError)
          setLoadingMessage('⚠️ Background music failed to load, continuing with voice only...')
        }
      } else {
        console.log('🎵 No MP3 music file specified, continuing without background music')
      }

      setLoadingMessage('🎙️ Creating voice audio with ElevenLabs...')
      setLoadingProgress(0.4)

      // Generate voice audio using server-side ElevenLabs API
      setLoadingMessage('🎙️ Generating voice narration with ElevenLabs...')
      setLoadingProgress(0.4)

      try {
        console.log('🎙️ Testing ElevenLabs availability via API...')

        // Test if ElevenLabs is available via server API
        const testResponse = await fetch('/api/voice/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voiceId: session.voice_id })
        })

        if (testResponse.ok) {
          console.log('✅ ElevenLabs API available, generating voice narration...')
          setLoadingMessage('🎙️ Synthesizing intro narration...')
          setLoadingProgress(0.5)

          // Generate each section via API
          console.log('🎙️ Requesting voice synthesis for all sections...')
          console.log('🎙️ Script data:', {
            hasIntroText: !!script.intro_text,
            hasMainContent: !!script.main_content,
            hasClosingText: !!script.closing_text,
            introLength: script.intro_text?.length || 0,
            mainLength: script.main_content?.length || 0,
            closingLength: script.closing_text?.length || 0,
            voiceId: session.voice_id
          })
          console.log('🎙️ Full script object:', script)

          const [introResponse, mainResponse, closingResponse] = await Promise.all([
            fetch('/api/voice/synthesize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: script.intro_text, voiceId: session.voice_id, speed: voiceSpeed })
            }),
            fetch('/api/voice/synthesize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: script.main_content, voiceId: session.voice_id, speed: voiceSpeed })
            }),
            fetch('/api/voice/synthesize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: script.closing_text, voiceId: session.voice_id, speed: voiceSpeed })
            })
          ])

          console.log('🎙️ Voice API responses:', {
            intro: { ok: introResponse.ok, status: introResponse.status, contentType: introResponse.headers.get('content-type') },
            main: { ok: mainResponse.ok, status: mainResponse.status, contentType: mainResponse.headers.get('content-type') },
            closing: { ok: closingResponse.ok, status: closingResponse.status, contentType: closingResponse.headers.get('content-type') }
          })

          // Check if all requests succeeded
          if (!introResponse.ok || !mainResponse.ok || !closingResponse.ok) {
            // Log detailed error info
            const errors = []
            if (!introResponse.ok) {
              const errorData = await introResponse.json().catch(() => ({ error: 'Unknown' }))
              errors.push(`Intro: ${introResponse.status} - ${JSON.stringify(errorData)}`)
            }
            if (!mainResponse.ok) {
              const errorData = await mainResponse.json().catch(() => ({ error: 'Unknown' }))
              errors.push(`Main: ${mainResponse.status} - ${JSON.stringify(errorData)}`)
            }
            if (!closingResponse.ok) {
              const errorData = await closingResponse.json().catch(() => ({ error: 'Unknown' }))
              errors.push(`Closing: ${closingResponse.status} - ${JSON.stringify(errorData)}`)
            }
            console.error('❌ Voice synthesis failures:', errors)
            throw new Error(`Voice synthesis failed: ${errors.join('; ')}`)
          }

          setLoadingMessage('🎙️ Creating audio elements...')
          setLoadingProgress(0.8)

          // Create audio elements from API responses
          console.log('🎙️ Converting responses to blobs...')
          const introBlob = await introResponse.blob()
          const mainBlob = await mainResponse.blob()
          const closingBlob = await closingResponse.blob()

          console.log('🎙️ Blob sizes:', {
            intro: introBlob.size,
            main: mainBlob.size,
            closing: closingBlob.size,
            introType: introBlob.type,
            mainType: mainBlob.type,
            closingType: closingBlob.type
          })

          const introUrl = URL.createObjectURL(introBlob)
          const mainUrl = URL.createObjectURL(mainBlob)
          const closingUrl = URL.createObjectURL(closingBlob)

          console.log('🎙️ Created blob URLs:', { introUrl, mainUrl, closingUrl })

          const introAudio = new Audio(introUrl)
          const mainAudio = new Audio(mainUrl)
          const closingAudio = new Audio(closingUrl)

          // Explicitly disable looping for voice narration
          introAudio.loop = false
          mainAudio.loop = false
          closingAudio.loop = false

          // Ensure normal playback speed (1.0 = 100% speed, no time stretching)
          introAudio.playbackRate = 1.0
          mainAudio.playbackRate = 1.0
          closingAudio.playbackRate = 1.0

          // Add error handlers
          introAudio.onerror = (e) => console.error('❌ Intro audio error:', e)
          mainAudio.onerror = (e) => console.error('❌ Main audio error:', e)
          closingAudio.onerror = (e) => console.error('❌ Closing audio error:', e)

          console.log('🎙️ Audio elements created successfully')

          // Set up sequential playback - intro -> main -> closing
          introAudio.onended = () => {
            console.log('🎙️ Intro audio finished, starting main content...')
            if (audioElementsRef.current.main && phaseRef.current === 'playing') {
              audioElementsRef.current.main.volume = volumes.voice_volume
              audioElementsRef.current.main.play()
            }
          }

          mainAudio.onended = () => {
            console.log('🎙️ Main audio finished, starting closing...')
            if (audioElementsRef.current.closing && phaseRef.current === 'playing') {
              audioElementsRef.current.closing.volume = volumes.voice_volume
              audioElementsRef.current.closing.play()
            }
          }

          closingAudio.onended = () => {
            console.log('🎙️ All voice segments completed')
            // Music will continue and fade out based on the timer reaching totalTime
            // The timer handles the final 5-second fade and session completion
          }

          audioElementsRef.current.intro = introAudio
          audioElementsRef.current.main = mainAudio
          audioElementsRef.current.closing = closingAudio

          // Calculate total voice duration
          setLoadingMessage('🔍 Calculating voice duration...')
          await Promise.all([
            new Promise(resolve => {
              introAudio.onloadedmetadata = resolve
              introAudio.load()
            }),
            new Promise(resolve => {
              mainAudio.onloadedmetadata = resolve
              mainAudio.load()
            }),
            new Promise(resolve => {
              closingAudio.onloadedmetadata = resolve
              closingAudio.load()
            })
          ])

          const totalVoiceDuration = introAudio.duration + mainAudio.duration + closingAudio.duration
          console.log('🎙️ ElevenLabs voice durations:', {
            intro: introAudio.duration,
            main: mainAudio.duration,
            closing: closingAudio.duration,
            total: totalVoiceDuration
          })

          setActualVoiceDuration(totalVoiceDuration)

          // FLEXIBLE DURATION: Use actual voice duration + music fades
          // - 10s music intro (before voice starts)
          // - Actual voice narration duration (natural pace, no rushing!)
          // - 10s music outro (after voice ends)
          const actualSessionDuration = VOICE_START_DELAY + totalVoiceDuration + MUSIC_FADE_AFTER_VOICE

          console.log(`⏱️ Session Duration (FLEXIBLE - based on actual voice):`)
          console.log(`   Music Intro: ${VOICE_START_DELAY}s`)
          console.log(`   Voice Narration: ${totalVoiceDuration.toFixed(1)}s`)
          console.log(`   Music Outro: ${MUSIC_FADE_AFTER_VOICE}s`)
          console.log(`   Total Session: ${actualSessionDuration.toFixed(1)}s (~${(actualSessionDuration / 60).toFixed(1)} min)`)
          console.log(`   Requested Duration: ${session.duration} min (${totalTime}s)`)
          console.log(`   Difference: ${(actualSessionDuration - totalTime).toFixed(1)}s`)

          // Update total time to actual duration
          setTotalTime(Math.ceil(actualSessionDuration))

          setLoadingMessage('✅ ElevenLabs voice ready!')

        } else {
          const errorData = await testResponse.json()
          console.log('❌ ElevenLabs API not available:', errorData)
          setLoadingMessage('🔊 ElevenLabs unavailable, using browser speech...')
        }

      } catch (voiceError) {
        console.error('🎙️ Voice generation failed:', voiceError)
        setLoadingMessage('🔊 Voice generation failed, using browser speech...')
      }

      setLoadingMessage('🔊 Setting up audio playback...')
      setLoadingProgress(0.8)

      // Initialize audio engine
      await audioEngine.current.resumeAudioContext()

      setLoadingProgress(1.0)
      setLoadingMessage('✅ Session ready!')
      setTimeout(() => setPhase('ready'), 500)

    } catch (error) {
      console.error('Session initialization failed:', error)
      setLoadingMessage('⚠️ ElevenLabs unavailable. Using fallback audio.')
      setTimeout(() => setPhase('ready'), 1000)
    }
  }

  const startSession = async () => {
    try {
      setPhase('playing')

      // Debug music audio state
      const musicAudio = audioEngine.current.getMusicAudio()
      console.log('🎵 Music audio state:', {
        musicAudioExists: !!musicAudio,
        musicAudioSrc: musicAudio?.src,
        musicVolume: volumes.music_volume
      })

      // Resume/start music if it was set up during initialization
      if (musicAudio) {
        console.log('🎵 Starting music playback...')
        musicAudio.volume = volumes.music_volume
        try {
          await musicAudio.play()
          console.log('🎵 Music started successfully')
        } catch (musicError) {
          console.error('🎵 Music playback failed:', musicError)
        }
      } else {
        console.warn('🎵 No music audio available - background music will not play')
      }

      // Start voice guidance (either ElevenLabs audio or fallback TTS)
      if (audioElementsRef.current.intro) {
        console.log(`🎙️ Voice narration will start in ${VOICE_START_DELAY} seconds...`, {
          hasIntro: !!audioElementsRef.current.intro,
          hasMain: !!audioElementsRef.current.main,
          hasClosing: !!audioElementsRef.current.closing,
          introSrc: audioElementsRef.current.intro.src,
          volume: volumes.voice_volume,
          delay: VOICE_START_DELAY
        })

        // Delay voice start to allow music to establish
        setTimeout(() => {
          if (audioElementsRef.current.intro && phaseRef.current === 'playing') {
            console.log('🎙️ Starting ElevenLabs voice narration NOW...')
            audioElementsRef.current.intro.volume = volumes.voice_volume
            audioElementsRef.current.intro.play()
              .then(() => console.log('✅ Intro audio started playing'))
              .catch(err => console.error('❌ Failed to start intro audio:', err))
          }
        }, VOICE_START_DELAY * 1000)
      } else {
        // Use browser TTS for fallback - generate script via API
        console.log('🎙️ Using browser speech synthesis fallback')
        try {
          const script = await generateScript(session.assessment_data)
          setTimeout(() => {
            voiceSynthesis.current.synthesizeText(script.intro_text, session.voice_id)
          }, 1000)
        } catch (error) {
          console.error('Failed to generate script for fallback TTS:', error)
        }
      }

      // Start timer
      startTimer()

    } catch (error) {
      console.error('Failed to start session:', error)
    }
  }

  const pauseSession = () => {
    setPhase('paused')
    audioEngine.current.pauseAll()

    // Pause all voice audio elements
    Object.values(audioElementsRef.current).forEach(audio => {
      if (audio && !audio.paused) {
        audio.pause()
        console.log('🎙️ Paused voice audio')
      }
    })

    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
  }

  const resumeSession = async () => {
    setPhase('playing')

    // Resume music if it exists
    const musicAudio = audioEngine.current.getMusicAudio()
    if (musicAudio) {
      console.log('🎵 Resuming music playback...')
      musicAudio.volume = volumes.music_volume
      try {
        await musicAudio.play()
        console.log('🎵 Music resumed successfully')
      } catch (musicError) {
        console.error('🎵 Music resume failed:', musicError)
      }
    }

    // Resume currently paused voice audio (if any)
    const pausedAudio = Object.values(audioElementsRef.current).find(audio =>
      audio && audio.paused && audio.currentTime > 0 && audio.currentTime < audio.duration
    )

    if (pausedAudio) {
      console.log('🎙️ Resuming voice audio from where it was paused...')
      pausedAudio.volume = volumes.voice_volume
      try {
        await pausedAudio.play()
      } catch (error) {
        console.error('🎙️ Voice resume failed:', error)
      }
    } else if (audioElementsRef.current.intro && audioElementsRef.current.intro.currentTime === 0) {
      // If no audio has started yet, start from the beginning
      console.log('🎙️ Starting voice narration from the beginning...')
      audioElementsRef.current.intro.volume = volumes.voice_volume
      audioElementsRef.current.intro.play()
    }

    // Resume timer
    startTimer()
  }

  const stopSession = () => {
    setPhase('completed')
    audioEngine.current.stopAll()

    Object.values(audioElementsRef.current).forEach(audio => {
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }
    })

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Update user stats
    updateUserStats(Math.floor(currentTime / 60))
  }

  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    timerRef.current = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 1

        // Implement music fade-out during final 5 seconds
        const remainingTime = totalTime - newTime
        if (remainingTime <= 5 && remainingTime > 0) {
          const musicAudio = audioEngine.current.getMusicAudio()
          if (musicAudio) {
            const fadeVolume = (remainingTime / 5) * volumes.music_volume
            musicAudio.volume = fadeVolume
            audioEngine.current.setMusicVolume(fadeVolume)
          }
        }

        // End session when requested time is reached
        if (newTime >= totalTime) {
          console.log('⏰ Session time complete - stopping session')
          stopSession()
          return totalTime
        }

        return newTime
      })
    }, 1000)
  }

  const cleanup = () => {
    audioEngine.current.stopAll()
    musicSynthesis.current.cleanupAll()

    Object.values(audioElementsRef.current).forEach(audio => {
      if (audio) {
        audio.pause()
        URL.revokeObjectURL(audio.src)
      }
    })

    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
  }

  const handleVolumeChange = (layer: keyof typeof volumes, value: number) => {
    const newVolumes = { ...volumes, [layer]: value }
    setVolumes(newVolumes)

    console.log(`🔊 Volume change: ${layer} = ${value}`)

    // Apply volume changes in real-time
    if (phase === 'playing') {
      if (layer === 'music_volume') {
        console.log('🎵 Applying music volume change:', value)
        audioEngine.current.setMusicVolume(value)

        // Also directly update the HTML audio element if available
        const musicAudio = audioEngine.current.getMusicAudio()
        if (musicAudio) {
          musicAudio.volume = value
          console.log('🎵 Music audio volume updated directly:', musicAudio.volume)
        }
      } else if (layer === 'voice_volume') {
        console.log('🎙️ Applying voice volume change:', value)
        Object.values(audioElementsRef.current).forEach(audio => {
          if (audio) {
            audio.volume = value
            console.log('🎙️ Voice audio volume updated:', audio.volume)
          }
        })
      }
    }
  }

  const handleSaveSession = () => {
    const updatedSession = {
      ...session,
      layers: volumes
    }
    saveSession(updatedSession)
    // Sessions are saved locally only
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = (currentTime / totalTime) * 100

  if (phase === 'loading') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          {/* Enhanced breathing animation circle to match AppleProgress */}
          <div className="w-32 h-32 mx-auto mb-8 relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 opacity-20 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 opacity-40 animate-pulse" />
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-4">Preparing Your Session</h2>

          {/* Enhanced loading message with engaging text */}
          <p className="text-white text-lg font-medium mb-2">{loadingMessage}</p>

          {/* Engaging sub-text to keep user focused */}
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            {loadingProgress < 0.3 ? "✨ Crafting your personalized journey..." :
             loadingProgress < 0.6 ? "🎙️ Preparing soothing guidance..." :
             loadingProgress < 0.8 ? "🎵 Setting the perfect atmosphere..." :
             "🧘‍♀️ Almost ready for your meditation..."}
          </p>

          {/* Progress bar matching AppleProgress */}
          <div className="w-full bg-gray-800 rounded-full h-3 mb-4 overflow-hidden">
            <div
              className="h-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${loadingProgress * 100}%` }}
            />
          </div>

          {/* Percentage */}
          <p className="text-gray-400 text-sm">{Math.round(loadingProgress * 100)}%</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-9 h-9 bg-gray-800/50 rounded-full flex items-center justify-center text-gray-400 no-select"
          >
            <span className="text-lg">←</span>
          </button>
          <div className="text-center">
            <h1 className="text-lg font-bold text-white">{session.name}</h1>
            <p className="text-xs text-gray-400">
              {session.layers.music_type} • ~{Math.ceil(totalTime / 60)} min
            </p>
          </div>
          <div className="w-9 h-9"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-6 py-8 flex flex-col items-center justify-center">
        {/* Breathing Animation */}
        <div className={`w-80 h-80 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-8 shadow-2xl ${phase === 'playing' ? 'breathing-animation' : ''}`}>
          <div className="w-40 h-40 rounded-full bg-white/20 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-white/30" />
          </div>
        </div>

        {/* Timer */}
        <div className="text-center mb-8">
          <div className="text-3xl font-mono font-bold text-white mb-4">
            {formatTime(currentTime)}
          </div>
          <div className="w-64 bg-gray-800 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-400 mt-2">
            ~{Math.ceil(totalTime / 60)} min total
            {actualVoiceDuration > 0 && (
              <span className="text-xs text-gray-500 ml-2">
                (natural pace)
              </span>
            )}
          </p>

          {phase === 'ready' && voiceSynthesis.current.constructor.name === 'VoiceSynthesis' && (
            <div className="mt-4 flex items-center justify-center space-x-2">
              <span className="text-xs text-gray-500">Powered by</span>
              <span className="text-xs text-blue-400 font-semibold">ElevenLabs AI</span>
              <span className="text-xs">🎙️</span>
            </div>
          )}
        </div>

        {/* Playback Controls */}
        <div className="w-full max-w-xs">
          {phase === 'ready' && (
            <button
              onClick={startSession}
              className="ios-button mb-4"
            >
              <span className="text-lg mr-2">▶</span>
              Start Session
            </button>
          )}

          {phase === 'playing' && (
            <button
              onClick={pauseSession}
              className="ios-button mb-4"
            >
              <span className="text-lg mr-2">⏸</span>
              Pause
            </button>
          )}

          {phase === 'paused' && (
            <div className="space-y-3 mb-4">
              <button
                onClick={resumeSession}
                className="ios-button"
              >
                <span className="text-lg mr-2">▶</span>
                Resume
              </button>
              <button
                onClick={stopSession}
                className="w-full py-3 bg-red-600 rounded-2xl text-white font-semibold active:scale-98 transition-transform"
              >
                <span className="text-lg mr-2">⏹</span>
                Stop Session
              </button>
            </div>
          )}

          {phase === 'completed' && (
            <div className="text-center mb-4">
              <p className="text-lg text-white mb-4">🧘‍♀️ Session Complete!</p>
              <button
                onClick={onClose}
                className="ios-button bg-green-600"
              >
                Finish
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Volume Controls - Bottom Sheet Style */}
      <div className="bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 px-6 py-6">
        <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-6"></div>

        <h3 className="text-lg font-bold text-white mb-4 text-center">Audio Mix</h3>

        <div className="space-y-6 max-w-sm mx-auto">
          {/* Music Volume */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-white font-medium">🎼 Background Music</label>
              <span className="text-gray-400 text-sm">{Math.round(volumes.music_volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volumes.music_volume}
              onChange={(e) => handleVolumeChange('music_volume', parseFloat(e.target.value))}
              className="ios-slider"
            />
          </div>

          {/* Voice Volume */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-white font-medium">🎙️ Voice Guidance</label>
              <span className="text-gray-400 text-sm">{Math.round(volumes.voice_volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volumes.voice_volume}
              onChange={(e) => handleVolumeChange('voice_volume', parseFloat(e.target.value))}
              className="ios-slider"
            />
          </div>

          {/* Voice Speed - TEMPORARILY DISABLED */}
          <div className="opacity-50">
            <div className="flex justify-between items-center mb-3">
              <label className="text-white font-medium">⚡ Voice Speed</label>
              <span className="text-gray-400 text-sm">{Math.round(voiceSpeed * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.65"
              max="1.15"
              step="0.05"
              value={voiceSpeed}
              onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
              className="ios-slider"
              disabled={true}
            />
            <p className="text-xs text-gray-500 mt-2">
              ⚠️ Temporarily disabled - Speed controlled via ElevenLabs voice profile
            </p>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveSession}
            className="w-full py-3 bg-purple-600 rounded-2xl text-white font-semibold active:scale-98 transition-transform mt-6"
          >
            💾 Save Configuration
          </button>
        </div>

        {/* Safe Area Bottom */}
        <div className="h-8"></div>
      </div>
    </div>
  )
}