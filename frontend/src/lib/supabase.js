import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// This instance will be imported anywhere in your frontend that needs Supabase Auth/DB.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
