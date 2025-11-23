'use client'

import { useState } from 'react'
import { type SessionConfig, type AssessmentData } from '@/lib/store'
import { createVoiceSynthesis } from '@/lib/voiceSynthesis'
import { WISDOM_SOURCES, FEELING_OPTIONS, GOAL_OPTIONS } from '@/lib/promptConstants'
import { PRIMARY_THEMES, ATMOSPHERIC_ELEMENTS, SOUNDSCAPE_JOURNEYS } from '@/lib/musicConstants'
import type { PrimaryTheme, AtmosphericElement, SoundscapeJourney } from '@/lib/musicConstants'
import { AppleToggle, AppleCard, AppleProgress, ApplePillButton } from './AppleUI'

const VOICES = [
  { id: 'female-1', name: 'Kelli-2', description: '50-year-old female, extremely pleasing and comforting for deep guided meditation', icon: '🎙️' },
  { id: 'female-2', name: 'Shelia-1', description: 'Calming female voice for guided meditations', icon: '🎙️' },
  { id: 'male-1', name: 'Bernard-1', description: 'Soft & subdued for meditations', icon: '🎙️' },
]

const SURVEY_QUESTIONS = [
  {
    id: 'currentState',
    question: 'How are you feeling right now?',
    options: [
      { id: 'stressed', label: 'Stressed or Anxious', icon: '😰' },
      { id: 'tired', label: 'Tired or Fatigued', icon: '😴' },
      { id: 'restless', label: 'Restless or Distracted', icon: '🌪️' },
      { id: 'neutral', label: 'Neutral or Calm', icon: '😌' },
      { id: 'energetic', label: 'Energetic but Need Focus', icon: '⚡' },
    ]
  },
  {
    id: 'experience',
    question: 'What\'s your meditation experience?',
    options: [
      { id: 'beginner', label: 'New to Meditation', icon: '🌱' },
      { id: 'some', label: 'Some Experience', icon: '🌿' },
      { id: 'regular', label: 'Regular Practice', icon: '🌳' },
      { id: 'advanced', label: 'Very Experienced', icon: '🧘‍♂️' },
    ]
  },
  {
    id: 'environment',
    question: 'Where will you be meditating?',
    options: [
      { id: 'quiet', label: 'Quiet Private Space', icon: '🏠' },
      { id: 'busy', label: 'Busy Environment', icon: '🏢' },
      { id: 'nature', label: 'Outdoors/Nature', icon: '🌲' },
      { id: 'travel', label: 'Traveling/Transit', icon: '✈️' },
    ]
  }
]

const DURATIONS = [
  { id: 1, label: 'Under 1 minute', description: 'Quick reset' },
  { id: 3, label: 'Under 3 minutes', description: 'Brief session' },
  { id: 5, label: 'Under 5 minutes', description: 'Short practice' },
]

interface Props {
  onComplete: (sessionConfig: SessionConfig) => void
  onCancel: () => void
}

export default function AssessmentFlow({ onComplete, onCancel }: Props) {
  // Steps: 1: Goal, 2: Wisdom, 3: Feelings, 4: Survey, 5: Duration, 6: Music Selection (Local MP3), 7: Primer, 8: Generating, 9: Review, 10: Voice
  const [step, setStep] = useState(1)
  const [selectedGoal, setSelectedGoal] = useState('')
  const [selectedWisdom, setSelectedWisdom] = useState('Default/Universal')
  const [selectedFeelings, setSelectedFeelings] = useState<string[]>([])
  const [selectedVoice, setSelectedVoice] = useState('female-1')
  const [selectedDuration, setSelectedDuration] = useState(3)
  const [promptPrimer, setPromptPrimer] = useState('')
  const [generatedScript, setGeneratedScript] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationMessage, setGenerationMessage] = useState('Preparing your meditation...')

  // Music selection state - simplified to single local MP3
  const [selectedMusic, setSelectedMusic] = useState('StillCaster Ambient - 5 Minutes')
  // Comment out for future ElevenLabs integration:
  // const [selectedPrimaryTheme, setSelectedPrimaryTheme] = useState<PrimaryTheme | null>(null)
  // const [selectedAtmosphericElements, setSelectedAtmosphericElements] = useState<AtmosphericElement[]>([])
  // const [selectedSoundscapeJourney, setSelectedSoundscapeJourney] = useState<SoundscapeJourney | null>(null)
  const [assessment, setAssessment] = useState<AssessmentData>({
    goal: '',
    currentState: '',
    duration: 3,
    experience: '',
    timeOfDay: '',
    environment: '',
    wisdomSource: 'Default/Universal',
    selectedFeelings: [],
    userPrimer: '',
  })

  const handleGoalSelect = (goal: string) => {
    setSelectedGoal(goal)
    setAssessment(prev => ({ ...prev, goal }))
  }

  const handleContinueFromGoal = () => {
    if (selectedGoal) {
      setStep(2)
    }
  }

  const handleWisdomSelect = (wisdom: string) => {
    setSelectedWisdom(wisdom)
    setAssessment(prev => ({ ...prev, wisdomSource: wisdom }))
  }

  const handleContinueFromWisdom = () => {
    setStep(3)
  }

  const handleFeelingToggle = (feeling: string) => {
    const newFeelings = selectedFeelings.includes(feeling)
      ? selectedFeelings.filter(f => f !== feeling)
      : [...selectedFeelings, feeling]

    setSelectedFeelings(newFeelings)
    setAssessment(prev => ({ ...prev, selectedFeelings: newFeelings }))
  }

  const handleContinueFromFeelings = () => {
    setStep(4)
  }

  const handleSurveyAnswer = (questionId: string, answer: string) => {
    setAssessment(prev => ({ ...prev, [questionId]: answer }))
  }

  const handleContinueFromSurvey = () => {
    const requiredAnswers = ['currentState', 'experience', 'environment']
    const hasAllAnswers = requiredAnswers.every(key => assessment[key as keyof AssessmentData])
    if (hasAllAnswers) {
      setStep(5)
    }
  }

  const handleDurationSelect = (duration: number) => {
    setSelectedDuration(duration)
    setAssessment(prev => ({ ...prev, duration }))
    setStep(6) // Go directly to music selection (simplified)
  }

  // Simplified music selection handler
  const handleMusicSelect = (musicName: string) => {
    setSelectedMusic(musicName)
  }

  const handleContinueFromMusic = () => {
    setStep(7) // Go to primer step
  }

  // Comment out complex music generation handlers for future ElevenLabs integration:
  // const handlePrimaryThemeSelect = (theme: PrimaryTheme) => { ... }
  // const handleContinueFromTheme = () => { ... }
  // const handleAtmosphericElementToggle = (element: AtmosphericElement) => { ... }
  // const handleContinueFromAtmospheric = () => { ... }
  // const handleSoundscapeJourneySelect = (journey: SoundscapeJourney) => { ... }
  // const handleContinueFromJourney = () => { ... }

  const handleContinueFromPrimer = () => {
    setStep(8) // Updated step number for generating
    generateScript()
  }

  const generateScript = async () => {
    setIsGenerating(true)
    setGenerationProgress(0)
    setGenerationMessage('🤖 Analyzing your preferences...')

    try {
      // Progress updates during generation
      setTimeout(() => {
        setGenerationProgress(0.2)
        setGenerationMessage('🧠 Generating personalized meditation script...')
      }, 500)

      // Always use authenticated production endpoint
      const { authClient } = await import('@/lib/authClient')
      const authToken = authClient.getToken()

      if (!authToken) {
        throw new Error('Authentication required. Please log in.')
      }

      setTimeout(() => {
        setGenerationProgress(0.5)
        setGenerationMessage('✨ Crafting your unique meditation journey...')
      }, 1500)

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }

      const response = await fetch('/api/scripts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          assessment: {
            ...assessment,
            goal: selectedGoal,
            duration: selectedDuration,
            wisdomSource: selectedWisdom,
            selectedFeelings: selectedFeelings,
            userPrimer: promptPrimer
          },
          promptPrimer
        })
      })

      setGenerationProgress(0.8)
      setGenerationMessage('🎯 Finalizing your meditation...')

      if (response.ok) {
        const { script } = await response.json()
        let scriptText = ''

        if (script.title) {
          scriptText += script.title + '\\n\\n'
        }
        scriptText += script.intro_text + '\\n\\n' + script.main_content + '\\n\\n' + script.closing_text

        setGeneratedScript(scriptText)
        setGenerationProgress(1.0)
        setGenerationMessage('✅ Your meditation is ready!')

        setTimeout(() => {
          setStep(9) // Updated step number for Review
        }, 1000)
      } else {
        const data = await response.json()

        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.')
        }

        throw new Error(`HTTP ${response.status}: ${data.error || 'Script generation failed'}`)
      }
    } catch (error) {
      console.error('Script generation failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate meditation script. Please try again.'
      alert(errorMessage)
      setStep(7) // Go back to primer step
    } finally {
      setIsGenerating(false)
    }
  }

  const handleContinueFromReview = () => {
    setStep(10) // Updated step number for Voice selection
  }

  const handleVoicePreview = async (voiceId: string) => {
    if (isPlaying) return

    try {
      setIsPlaying(true)

      // Try server-side ElevenLabs API first
      const response = await fetch('/api/voice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId })
      })

      if (response.ok) {
        // ElevenLabs API succeeded
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)

        audio.play()
        audio.onended = () => {
          setIsPlaying(false)
          URL.revokeObjectURL(audioUrl)
        }
        audio.onerror = () => {
          setIsPlaying(false)
          URL.revokeObjectURL(audioUrl)
        }
      } else {
        // Fallback to browser TTS
        const voiceSynthesis = createVoiceSynthesis()
        await voiceSynthesis.previewVoice(voiceId)
        setIsPlaying(false)
      }
    } catch (error) {
      console.error('Voice preview failed:', error)
      // Fallback to browser TTS
      try {
        const voiceSynthesis = createVoiceSynthesis()
        await voiceSynthesis.previewVoice(voiceId)
      } catch (fallbackError) {
        console.error('Fallback TTS also failed:', fallbackError)
      }
      setIsPlaying(false)
    }
  }

  const handleCreateSession = () => {
    const sessionConfig: SessionConfig = {
      name: `${selectedGoal.charAt(0).toUpperCase() + selectedGoal.slice(1)} Session`,
      description: `${selectedDuration} minute ${selectedGoal} session with AI-generated guidance`,
      duration: selectedDuration,
      voice_id: selectedVoice,
      layers: {
        music_volume: 0.4,
        voice_volume: 0.8,
        music_type: 'mp3', // Changed from 'ambient' to 'mp3'
        music_file: '/MusicBed5min.mp3', // Added MP3 file path
      },
      assessment_data: {
        ...assessment,
        goal: selectedGoal,
        wisdomSource: selectedWisdom,
        selectedFeelings: selectedFeelings,
        userPrimer: promptPrimer,
        selectedMusic: selectedMusic, // Add simple music selection
        // Comment out complex music generation for future ElevenLabs integration:
        // selectedPrimaryTheme: selectedPrimaryTheme || undefined,
        // selectedAtmosphericElements: selectedAtmosphericElements || undefined,
        // selectedSoundscapeJourney: selectedSoundscapeJourney || undefined
      },
    }
    onComplete(sessionConfig)
  }

  const renderFooterButton = () => {
    // Don't show footer button for generation step
    if (step === 8) return null

    if (step === 1) {
      return selectedGoal ? (
        <button
          onClick={handleContinueFromGoal}
          className="w-full py-3 rounded-xl font-semibold text-base bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
        >
          Continue
        </button>
      ) : null
    }

    if (step === 2) {
      return (
        <button
          onClick={handleContinueFromWisdom}
          className="w-full py-3 rounded-xl font-semibold text-base bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
        >
          Continue
        </button>
      )
    }

    if (step === 3) {
      return (
        <button
          onClick={handleContinueFromFeelings}
          className="w-full py-3 rounded-xl font-semibold text-base bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
        >
          Continue
        </button>
      )
    }

    if (step === 4) {
      const hasAllAnswers = ['currentState', 'experience', 'environment'].every(key =>
        assessment[key as keyof typeof assessment]
      )
      return (
        <button
          onClick={handleContinueFromSurvey}
          disabled={!hasAllAnswers}
          className={`w-full py-3 rounded-xl font-semibold text-base transition-all ${
            hasAllAnswers
              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30 active:scale-95'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          Continue
        </button>
      )
    }

    if (step === 5) {
      // Duration step auto-continues, no button needed
      return null
    }

    if (step === 6) {
      // Simple music selection step
      return (
        <button
          onClick={handleContinueFromMusic}
          className="w-full py-3 rounded-xl font-semibold text-base bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
        >
          Continue
        </button>
      )
    }

    if (step === 7) {
      return (
        <button
          onClick={handleContinueFromPrimer}
          className="w-full py-3 rounded-xl font-semibold text-base bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
        >
          <div className="flex items-center justify-center space-x-2">
            <span className="text-lg">✨</span>
            <span>Generate Script</span>
          </div>
        </button>
      )
    }

    if (step === 9) {
      return (
        <button
          onClick={handleContinueFromReview}
          className="w-full py-3 rounded-xl font-semibold text-base bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
        >
          Choose Voice
        </button>
      )
    }

    if (step === 10) {
      return (
        <button
          onClick={handleCreateSession}
          className="w-full py-3 rounded-xl font-semibold text-base bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
        >
          Create Session
        </button>
      )
    }

    return null
  }

  return (
    <div className="h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black text-white flex flex-col overflow-hidden">
      {/* Fixed Header - Compact */}
      <div className="flex-shrink-0 bg-black/50 backdrop-blur-xl border-b border-gray-800/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={step === 1 ? onCancel : () => setStep(step - 1)}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-800/60 to-gray-900/60 flex items-center justify-center text-blue-400 active:scale-95 transition-all shadow-lg"
          >
            {step === 1 ? '✕' : '←'}
          </button>
          <div className="text-base font-semibold text-white">
            {step === 1 && 'Choose Goal'}
            {step === 2 && 'Wisdom Source'}
            {step === 3 && 'Feelings'}
            {step === 4 && 'About You'}
            {step === 5 && 'Duration'}
            {step === 6 && 'Background Music'}
            {step === 7 && 'Customize'}
            {step === 8 && 'Generating...'}
            {step === 9 && 'Review Script'}
            {step === 10 && 'Choose Voice'}
          </div>
          <div className="w-9"></div>
        </div>

        {/* Progress Indicator - Compact */}
        <div className="px-4 pb-3">
          <div className="flex space-x-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((stepNum) => (
              <div
                key={stepNum}
                className={`h-0.5 flex-1 rounded-full transition-colors ${
                  stepNum <= step ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable Content - Compact */}
      <div className="flex-1 overflow-y-auto scroll-smooth">
        <div className="p-4 pb-24">

          {/* Step 1: Goal Selection */}
          {step === 1 && (
              <>
                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-white mb-2">
                    What's your intention?
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Choose your primary focus for this meditation.
                  </p>
                </div>

                <div className="space-y-3 mb-4">
                  {GOAL_OPTIONS.map((goal, index) => {
                    const gradients = [
                      'from-blue-500 to-cyan-400',
                      'from-green-500 to-emerald-400',
                      'from-purple-500 to-pink-400',
                      'from-orange-500 to-red-400',
                      'from-indigo-500 to-purple-600',
                      'from-teal-500 to-cyan-400',
                      'from-pink-500 to-rose-400',
                      'from-yellow-500 to-orange-400'
                    ];

                    return (
                      <AppleCard
                        key={goal.goal}
                        isSelected={selectedGoal === goal.goal}
                        onChange={() => handleGoalSelect(goal.goal)}
                        title={goal.goal}
                        subtitle={goal.coreFocus}
                        gradient={gradients[index % gradients.length]}
                      />
                    );
                  })}
                </div>
              </>
            )}

          {/* Step 2: Wisdom Source Selection */}
          {step === 2 && (
              <>
                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-white mb-2">
                    Choose Your Wisdom Source
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Select the philosophical foundation for your meditation.
                  </p>
                </div>

                <div className="space-y-3 mb-4">
                  {WISDOM_SOURCES.map((source, index) => {
                    const gradients = [
                      'from-amber-500 to-orange-400',
                      'from-blue-500 to-indigo-400',
                      'from-green-500 to-teal-400',
                      'from-purple-500 to-violet-400',
                      'from-red-500 to-pink-400',
                      'from-cyan-500 to-blue-400'
                    ];

                    return (
                      <AppleCard
                        key={source.internalKeyword}
                        isSelected={selectedWisdom === source.internalKeyword}
                        onChange={() => handleWisdomSelect(source.internalKeyword)}
                        title={source.displayName}
                        subtitle={source.conceptSnippet}
                        gradient={gradients[index % gradients.length]}
                      />
                    );
                  })}
                </div>
              </>
            )}

          {/* Step 3: Feelings to Transcend (Apple-style toggles) */}
          {step === 3 && (
              <>
                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-white mb-2">
                    What would you like to transform?
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Select any feelings you'd like to transcend. (Optional)
                  </p>
                </div>

                <div className="space-y-3 mb-4">
                  {FEELING_OPTIONS.map((feeling) => (
                    <AppleToggle
                      key={feeling.feeling}
                      isSelected={selectedFeelings.includes(feeling.feeling)}
                      onChange={() => handleFeelingToggle(feeling.feeling)}
                      description={`Transforms to: ${feeling.antidoteThemes}`}
                    >
                      {feeling.feeling}
                    </AppleToggle>
                  ))}
                </div>
              </>
            )}

          {/* Step 4: Survey Questions (Apple-style) */}
          {step === 4 && (
              <>
                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-white mb-2">
                    About You
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Help us personalize your meditation experience.
                  </p>
                </div>

                <div className="space-y-4">
                  {SURVEY_QUESTIONS.map((question) => (
                    <div key={question.id} className="space-y-2">
                      <h4 className="text-sm font-semibold text-white">
                        {question.question}
                      </h4>
                      <div className="space-y-2">
                        {question.options.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => handleSurveyAnswer(question.id, option.id)}
                            className={`w-full p-2.5 rounded-lg border transition-all flex items-center space-x-2.5 ${
                              assessment[question.id as keyof typeof assessment] === option.id
                                ? 'border-blue-500 bg-blue-500/10'
                                : 'border-gray-600 bg-gray-800/30'
                            }`}
                          >
                            <span className="text-lg">{option.icon}</span>
                            <span className="text-sm text-white text-left flex-1">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

          {/* Step 5: Duration Selection (Apple-style) */}
          {step === 5 && (
              <>
                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-white mb-2">
                    Duration
                  </h3>
                  <p className="text-gray-400 text-sm">
                    How long would you like to meditate?
                  </p>
                </div>

                <div className="space-y-3">
                  {DURATIONS.map((duration, index) => {
                    const gradients = [
                      'from-green-500 to-emerald-400',
                      'from-blue-500 to-cyan-400',
                      'from-purple-500 to-pink-400',
                      'from-orange-500 to-red-400',
                      'from-indigo-500 to-purple-500'
                    ];

                    return (
                      <button
                        key={duration.id}
                        onClick={() => handleDurationSelect(duration.id)}
                        className="w-full"
                      >
                        <AppleCard
                          isSelected={false} // Auto-continues on selection
                          onChange={() => handleDurationSelect(duration.id)}
                          title={duration.label}
                          subtitle={duration.description}
                          icon={`${duration.id}min`}
                          gradient={gradients[index % gradients.length]}
                        />
                      </button>
                    );
                  })}
                </div>
              </>
            )}

          {/* Step 6: Simple Music Selection */}
          {step === 6 && (
              <>
                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-white mb-2">
                    Background Music
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Choose your meditation background music
                  </p>
                </div>

                <div className="space-y-3 mb-4">
                  <AppleCard
                    isSelected={true}
                    onChange={() => handleMusicSelect('StillCaster Ambient - 5 Minutes')}
                    title="StillCaster Ambient Music"
                    subtitle="5-minute calming ambient meditation soundtrack"
                    icon="🎵"
                    gradient="from-blue-500 to-cyan-400"
                  />

                  <div className="bg-gray-800/50 border border-gray-600 rounded-xl p-4">
                    <h4 className="text-sm font-semibold mb-2 text-white">About This Music</h4>
                    <ul className="text-xs text-gray-300 space-y-1.5">
                      <li>• 5-minute ambient background track</li>
                      <li>• Designed specifically for meditation</li>
                      <li>• Will loop automatically for longer sessions</li>
                      <li>• Voice narration will play over this music</li>
                    </ul>
                  </div>
                </div>

              </>
            )}

          {/* Step 7: Prompt Primer */}
          {step === 7 && (
              <>
                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-white mb-2">
                    Personal Touch
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Add any specific details to personalize your meditation.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">
                      Custom Instructions (Optional)
                    </label>
                    <textarea
                      value={promptPrimer}
                      onChange={(e) => setPromptPrimer(e.target.value)}
                      placeholder="e.g., Focus on gratitude, include nature imagery, help with work stress..."
                      maxLength={200}
                      className="w-full h-20 p-3 bg-gray-800/50 border border-gray-600 rounded-xl text-white text-sm resize-none focus:border-blue-500 focus:outline-none transition-colors"
                    />
                    <div className="mt-1.5 text-right">
                      <span className="text-xs text-gray-400">
                        {promptPrimer.length}/200
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-800/50 border border-gray-600 rounded-xl p-4">
                    <h4 className="text-sm font-semibold mb-3 text-white">
                      Your Meditation Summary
                    </h4>
                    <div className="space-y-2 text-xs text-gray-300">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Goal:</span>
                        <span>{selectedGoal}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Wisdom:</span>
                        <span>{WISDOM_SOURCES.find(w => w.internalKeyword === selectedWisdom)?.displayName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Duration:</span>
                        <span>{selectedDuration} minutes</span>
                      </div>
                      {selectedFeelings.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Transforming:</span>
                          <span>{selectedFeelings.join(', ')}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-400">Current State:</span>
                        <span>{SURVEY_QUESTIONS[0].options.find(o => o.id === assessment.currentState)?.label}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Experience:</span>
                        <span>{SURVEY_QUESTIONS[1].options.find(o => o.id === assessment.experience)?.label}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Environment:</span>
                        <span>{SURVEY_QUESTIONS[2].options.find(o => o.id === assessment.environment)?.label}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </>
            )}

            {/* Step 8: Generating Script */}
            {step === 8 && (
              <>
                <div className="text-center">
                  <AppleProgress
                    progress={generationProgress}
                    message={generationMessage}
                  />
                </div>
              </>
            )}

            {/* Step 9: Review Script */}
            {step === 9 && (
              <>
                <div className="text-center mb-3">
                  <h3 className="text-lg font-bold text-white mb-2">
                    Review Script
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Your personalized meditation script is ready.
                  </p>
                </div>

                {/* Full screen script display */}
                <div className="flex-1 bg-gray-800/50 border border-gray-600 rounded-xl p-4 overflow-hidden">
                  <div className="h-full overflow-y-auto">
                    <div className="text-white leading-relaxed whitespace-pre-line text-sm">
                      {generatedScript}
                    </div>
                  </div>
                </div>

              </>
            )}

            {/* Step 10: Voice Selection */}
            {step === 10 && (
              <>
                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-white mb-2">
                    Choose Your Guide
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Select a voice for your personalized meditation.
                  </p>
                </div>

                <div className="space-y-3 mb-4">
                  {VOICES.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice.id)}
                      className={`w-full p-3 rounded-xl border transition-all duration-300 ease-out ${
                        selectedVoice === voice.id
                          ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                          : 'border-gray-300 bg-white/5 hover:border-blue-400 hover:bg-blue-500/5'
                      } active:scale-98 transform`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center space-x-3">
                          <span className="text-xl">{voice.icon}</span>
                          <div className="text-left">
                            <div className={`font-semibold text-base ${selectedVoice === voice.id ? 'text-blue-400' : 'text-white'}`}>
                              {voice.name}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {voice.description}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleVoicePreview(voice.id)
                          }}
                          disabled={isPlaying}
                          className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs shrink-0 active:scale-95 transition-transform disabled:opacity-50"
                        >
                          {isPlaying ? '⏹' : '▶'}
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

        </div>
      </div>

      {/* Fixed Footer with Continue Button */}
      <div className="flex-shrink-0 bg-black/90 backdrop-blur-xl border-t border-gray-800/50 p-4 pb-safe">
        <div className="max-w-md mx-auto">
          {renderFooterButton()}
        </div>
      </div>
    </div>
  )
}