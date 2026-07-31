/* ==========================================================================
   SUPABASE কানেকশন
   ========================================================================== */
export const SUPABASE_URL = 'https://gaujxqkchdjgeqvzynnl.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhdWp4cWtjaGRqZ2Vxdnp5bm5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTUyNzEsImV4cCI6MjEwMDk5MTI3MX0.Z7ITBJS5TdPVwPyg8N00wg-1y8oZ9IxpFsr1jGLG2Jo';
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
