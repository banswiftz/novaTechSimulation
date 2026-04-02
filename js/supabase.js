// ============================================================
// Supabase Client Initialisation
// Replace the two constants below with your actual project values
// from: https://supabase.com/dashboard → Settings → API
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://gvhrgefcjevnempnseqo.supabase.co';       // e.g. https://xxxx.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2aHJnZWZjamV2bmVtcG5zZXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNjY2NDMsImV4cCI6MjA4OTc0MjY0M30.49NQLfRa0CHetctxD5URwvPZrPeO7IyY8K2qKkg8C_A'; // public anon key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
