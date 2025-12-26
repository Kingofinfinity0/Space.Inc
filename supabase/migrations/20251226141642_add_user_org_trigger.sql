-- Create function to handle user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    org_id UUID;
    user_email TEXT;
    email_domain TEXT;
BEGIN
    user_email := NEW.email;
    email_domain := SPLIT_PART(user_email, '@', 2);
    
    -- Try to find organization by email domain
    SELECT id INTO org_id 
    FROM organizations 
    WHERE metadata->>'domain' = email_domain OR name = email_domain;
    
    -- If no organization found, create one
    IF org_id IS NULL THEN
        INSERT INTO organizations (name, metadata)
        VALUES (
            email_domain,
            jsonb_build_object('domain', email_domain, 'auto_created', true)
        )
        RETURNING id INTO org_id;
    END IF;
    
    -- Create user profile linked to organization
    INSERT INTO profiles (id, organization_id, email, role)
    VALUES (
        NEW.id,
        org_id,
        user_email,
        CASE 
            WHEN (SELECT COUNT(*) FROM profiles WHERE organization_id = org_id) = 0 
            THEN 'owner'::text
            ELSE 'staff'::text
        END
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to fire on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Add domain column to organizations metadata if not exists
UPDATE organizations 
SET metadata = metadata || jsonb_build_object('domain', LOWER(name))
WHERE metadata->>'domain' IS NULL AND name IS NOT NULL;
