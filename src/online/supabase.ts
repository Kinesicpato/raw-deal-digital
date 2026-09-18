import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fbeghlqnwlefhiqtpwqw.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZWdobHFud2xlZmhpcXRwd3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2OTUzMjIsImV4cCI6MjEwNTI3MTMyMn0.0R8XGeCQnCF9iM1PLthI6RDlTJ5rGjqEzglrHr80bVQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
