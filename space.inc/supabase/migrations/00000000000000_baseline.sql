-- BASELINE SCHEMA RECONSTRUCTED FROM PRODUCTION
-- Project: qkpjmsorzkdnebcckqts
-- Generated: 2026-01-30

-- 1. Create Enums
CREATE TYPE public.client_space_status AS ENUM ('active', 'paused', 'closed', 'failed');
CREATE TYPE public.file_status AS ENUM ('pending', 'available', 'scanning', 'deleted');
CREATE TYPE public.meeting_status AS ENUM ('scheduled', 'starting', 'active', 'ended', 'cancelled');
CREATE TYPE public.notification_type AS ENUM ('meeting_scheduled', 'meeting_starting', 'meeting_ended', 'meeting_cancelled', 'recording_ready', 'message_received', 'document_uploaded', 'task_assigned', 'task_completed', 'client_report', 'invitation_received', 'system_alert');
CREATE TYPE public.recording_status AS ENUM ('none', 'recording', 'processing', 'ready', 'failed');
CREATE TYPE public.space_member_role AS ENUM ('owner', 'admin', 'staff', 'client');
CREATE TYPE public.space_status AS ENUM ('Active', 'Onboarding', 'Archived', 'Locked');
CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'staff', 'client');

-- 2. Create Base Tables
CREATE TABLE public.organizations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    plan_tier text DEFAULT 'solo'::text,
    billing_status text DEFAULT 'inactive'::text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (id)
);

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    organization_id uuid REFERENCES public.organizations(id),
    email text NOT NULL,
    role public.user_role NOT NULL DEFAULT 'client'::public.user_role,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    full_name text,
    avatar_url text,
    phone text,
    is_active boolean DEFAULT true,
    last_seen_at timestamp with time zone,
    updated_at timestamp with time zone,
    PRIMARY KEY (id)
);

CREATE TABLE public.client_spaces (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id),
    name text NOT NULL,
    status public.space_status NOT NULL DEFAULT 'Active'::public.space_status,
    onboarding_complete boolean NOT NULL DEFAULT false,
    contact_name text,
    contact_email text,
    modules jsonb NOT NULL DEFAULT '{}'::jsonb,
    analytics jsonb NOT NULL DEFAULT '{}'::jsonb,
    notifications integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    description text,
    contact_phone text,
    company_name text,
    industry text,
    access_token text,
    access_token_expires_at timestamp with time zone,
    settings jsonb DEFAULT '{}'::jsonb,
    assigned_staff_id uuid REFERENCES public.profiles(id),
    updated_at timestamp with time zone,
    closed_at timestamp with time zone,
    closed_reason text,
    invitation_token text,
    deleted_at timestamp with time zone,
    guest_access_code text,
    PRIMARY KEY (id)
);

CREATE TABLE public.meetings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id),
    space_id uuid REFERENCES public.client_spaces(id),
    title text NOT NULL,
    starts_at timestamp with time zone NOT NULL DEFAULT now(),
    duration_minutes integer,
    daily_room_url text,
    has_recording boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    daily_room_name text,
    status public.meeting_status DEFAULT 'scheduled'::public.meeting_status,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    recording_url text,
    recording_status public.recording_status DEFAULT 'none'::public.recording_status,
    updated_at timestamp with time zone,
    description text,
    created_by uuid REFERENCES public.profiles(id),
    meeting_type text,
    is_recurring boolean DEFAULT false,
    recurring_config jsonb,
    attendees_count integer DEFAULT 0,
    max_participants integer,
    recording_enabled boolean DEFAULT true,
    waiting_room_enabled boolean DEFAULT false,
    password text,
    client_consent_given boolean DEFAULT false,
    client_consent_at timestamp with time zone,
    daily_room_id text,
    deleted_at timestamp with time zone,
    PRIMARY KEY (id)
);

CREATE TABLE public.messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id),
    space_id uuid NOT NULL REFERENCES public.client_spaces(id),
    sender_id uuid REFERENCES public.profiles(id),
    sender_type text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    topic text,
    extension text,
    payload jsonb DEFAULT '{}'::jsonb,
    event text,
    private boolean DEFAULT false,
    PRIMARY KEY (id)
);

CREATE TABLE public.files (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id),
    space_id uuid REFERENCES public.client_spaces(id),
    is_global boolean NOT NULL DEFAULT false,
    name text NOT NULL,
    storage_path text NOT NULL,
    mime_type text,
    uploaded_by uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    status public.file_status DEFAULT 'available'::public.file_status,
    deleted_at timestamp with time zone,
    checksum text,
    file_size bigint,
    display_name text,
    is_legal_hold boolean DEFAULT false,
    processing_attempts integer DEFAULT 0,
    last_error text,
    updated_at timestamp with time zone,
    PRIMARY KEY (id)
);

CREATE TABLE public.tasks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id),
    space_id uuid REFERENCES public.client_spaces(id),
    assignee_id uuid REFERENCES public.profiles(id),
    title text NOT NULL,
    due_date date,
    status text NOT NULL DEFAULT 'todo',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    description text,
    priority text DEFAULT 'medium',
    completed_at timestamp with time zone,
    created_by uuid REFERENCES public.profiles(id),
    updated_at timestamp with time zone,
    PRIMARY KEY (id)
);

CREATE TABLE public.meeting_participants (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    meeting_id uuid NOT NULL REFERENCES public.meetings(id),
    profile_id uuid REFERENCES public.profiles(id),
    user_id uuid, -- For external or guest users
    role public.space_member_role DEFAULT 'client'::public.space_member_role,
    joined_at timestamp with time zone,
    left_at timestamp with time zone,
    participant_id text,
    participant_name text,
    PRIMARY KEY (id)
);

-- 3. Functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION public.trigger_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Triggers
CREATE TRIGGER update_profiles_timestamp BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.trigger_update_timestamp();
CREATE TRIGGER update_client_spaces_timestamp BEFORE UPDATE ON public.client_spaces FOR EACH ROW EXECUTE PROCEDURE public.trigger_update_timestamp();
CREATE TRIGGER update_meetings_timestamp BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE PROCEDURE public.trigger_update_timestamp();
CREATE TRIGGER update_tasks_timestamp BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE PROCEDURE public.trigger_update_timestamp();

-- 5. RLS Policies (Simplified Baseline)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Note: Actual complex RLS policies should be pulled from prod or reconstructed.
-- Here we add simple org-based policies to get started.

CREATE POLICY "Users can see their own organization" ON public.organizations
    FOR SELECT USING (id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Profiles are viewable by organization members" ON public.profiles
    FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Spaces are viewable by organization members" ON public.client_spaces
    FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Meetings are viewable by organization members" ON public.meetings
    FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
