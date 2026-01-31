'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Auth from '@/components/Auth'
import Home from '@/components/Home'
import ChannelChecker from '@/components/ChannelChecker'

export default function Page() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="App">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="App">
      {session ? (
        <Home user={session.user} />
      ) : (
        <div className="landing-page">
          <ChannelChecker />
          <div className="divider">
            <span>or</span>
          </div>
          <Auth />
        </div>
      )}
    </div>
  )
}
