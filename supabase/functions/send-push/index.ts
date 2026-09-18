// Sends Web Push notifications (VAPID) to volunteers' registered devices
// (public.push_subscriptions). Not publicly callable: only a caller holding
// the service-role key may invoke it — it's meant to be triggered from
// create-trip-proxy right after a trip is successfully created, never
// directly from the browser.

type PushPayload = {
  user_ids?: string[];
  trip_id?: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type StoredSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublicKey = Deno.env.get('VITE_VAPID_PUBLIC_KEY') ?? Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@shahm.app';

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return jsonResponse(500, { error: 'Push function environment is incomplete' });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return jsonResponse(401, { error: 'Not authorized to trigger push notifications' });
  }

  let payload: PushPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Request body must be valid JSON' });
  }

  if (!payload.title || !payload.body) {
    return jsonResponse(422, { error: 'title and body are required' });
  }
  if ((!payload.user_ids || payload.user_ids.length === 0) && !payload.trip_id) {
    return jsonResponse(422, { error: 'Provide either user_ids or trip_id' });
  }

  const { createClient } = await import('npm:@supabase/supabase-js@2.45.4');
  const webpush = await import('npm:web-push@3.6.7');

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let targetUserIds = payload.user_ids ?? [];

  if (payload.trip_id && targetUserIds.length === 0) {
    const { data: volunteers, error: volunteersError } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('role', 'volunteer')
      .eq('is_active', true);

    if (volunteersError) {
      return jsonResponse(500, { error: 'Could not resolve volunteer list' });
    }
    targetUserIds = (volunteers ?? []).map((v: { id: string }) => v.id);
  }

  if (targetUserIds.length === 0) {
    return jsonResponse(200, { sent: 0, failed: 0 });
  }

  const { data: subscriptions, error: subsError } = await serviceClient
    .from('push_subscriptions')
    .select('user_id, subscription')
    .in('user_id', targetUserIds);

  if (subsError) {
    return jsonResponse(500, { error: 'Could not load push subscriptions' });
  }

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    tag: payload.tag ?? (payload.trip_id ? `trip-${payload.trip_id}` : undefined),
  });

  let sent = 0;
  let failed = 0;
  const staleUserIds: string[] = [];

  await Promise.all(
    (subscriptions ?? []).map(async (row: { user_id: string; subscription: StoredSubscription }) => {
      try {
        await webpush.sendNotification(row.subscription, notificationPayload);
        sent += 1;
      } catch (err: unknown) {
        failed += 1;
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleUserIds.push(row.user_id);
        } else {
          console.error('push send failed', { user_id: row.user_id, statusCode });
        }
      }
    })
  );

  if (staleUserIds.length > 0) {
    await serviceClient.from('push_subscriptions').delete().in('user_id', staleUserIds);
  }

  return jsonResponse(200, { sent, failed, pruned: staleUserIds.length });
});
