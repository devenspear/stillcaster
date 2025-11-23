'use client'

import { useState } from 'react'
import { useAppStore, type SessionConfig } from '@/lib/store'
import { auth } from '@/lib/authClient'
import { isDemoMode } from '@/lib/demoMode'
import AssessmentFlow from './AssessmentFlow'
import SessionPlayer from './SessionPlayer'

export default function Dashboard() {
  const { user, savedSessions } = useAppStore()
  const [showAssessment, setShowAssessment] = useState(false)
  const [currentSession, setCurrentSession] = useState<SessionConfig | null>(null)

  const handleSignOut = async () => {
    if (!isDemoMode()) {
      await auth.signOut()
    }
    // For demo mode, we could reset the store or just ignore sign out
  }

  const handleAssessmentComplete = (sessionConfig: SessionConfig) => {
    setCurrentSession(sessionConfig)
    setShowAssessment(false)
  }

  if (showAssessment) {
    return (
      <AssessmentFlow
        onComplete={handleAssessmentComplete}
        onCancel={() => setShowAssessment(false)}
      />
    )
  }

  if (currentSession) {
    return <SessionPlayer session={currentSession} onClose={() => setCurrentSession(null)} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black text-white">
      <div className="flex flex-col min-h-screen">
        {/* Demo Mode Banner */}
        {isDemoMode() && (
          <div className="px-4 pt-4 mobile-compact-xs">
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3">
              <div className="flex items-start space-x-2">
                <span className="text-orange-400 text-base mt-0.5">⚡</span>
                <div>
                  <p className="text-sm font-semibold text-orange-100 mb-0.5">Demo Mode</p>
                  <p className="text-xs text-orange-200/80 leading-snug">
                    Sample data active. Add API keys for full features.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header - Compact */}
        <div className="px-4 py-3 mobile-compact">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white mb-0.5">Good Evening{user?.first_name ? `, ${user.first_name}` : ''}</h1>
              <p className="text-sm text-gray-400">{user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-10 h-10 bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-full flex items-center justify-center text-gray-300 active:scale-95 transition-all shadow-lg"
            >
              <span className="text-base">⚙️</span>
            </button>
          </div>
        </div>

        {/* Stats Cards - Compact */}
        <div className="px-4 pb-3 mobile-compact-xs">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-blue-300 mb-0.5">{user?.total_minutes || 0}</p>
              <p className="text-[10px] uppercase tracking-wide text-blue-200/70">Minutes</p>
            </div>
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-green-300 mb-0.5">{user?.current_streak || 0}</p>
              <p className="text-[10px] uppercase tracking-wide text-green-200/70">Day Streak</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-purple-300 mb-0.5">{savedSessions.length}</p>
              <p className="text-[10px] uppercase tracking-wide text-purple-200/70">Sessions</p>
            </div>
          </div>
        </div>

        {/* Quick Actions - Compact */}
        <div className="px-4 pb-3 mobile-compact-xs">
          <div className="space-y-2.5">
            <button
              onClick={() => setShowAssessment(true)}
              className="w-full bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-4 text-left active:scale-[0.98] transition-transform shadow-lg shadow-purple-500/30"
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-semibold text-white">Start New Session</h3>
                <span className="text-xl">✨</span>
              </div>
              <p className="text-xs text-indigo-100 leading-snug">
                Create a personalized meditation with AI guidance
              </p>
            </button>

            <button className="w-full bg-gradient-to-br from-gray-800/60 to-gray-900/60 border border-gray-700/50 rounded-xl p-4 text-left active:scale-[0.98] transition-transform">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-white">Quick Meditation</h3>
                <span className="text-lg">🧘‍♀️</span>
              </div>
              <p className="text-xs text-gray-400 leading-snug">Use your last configuration</p>
            </button>
          </div>
        </div>

        {/* Saved Sessions - Compact */}
        {savedSessions.length > 0 && (
          <div className="px-4 pb-3 mobile-compact-xs">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-white">Your Sessions</h2>
              {savedSessions.length > 2 && (
                <button className="text-xs text-blue-400 font-medium">
                  All ({savedSessions.length})
                </button>
              )}
            </div>
            <div className="bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-700/40">
              <div className="max-h-28 overflow-y-auto">
                <div className="divide-y divide-gray-700/30">
                  {savedSessions.slice(0, 2).map((session, index) => (
                    <div
                      key={index}
                      className="p-3 first:rounded-t-xl last:rounded-b-xl"
                    >
                      <div className="flex items-start justify-between flex-1">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-white mb-0.5 truncate">{session.name}</h4>
                          <p className="text-xs text-gray-400">
                            {session.duration} min • {session.layers.music_type}
                          </p>
                        </div>
                        <button
                          onClick={() => setCurrentSession(session)}
                          className="ml-2 w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm shrink-0 active:scale-95 transition-transform shadow-lg"
                        >
                          ▶
                        </button>
                      </div>
                    </div>
                  ))}
                  {savedSessions.length > 2 && (
                    <div className="p-2 text-center border-t border-gray-700/30">
                      <button className="w-full py-1.5 text-xs text-blue-400 font-medium">
                        Show {savedSessions.length - 2} More
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Safe Area Padding */}
        <div className="pb-6"></div>
      </div>
    </div>
  )
}

