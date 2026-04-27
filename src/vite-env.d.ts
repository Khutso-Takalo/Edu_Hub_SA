/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
	readonly VITE_SUPABASE_URL: string;
	readonly VITE_SUPABASE_ANON_KEY: string;
	readonly VITE_ENABLE_CHAT_LEARNING_SYNC?: 'true' | 'false';
	readonly VITE_GOOGLE_CUSTOM_SEARCH_API_KEY?: string;
	readonly VITE_GOOGLE_CUSTOM_SEARCH_ENGINE_ID?: string;
	readonly VITE_GOOGLE_CUSTOM_SEARCH_BASE_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
