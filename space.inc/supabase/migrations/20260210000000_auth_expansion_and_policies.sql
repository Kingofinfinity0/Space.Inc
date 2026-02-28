-- Migration: Authentication Expansion & Organization Policies
-- Created: 2026-02-10
-- Description: Adds unified identity system, custom sessions, and policy governance

-- ============================================================================
-- PART 1: UNIFIED IDENTITY SYSTEM
-- ============================================================================

-- 1.1 Users Table (Unified Identity)
CREATE TABLE public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    username text UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_active boolean DEFAULT true,
    -- Link to Supabase Auth (if keeping as provider wrapper)
    supabase_auth_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_supabase_auth_id ON public.users(supabase_auth_id);

-- 1.2 OAuth Accounts Table (Provider Links)
CREATE TABLE public.oauth_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider text NOT NULL, -- 'google', 'discord', 'github'
    provider_user_id text NOT NULL,
    access_token text, -- encrypted in application layer
    refresh_token text, -- encrypted in application layer
    token_expiry timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX idx_oauth_accounts_user_id ON public.oauth_accounts(user_id);
CREATE INDEX idx_oauth_accounts_provider_lookup ON public.oauth_accounts(provider, provider_user_id);

-- ============================================================================
-- PART 2: CUSTOM SESSION MANAGEMENT
-- ============================================================================

-- 2.1 Sessions Table
CREATE TABLE public.sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    refresh_token_hash text NOT NULL,
    device_info text,
    ip_address text,
    expires_at timestamptz NOT NULL,
    revoked boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON public.sessions(refresh_token_hash) WHERE NOT revoked;
CREATE INDEX idx_sessions_expires_at ON public.sessions(expires_at) WHERE NOT revoked;

-- 2.2 Failed Login Attempts Table (Security)
CREATE TABLE public.failed_login_attempts (
    user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    attempt_count int DEFAULT 1,
    last_attempt_at timestamptz DEFAULT now(),
    locked_until timestamptz
);

-- ============================================================================
-- PART 3: ORGANIZATION POLICIES
-- ============================================================================

-- 3.1 Organization Policies Table (Global Rules)
CREATE TABLE public.organization_policies (
    organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Access Control
    allow_client_invites boolean DEFAULT false,
    allow_staff_invites boolean DEFAULT true,
    allow_staff_create_spaces boolean DEFAULT true,
    
    -- Client Interaction
    client_can_upload boolean DEFAULT true,
    client_can_delete_own boolean DEFAULT true,
    client_can_download_all boolean DEFAULT false,
    client_can_create_tasks boolean DEFAULT false,
    client_can_start_meetings boolean DEFAULT false,
    
    -- Security
    require_2fa_staff boolean DEFAULT false,
    require_2fa_admin boolean DEFAULT false,
    max_session_duration_seconds int DEFAULT 43200, -- 12 hours
    password_min_length int DEFAULT 8,
    allowed_ip_ranges text[],
    
    -- Governance
    auto_archive_inactive_months int DEFAULT 6,
    max_file_upload_mb int DEFAULT 100,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.2 Space Client Permissions Table (Space-Level Overrides)
CREATE TABLE public.space_client_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id uuid NOT NULL REFERENCES public.client_spaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Overrides (NULL means use Global Policy)
    can_upload boolean,
    can_delete boolean,
    can_create_tasks boolean,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(space_id, user_id)
);

CREATE INDEX idx_space_client_permissions_lookup ON public.space_client_permissions(space_id, user_id);

-- ============================================================================
-- PART 4: EXTEND EXISTING TABLES
-- ============================================================================

-- 4.1 Add owner_role to files table
ALTER TABLE public.files 
ADD COLUMN owner_role text CHECK (owner_role IN ('client', 'staff', 'admin', 'owner'));

-- Update existing files to set owner_role based on uploaded_by profile
UPDATE public.files f
SET owner_role = p.role::text
FROM public.profiles p
WHERE f.uploaded_by = p.id AND f.owner_role IS NULL;

-- 4.2 Add channel to messages table
ALTER TABLE public.messages
ADD COLUMN channel text DEFAULT 'general' CHECK (channel IN ('general', 'internal'));

-- 4.3 Update profiles to reference users table
-- First, create users from existing profiles
INSERT INTO public.users (id, email, supabase_auth_id, created_at, updated_at)
SELECT id, email, id as supabase_auth_id, created_at, updated_at
FROM public.profiles
ON CONFLICT (id) DO NOTHING;

-- Add foreign key to profiles (optional, for data integrity)
-- ALTER TABLE public.profiles
-- ADD CONSTRAINT fk_profiles_users FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ============================================================================
-- PART 5: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_client_permissions ENABLE ROW LEVEL SECURITY;

-- Users: Can see their own record
CREATE POLICY "Users can view own record" ON public.users
    FOR SELECT USING (id = auth.uid());

-- OAuth Accounts: Can see own accounts
CREATE POLICY "Users can view own oauth accounts" ON public.oauth_accounts
    FOR SELECT USING (user_id = auth.uid());

-- Sessions: Can see own sessions
CREATE POLICY "Users can view own sessions" ON public.sessions
    FOR SELECT USING (user_id = auth.uid());

-- Organization Policies: Viewable by org members
CREATE POLICY "Org members can view policies" ON public.organization_policies
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Organization Policies: Only owners can update
CREATE POLICY "Only owners can update policies" ON public.organization_policies
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid() AND role = 'owner'
        )
    );

-- Space Client Permissions: Viewable by org members
CREATE POLICY "Org members can view space permissions" ON public.space_client_permissions
    FOR SELECT USING (
        space_id IN (
            SELECT id FROM public.client_spaces 
            WHERE organization_id IN (
                SELECT organization_id FROM public.profiles WHERE id = auth.uid()
            )
        )
    );

-- ============================================================================
-- PART 6: TRIGGERS & FUNCTIONS
-- ============================================================================

-- Update timestamp trigger for new tables
CREATE TRIGGER update_users_timestamp 
    BEFORE UPDATE ON public.users 
    FOR EACH ROW EXECUTE PROCEDURE public.trigger_update_timestamp();

CREATE TRIGGER update_organization_policies_timestamp 
    BEFORE UPDATE ON public.organization_policies 
    FOR EACH ROW EXECUTE PROCEDURE public.trigger_update_timestamp();

CREATE TRIGGER update_space_client_permissions_timestamp 
    BEFORE UPDATE ON public.space_client_permissions 
    FOR EACH ROW EXECUTE PROCEDURE public.trigger_update_timestamp();

-- Function to prevent removing last owner
CREATE OR REPLACE FUNCTION public.prevent_last_owner_removal()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role = 'owner' AND NEW.role != 'owner' THEN
        -- Check if this is the last owner
        IF (SELECT COUNT(*) FROM public.profiles 
            WHERE organization_id = OLD.organization_id 
            AND role = 'owner' 
            AND id != OLD.id) = 0 THEN
            RAISE EXCEPTION 'Cannot remove the last owner from organization';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_last_owner_removal_trigger
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE PROCEDURE public.prevent_last_owner_removal();

-- ============================================================================
-- PART 7: DEFAULT POLICIES FOR EXISTING ORGANIZATIONS
-- ============================================================================

-- Insert default policies for all existing organizations
INSERT INTO public.organization_policies (organization_id)
SELECT id FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
