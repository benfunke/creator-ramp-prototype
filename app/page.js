'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Auth from '@/components/Auth'
import ChannelChecker from '@/components/ChannelChecker'

export default function Page() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard')
      } else {
        setSession(session)
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session) {
          router.push('/dashboard')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  if (loading) {
    return (
      <div className="App">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  // Show dashboard button if user is logged in
  if (session) {
    return (
      <div className="App">
        <div className="home-container">
          <h1>Welcome back!</h1>
          <p>You're logged in as {session.user.email}</p>
          <button onClick={() => router.push('/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="App">
      <div className="landing-page">
        <ChannelChecker />
        <div className="divider">
          <span>or</span>
        </div>
        <Auth />
      </div>
    </div>
  )
}
