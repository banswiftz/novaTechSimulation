// ============================================================
// Supabase Client Initialisation
// Replace the two constants below with your actual project values
// from: https://supabase.com/dashboard → Settings → API
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

//const SUPABASE_URL = 'https://bhvkoqbiuwgcsuutnbfv.supabase.co';       // e.g. https://xxxx.supabase.co
//const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJodmtvcWJpdXdnY3N1dXRuYmZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3OTUzNzEsImV4cCI6MjA4ODM3MTM3MX0.pN-Tcur55neIa0b9GYw8qdwIImbf5frhHh90WLJ8Uc0'; // public anon key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
