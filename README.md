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

## تسجيل الدخول وإنشاء الحساب

- `/login` — صفحة تسجيل الدخول: زر **Google** فقط، بدون أي حقول. لو الحساب مش مسجّل بيتحوّل المستخدم تلقائيًا لصفحة إنشاء الحساب برسالة توضيحية.
- `/signup` — صفحة إنشاء الحساب: اختيار الدور (متطوع / صاحب طلب) + الاسم والهاتف (+ عمر المريض وحالته لصاحب الطلب) ثم **التسجيل باستخدام Google**.
- البيانات بتتحفظ مؤقتًا في المتصفح لمدة 30 دقيقة قبل التحويل لـ Google، وبعد الرجوع بيتم إنشاء البروفايل منها مرة واحدة. صفحة الدخول بتمسحها دايمًا، فالدخول العادي عمره ما بيعمل حساب جديد.
- **صاحب الطلب** يقدر يعدّل اسمه وهاتفه وبيانات المريض (العمر والحالة) في أي وقت من زر **الإعدادات** في الهيدر.

### إعداد Google في Supabase

1. Supabase → Authentication → Providers → **Google** (Client ID / Secret).
2. Authentication → URL Configuration: ضع دومين التطبيق في **Site URL** وأضفه أيضًا في **Redirect URLs** (مثال: `https://your-app.pages.dev` و`http://localhost:5173` للتجربة المحلية).

## مهم قبل الرفع

طبّق الـ migrations بالترتيب (لا يوجد ملف `...0002` وده مقصود، والـ CLI بيرتّبهم بالتاريخ):

```text
supabase/migrations/20260917000000_shahm_core.sql
supabase/migrations/20260917000001_create_trip_proxy_rpc.sql
supabase/migrations/20260917000003_scheduling_distance_patient.sql
supabase/migrations/20260917000004_volunteer_contact.sql          # مُصلحة: بدون PostGIS
supabase/migrations/20260917000005_accept_trip_distance_and_profile_guard.sql
```

ثم شغّل `supabase_check.sql` في SQL Editor وراجع النتيجة المتوقعة المكتوبة فوق كل استعلام.

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

`ALLOWED_ORIGINS` يجب أن يحتوي على دومين التطبيق الفعلي، أو `*` فقط إذا كان ذلك مقصودًا في بيئة الاختبار. لو تُرك فارغًا الـ Functions بترجّع خطأ 500 واضح بدل ما ترفض الطلبات بصمت.

انشر كمان `notify-trip-accepted` و`send-push`، وأضف لـ `send-push` المتغيرات `VAPID_PRIVATE_KEY` و`VAPID_PUBLIC_KEY` (و`VAPID_SUBJECT` اختياري).

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
- موقع المتطوع الخام لا يُخزَّن؛ يُحسب فقط `accepted_distance_km` وقت القبول ويظهر لصاحب الطلب.
- السجلات القديمة التي لم يكن لها موعد يتم تعيين `scheduled_at` لها مساويًا لـ `created_at` أثناء migration حتى لا تنكسر البيانات الموجودة.
