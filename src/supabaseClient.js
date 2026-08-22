import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Pulse configuration error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set. ' +
      'Copy .env.example to .env, fill in your Supabase credentials, and restart the dev server.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);