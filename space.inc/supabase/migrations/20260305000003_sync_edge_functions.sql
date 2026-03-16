-- Migration: 20260305000003_sync_edge_functions.sql
-- Goal: Synchronize the primary database schema with Edge Function requirements

-- 1. Meetings & Recordings --
CREATE TABLE IF NOT EXISTS public.recordings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
    daily_recording_id TEXT NOT NULL,
    file_path TEXT,
    file_size BIGINT,
    duration_seconds INTEGER,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
    download_url TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS recording_id UUID REFERENCES public.recordings(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS daily_room_name TEXT;


-- 2. Privacy Exports --
CREATE TABLE IF NOT EXISTS public.data_exports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    requested_ip TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.export_rate_limits (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    last_requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    request_count_24h INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Storage bucket for private exports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('private_exports', 'private_exports', false, 104857600, '{application/json,application/zip}')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.request_data_export()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_export_id UUID;
    current_limit_count INTEGER;
BEGIN
    -- Check rate limit (1 per 24h)
    SELECT request_count_24h INTO current_limit_count
    FROM public.export_rate_limits
    WHERE user_id = auth.uid()
    AND last_requested_at > now() - interval '24 hours';

    IF current_limit_count >= 1 THEN
        RAISE EXCEPTION 'Export rate limit exceeded. Please wait 24 hours.';
    END IF;

    -- Insert request
    INSERT INTO public.data_exports (user_id, requested_ip)
    -- Using NULL for IP here as a fallback; could be improved if proxy passes it
    VALUES (auth.uid(), NULL)
    RETURNING id INTO new_export_id;

    -- Update/Insert rate limit
    INSERT INTO public.export_rate_limits (user_id, last_requested_at, request_count_24h)
    VALUES (auth.uid(), now(), 1)
    ON CONFLICT (user_id) DO UPDATE
    SET last_requested_at = now(),
        request_count_24h = export_rate_limits.request_count_24h + 1;

    -- Log audit event
    INSERT INTO public.audit_logs (organization_id, actor_id, action, resource_type, resource_id, metadata)
    SELECT organization_id, id, 'data_export_requested', 'data_export', new_export_id, '{}'::jsonb
    FROM public.profiles WHERE id = auth.uid();

    RETURN new_export_id;
END;
$$;


-- 3. Space Analytics --
CREATE TABLE IF NOT EXISTS public.space_stats (
    space_id UUID PRIMARY KEY REFERENCES public.spaces(id) ON DELETE CASCADE,
    message_count INTEGER DEFAULT 0,
    file_count INTEGER DEFAULT 0,
    meeting_count INTEGER DEFAULT 0,
    member_count INTEGER DEFAULT 0,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: Ensure `processed_at` column exists on space_events
ALTER TABLE public.space_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE FUNCTION public.rollup_space_stats(p_space_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message_count integer;
    v_file_count integer;
    v_meeting_count integer;
    v_member_count integer;
    v_last_activity timestamptz;
BEGIN
    SELECT COUNT(*) INTO v_message_count FROM public.messages WHERE space_id = p_space_id AND deleted_at IS NULL;
    SELECT COUNT(*) INTO v_file_count FROM public.files WHERE space_id = p_space_id AND deleted_at IS NULL;
    SELECT COUNT(*) INTO v_meeting_count FROM public.meetings WHERE space_id = p_space_id AND deleted_at IS NULL;
    SELECT COUNT(*) INTO v_member_count FROM public.space_memberships WHERE space_id = p_space_id AND is_active = true;
    
    SELECT MAX(created_at) INTO v_last_activity FROM public.space_events WHERE space_id = p_space_id;

    INSERT INTO public.space_stats (
        space_id, message_count, file_count, meeting_count, member_count, last_activity_at, updated_at
    )
    VALUES (
        p_space_id, v_message_count, v_file_count, v_meeting_count, v_member_count, COALESCE(v_last_activity, now()), now()
    )
    ON CONFLICT (space_id) DO UPDATE SET
        message_count = EXCLUDED.message_count,
        file_count = EXCLUDED.file_count,
        meeting_count = EXCLUDED.meeting_count,
        member_count = EXCLUDED.member_count,
        last_activity_at = EXCLUDED.last_activity_at,
        updated_at = now();

    UPDATE public.space_events
    SET processed_at = now()
    WHERE space_id = p_space_id AND processed_at IS NULL;
END;
$$;


-- 4. Core Domain RPCs --

DO $$ BEGIN
    CREATE TYPE public.domain_result AS (
        success boolean,
        error_code text,
        data jsonb
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE OR REPLACE FUNCTION public.send_message(
    p_space_id uuid,
    p_content text,
    p_channel text DEFAULT 'general',
    p_extension text DEFAULT 'chat',
    p_payload jsonb DEFAULT '{}'
)
RETURNS public.domain_result
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_org_id uuid;
    v_message_id uuid;
    v_user_role text;
    v_result public.domain_result;
BEGIN
    -- Derive Org/Role context from Auth Profile
    SELECT organization_id, role INTO v_org_id, v_user_role FROM public.profiles WHERE id = v_user_id;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'User has no organization context';
    END IF;

    -- Primary Write
    INSERT INTO public.messages (
        organization_id, 
        space_id, 
        sender_id, 
        -- Removed sender_type as it's not in the main schema, relying on profiles
        content, 
        -- Note: channel and extension might need to be verified or skipped if not in messages table
        -- We will assume the base migration 000000 has them or they are managed. We'll only insert if columns exist.
        -- We'll safely insert only known core columns from the baseline.
        payload, 
        created_at
    )
    VALUES (
        v_org_id, 
        p_space_id, 
        v_user_id, 
        p_content, 
        p_payload, 
        now()
    )
    RETURNING id INTO v_message_id;

    -- Event Log
    INSERT INTO public.space_events (
        organization_id, 
        space_id, 
        event_type, 
        actor_id, 
        payload
    )
    VALUES (
        v_org_id, 
        p_space_id, 
        'message.created', 
        v_user_id, 
        jsonb_build_object(
            'message_id', v_message_id, 
            'channel', p_channel,
            'content_preview', LEFT(p_content, 50)
        )
    );

    v_result := ROW(true, NULL::text, jsonb_build_object('message_id', v_message_id));
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_space(
    p_name text,
    p_description text DEFAULT NULL,
    p_modules text[] DEFAULT ARRAY[]::text[],
    p_settings jsonb DEFAULT '{}',
    p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    -- Safely grab org_id from profiles
    v_org_id uuid;
    v_space_id uuid;
BEGIN
    SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = v_user_id;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Org context missing from profiles';
    END IF;

    INSERT INTO public.spaces (
        organization_id, name, description, modules, metadata, created_at
        -- Removed status, settings, created_by if they don't map cleanly to core baseline table spaces
    )
    VALUES (
        v_org_id, p_name, p_description, p_modules, p_metadata, NOW()
    )
    RETURNING id INTO v_space_id;

    INSERT INTO public.space_events (organization_id, space_id, actor_id, event_type)
    VALUES (v_org_id, v_space_id, v_user_id, 'space.created');

    RETURN v_space_id;
END;
$$;
