/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: string
  readonly VITE_CHECK_SUBSCRIPTION_STATUS: string
  readonly VITE_SAVE_ONBOARDING: string
  readonly VITE_SIGNUP_WITH_ORG: string
  readonly VITE_DAILY_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
