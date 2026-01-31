import { supabase } from '../supabaseClient'

export default function Home({ user }) {
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="home-container">
      <h1>Welcome!</h1>
      <p>You're logged in as: {user.email}</p>
      <button onClick={handleLogout}>Log Out</button>
    </div>
  )
}
