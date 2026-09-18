# شَهْم (Shahm) — نسخة جاهزة للرفع

هذه النسخة تتضمن تنفيذ المزايا المطلوبة في الواجهة، Supabase migration، وEdge Function.

## المزايا المضافة

- زر **استخدم موقعي الحالي** موجود في نقطة الانطلاق فقط، ويستخدم GPS ثم reverse geocoding.
- بحث Nominatim مقيد بـ `countrycodes=eg` مع فلترة إضافية لإحداثيات مصر.
- الطلبات المعروضة للمتطوعين تأتي من `get_pending_trips_nearby` وبحد أقصى **20 كم**.
- `accept_trip` يعيد التحقق من المسافة على الخادم قبل القبول.
- يتم طلب إذن الموقع للمتطوع عند فتح شاشة الطلبات.
- حجز موعد: **دلوقتي / حجز موعد** مع **النهاردة / بكرة / بعد بكرة + وقت**.
- الخادم يرفض أي موعد خارج نافذة **48 ساعة**.
- سن المريض وحالته يتم إدخالهما أثناء تسجيل صاحب الطلب مرة واحدة، ويظهران للمتطوع في البطاقة والتفاصيل وبعد القبول.
- العناوين وأرقام الهاتف لا تظهر للمتطوع قبل القبول.

## مهم قبل الرفع

طبّق ملف migration التالي على مشروع Supabase بعد migrations الأساسية:

```text
supabase/migrations/20260917000003_scheduling_distance_patient.sql
```

وبعدها انشر Edge Function:

```bash
supabase functions deploy create-trip-proxy
```

وتأكد أن متغيرات Edge Function موجودة:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ALLOWED_ORIGINS
```

`ALLOWED_ORIGINS` يجب أن يحتوي على دومين التطبيق الفعلي، أو `*` فقط إذا كان ذلك مقصودًا في بيئة الاختبار.

## التشغيل المحلي

```bash
npm install
cp .env.example .env
# ضع VITE_SUPABASE_ANON_KEY في .env
npm run typecheck
npm run build
npm run dev
```

## ملاحظات النشر

- لا تضع `SUPABASE_SERVICE_ROLE_KEY` داخل الواجهة أو `.env` الخاص بالمتصفح.
- migration الجديدة تعتمد على الـ schema الموجودة في `20260917000000_shahm_core.sql` و`20260917000001_create_trip_proxy_rpc.sql`.
- السجلات القديمة التي لم يكن لها موعد يتم تعيين `scheduled_at` لها مساويًا لـ `created_at` أثناء migration حتى لا تنكسر البيانات الموجودة.
