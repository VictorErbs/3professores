import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// Returns the currently authenticated user (Supabase), or null.
// If Supabase auth isn't configured, returns null.
export async function getAuthedUser() {
  // Temporary: disable auth so all API routes are accessible without login
  return { id: '00000000-0000-0000-0000-000000000000', email: 'demo@creditguard.local' }
}
