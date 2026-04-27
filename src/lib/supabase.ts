import { createClient } from '@supabase/supabase-js';
import { runtimeEnv, runtimeEnvMessages, runtimeEnvStatus } from '@/lib/runtimeEnv';

const supabase = runtimeEnvStatus.isSupabaseConfigured
	? createClient(runtimeEnv.supabaseUrl, runtimeEnv.supabaseAnonKey, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true,
	},
})
	: null;


export { supabase, runtimeEnvMessages, runtimeEnvStatus };