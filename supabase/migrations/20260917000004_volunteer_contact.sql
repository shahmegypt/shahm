-- التعديل: إرجاع المسافة distance_km لطالب الرحلة
create or replace function public.reveal_volunteer_contact(p_trip_id uuid)
returns table (
  trip_id uuid,
  volunteer_first_name text,
  volunteer_phone text,
  accepted_at timestamptz,
  distance_km numeric
)
language sql
security definer
set search_path = public
as $$
  select
    t.id,
    p.first_name,
    p.phone_number,
    t.accepted_at,
    case
      when t.volunteer_accepted_lat is not null 
       and t.volunteer_accepted_lng is not null 
       and t.origin_lat is not null 
       and t.origin_lng is not null 
      then
        round(
          (
            6371 * acos(
              cos(radians(t.origin_lat)) * cos(radians(t.volunteer_accepted_lat)) *
              cos(radians(t.volunteer_accepted_lng) - radians(t.origin_lng)) +
              sin(radians(t.origin_lat)) * sin(radians(t.volunteer_accepted_lat))
            )
          )::numeric, 2
        )
      else null
    end as distance_km
  from trips t
  join profiles p on p.id = t.volunteer_id
  where t.id = p_trip_id
    and t.requester_id = auth.uid()
    and t.status in ('accepted', 'completed');
$$;

revoke all on function public.reveal_volunteer_contact(uuid) from public, anon;
grant execute on function public.reveal_volunteer_contact(uuid) to authenticated;
