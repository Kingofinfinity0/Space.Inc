-- Migration: Kill the Zombie Auth System
-- Created: 2026-03-05
-- Description: Drops custom auth tables and reverts to native Supabase Auth

-- 1. Update space_client_permissions to reference native auth.users
-- We preserve the user_id values because they match Supabase auth.users(id) in this system
ALTER TABLE public.space_client_permissions DROP CONSTRAINT IF EXISTS space_client_permissions_user_id_fkey;
ALTER TABLE public.space_client_permissions 
    ADD CONSTRAINT space_client_permissions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Drop Zombie Tables
DROP TABLE IF EXISTS public.failed_login_attempts;
DROP TABLE IF EXISTS public.sessions;
DROP TABLE IF EXISTS public.oauth_accounts;
DROP TABLE IF EXISTS public.users CASCADE;

-- 3. Remove update timestamp trigger for dropped table users
DROP TRIGGER IF EXISTS update_users_timestamp ON public.users;
