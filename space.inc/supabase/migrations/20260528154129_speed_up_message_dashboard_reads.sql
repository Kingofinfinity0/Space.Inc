create index if not exists idx_messages_space_visible_created
on public.messages (space_id, thread_root_id, created_at desc)
where deleted_at is null;

create index if not exists idx_messages_space_channel_visible_created
on public.messages (space_id, channel_id, created_at desc)
where deleted_at is null;
