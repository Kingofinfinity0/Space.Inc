do $$
declare
  v_signature text := 'public.notify_space_members(uuid,text,text,text,uuid,text,uuid,text,jsonb,text[],text,uuid)';
begin
  if to_regprocedure(v_signature) is not null then
    execute format('revoke execute on function %s from public', v_signature);
    execute format('revoke execute on function %s from anon', v_signature);
    execute format('revoke execute on function %s from authenticated', v_signature);
  end if;
end $$;
