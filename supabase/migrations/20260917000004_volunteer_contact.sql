-- Lets the requester see their assigned volunteer's contact info once a
-- trip is accepted (name, phone number, and when it was accepted so the
-- app can show "قبل X دقيقة"). Mirrors reveal_contact, which already
-- gives the volunteer the requester's info — this is the missing
-- reciprocal direction.
-- Apply locally first and review against the linked project before any
-- remote deployment.

create or replace function public.reveal_volunteer_contact(p_trip_id uuid)
returns table (
  trip_id uuid,
  volunteer_first_name text,
  volunteer_phone text,
  accepted_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    t.id,
    p.first_name,
    p.phone_number,
    t.accepted_at
  from trips t
  join profiles p on p.id = t.volunteer_id
  where t.id = p_trip_id
    and t.requester_id = auth.uid()
    and t.status in ('accepted', 'completed');
$$;

revoke all on function public.reveal_volunteer_contact(uuid) from public, anon;
grant execute on function public.reveal_volunteer_contact(uuid) to authenticated;
