SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
SELECT tablename, policyname, cmd, roles FROM pg_policies WHERE schemaname = 'public';
