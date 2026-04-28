import { createClient } from '@supabase/supabase-js';

// PASTE YOUR ACTUAL URL AND KEY HERE DIRECTLY FOR A QUICK TEST
const supabaseUrl = 'https://zuqeljpxpjlwidfpuplc.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1cWVsanB4cGpsd2lkZnB1cGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzEyNzMsImV4cCI6MjA5MjYwNzI3M30.GzZpOLVGDk2kK9BikLdYbn1pveUJL2urOoIShXjANyg';

export const supabase = createClient(supabaseUrl, supabaseKey);