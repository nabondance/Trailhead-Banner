import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Shared anon client for client components. One instance means one realtime
 * WebSocket per tab, which matters for the Supabase concurrent connection quota.
 * The anon key can only read `announcement` and call `generation_count`.
 * Null when env vars are missing (e.g. CI builds): client modules are also evaluated during server prerender.
 */
export const supabaseBrowser = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
