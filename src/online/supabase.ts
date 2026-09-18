import type { SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fbeghlqnwlefhiqtpwqw.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZWdobHFud2xlZmhpcXRwd3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2OTUzMjIsImV4cCI6MjEwNTI3MTMyMn0.0R8XGeCQnCF9iM1PLthI6RDlTJ5rGjqEzglrHr80bVQ'

let _client: SupabaseClient | null = null

let _initPromise: Promise<SupabaseClient> | null = null

function ensureClient(): Promise<SupabaseClient> {
  if (_client) return Promise.resolve(_client)
  if (_initPromise) return _initPromise
  _initPromise = import('@supabase/supabase-js').then(({ createClient }) => {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON)
    return _client
  })
  return _initPromise
}

export function getSupabase(): Promise<SupabaseClient> {
  return ensureClient()
}
