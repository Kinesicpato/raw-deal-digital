import type { SupabaseClient } from '@supabase/supabase-js'

const FALLBACK_URL = 'https://fbeghlqnwlefhiqtpwqw.supabase.co'
const FALLBACK_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZWdobHFud2xlZmhpcXRwd3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2OTUzMjIsImV4cCI6MjEwNTI3MTMyMn0.0R8XGeCQnCF9iM1PLthI6RDlTJ5rGjqEzglrHr80bVQ'

function env(name: string): string {
  const value = import.meta.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

const SUPABASE_URL = (env('VITE_SUPABASE_URL') || FALLBACK_URL).replace(/\/+$/, '')
const SUPABASE_ANON = env('VITE_SUPABASE_ANON_KEY') || FALLBACK_ANON

export function supabaseHost(): string {
  try {
    return new URL(SUPABASE_URL).host
  } catch {
    return SUPABASE_URL
  }
}

function configError(): Error {
  return new Error(
    `No pude conectar con Supabase (${supabaseHost()}). ` +
      'Ese proyecto ya no existe o está caído: creá uno nuevo en supabase.com, ' +
      'ejecutá supabase-schema.sql y cargá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.',
  )
}

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

let _probe: Promise<void> | null = null

/**
 * Cheap reachability check against the REST root. A dead project ref answers
 * with NXDOMAIN at DNS time, so the fetch rejects before any HTTP happens and
 * we surface a readable message instead of a WebSocket that never opens.
 * Successful probes are cached for the session; failed ones are not.
 */
export function ensureSupabaseReachable(timeoutMs = 8000): Promise<void> {
  if (_probe) return _probe
  _probe = probe(timeoutMs).catch((err: unknown) => {
    _probe = null
    throw err
  })
  return _probe
}

async function probe(timeoutMs: number): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let failure: string | null = null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
      signal: controller.signal,
    })
    if (res.status >= 500) failure = `HTTP ${res.status}`
  } catch (err) {
    failure = (err as Error)?.name === 'AbortError' ? 'timeout' : (err as Error)?.message ?? 'fetch failed'
  } finally {
    clearTimeout(timer)
  }
  if (failure) {
    const detail = configError()
    console.error(`[Supabase] ${supabaseHost()} inalcanzable (${failure}):`, detail.message)
    throw detail
  }
}
