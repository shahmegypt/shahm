import React, { useState, useEffect } from 'react';
import { supabase, supabaseUrl, UserRole, PublicTrip, ContactCardData, RequesterRelation } from './lib/supabase';
import { LocationPicker } from './components/common/LocationPicker';
import { ReportModal } from './components/common/ReportModal';
import { RaceConditionToast } from './components/common/StateViews';
import { SafetyPanel } from './components/admin/SafetyPanel';
import { AnalyticsDashboard } from './components/admin/AnalyticsDashboard';
import { UsageMonitor } from './components/admin/UsageMonitor';
import { toWhatsAppNumber } from './lib/phone';
import { useInstallPrompt } from './lib/useInstallPrompt';
import {
  Phone,
  MessageSquare,
  Map,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  MapPin,
  X,
  ShieldCheck,
  Ban,
  AlertTriangle,
  LayoutDashboard,
  ShieldAlert,
  Server
} from 'lucide-react';

const TRIP_PUBLIC_COLUMNS = 'id, requester_id, volunteer_id, origin_area_label, destination_area_label, status, requester_relation, created_at, accepted_at, completed_at';

export const App: React.FC = () => {
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [roleSelection, setRoleSelection] = useState<UserRole | null>(null);

  // Admin View State
  const [adminTab, setAdminTab] = useState<'trips' | 'safety' | 'analytics' | 'usage'>('trips');

  // Auth States
  const [authStep, setAuthStep] = useState<'details' | 'otp'>('details');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Requester States
  const [origin, setOrigin] = useState<{ areaLabel: string; fullAddress: string; lat: number; lng: number } | null>(null);
  const [dest, setDest] = useState<{ areaLabel: string; fullAddress: string; lat: number; lng: number } | null>(null);
  const [relation, setRelation] = useState<RequesterRelation>('patient');
  const [ackChecked, setAckChecked] = useState(false);
  const [createTripLoading, setCreateTripLoading] = useState(false);
  const [activeRequesterTrip, setActiveRequesterTrip] = useState<PublicTrip | null>(null);

  // Volunteer States
  const [pendingTrips, setPendingTrips] = useState<PublicTrip[]>([]);
  const [activeVolunteerTripData, setActiveVolunteerTripData] = useState<ContactCardData | null>(null);
  const [selectedTripDetails, setSelectedTripDetails] = useState<PublicTrip | null>(null);
  const [acceptingTripId, setAcceptingTripId] = useState<string | null>(null);
  const [raceConditionDetected, setRaceConditionDetected] = useState(false);

  // Report Modal
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const { canInstall, install } = useInstallPrompt();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (data) setProfile(data);
  };

  useEffect(() => {
    if (!profile) return;

    if (profile.role === 'requester') {
      supabase
        .from('trips')
        .select(TRIP_PUBLIC_COLUMNS)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) setActiveRequesterTrip(data[0] as unknown as PublicTrip);
        });
      return;
    }

    if (profile.role === 'volunteer' || profile.role.includes('admin')) {
      supabase
        .from('trips')
        .select(TRIP_PUBLIC_COLUMNS)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setPendingTrips(data as unknown as PublicTrip[]);
        });

      supabase
        .from('trips')
        .select('id')
        .eq('volunteer_id', profile.id)
        .eq('status', 'accepted')
        .maybeSingle()
        .then(async ({ data }) => {
          if (data) {
            const { data: contact } = await supabase.rpc('reveal_contact', { p_trip_id: data.id });
            if (contact && contact.length > 0) setActiveVolunteerTripData(contact[0]);
          }
        });

      const channel = supabase
        .channel('trips-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTrip = payload.new as PublicTrip;
            if (newTrip.status === 'pending') setPendingTrips((prev) => [newTrip, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as PublicTrip;
            const targetId = updated?.id || payload.old?.id;
            if (!updated || updated.status !== 'pending') {
              if (targetId) {
                setPendingTrips((prev) => prev.filter((t) => t.id !== targetId));
                if (selectedTripDetails?.id === targetId) setSelectedTripDetails(null);
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) setPendingTrips((prev) => prev.filter((t) => t.id !== deletedId));
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setAuthLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });

    setAuthLoading(false);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setAuthStep('otp');
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setAuthLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://shahm.pages.dev',
      },
    });

    if (error) {
      setAuthLoading(false);
      setErrorMessage(`تعذر تسجيل الدخول عبر Google: ${error.message}`);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setAuthLoading(true);

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otpCode.trim(),
      type: 'email',
    });

    if (error || !data.user) {
      setAuthLoading(false);
      setErrorMessage('كود التحقق غير صحيح أو انتهت صلاحيته');
      return;
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        first_name: firstName.trim(),
        phone_number: phone.trim(),
        role: roleSelection!,
        verification_status: 'unverified',
      });

      if (profileError) {
        setAuthLoading(false);
        setErrorMessage(profileError.message);
        return;
      }
    }

    setAuthLoading(false);
    fetchProfile(data.user.id);
  };

  const handleCreateTrip = async () => {
    if (!origin || !dest || !ackChecked) return;
    setCreateTripLoading(true);
    setErrorMessage(null);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch(`${supabaseUrl}/functions/v1/create-trip-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          origin_area_label: origin.areaLabel,
          origin_address: origin.fullAddress,
          origin_lat: origin.lat,
          origin_lng: origin.lng,
          destination_area_label: dest.areaLabel,
          destination_address: dest.fullAddress,
          destination_lat: dest.lat,
          destination_lng: dest.lng,
          requester_relation: relation,
        }),
      });

      const resJson = await response.json();
      if (!response.ok) throw new Error(resJson.error || 'فشل إنشاء الطلب');

      const { data } = await supabase
        .from('trips')
        .select(TRIP_PUBLIC_COLUMNS)
        .eq('id', resJson.trip_id)
        .single();

      if (data) setActiveRequesterTrip(data as unknown as PublicTrip);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setCreateTripLoading(false);
    }
  };

  const handleAcceptTrip = async (tripId: string) => {
    setAcceptingTripId(tripId);
    setErrorMessage(null);

    const { data, error } = await supabase.rpc('accept_trip', { p_trip_id: tripId });
    setAcceptingTripId(null);

    if (error) {
      if (error.message.includes('تم قبول هذا الطلب من متطوع آخر')) {
        setRaceConditionDetected(true);
      } else {
        setErrorMessage(error.message);
      }
      setSelectedTripDetails(null);
      return;
    }

    if (data && data.length > 0) {
      setActiveVolunteerTripData(data[0]);
      setSelectedTripDetails(null);
      setPendingTrips((prev) => prev.filter((t) => t.id !== tripId));
    }
  };

  const handleCancelTrip = async (tripId: string) => {
    const { error } = await supabase.rpc('cancel_trip', { p_trip_id: tripId });
    if (!error) {
      setActiveRequesterTrip(null);
    } else {
      setErrorMessage(error.message);
    }
  };

  const handleCompleteTrip = async (tripId: string) => {
    const { error } = await supabase.rpc('complete_trip', { p_trip_id: tripId });
    if (!error) {
      setActiveRequesterTrip(null);
      setActiveVolunteerTripData(null);
    } else {
      setErrorMessage(error.message);
    }
  };

  if (profile && !profile.is_active) {
    return (
      <div className="min-h-screen bg-[#F7F8F9] flex flex-col justify-center items-center p-4 text-center">
        <div className="w-16 h-16 bg-[#FCEAEA] text-[#B53A3A] rounded-full flex items-center justify-center mx-auto mb-4">
          <Ban className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-[#1F2430] mb-2">الحساب غير نشط مؤقتاً</h2>
        <p className="text-xs text-[#6B7280] max-w-xs mb-6 leading-relaxed">
          تم تعليق استخدام هذا الحساب مؤقتاً لمراجعة معايير السلامة والتكافل.
        </p>
        <button onClick={() => supabase.auth.signOut()} className="text-xs text-[#146B44] font-bold">
          تسجيل الخروج
        </button>
      </div>
    );
  }

  if (!sessionUser && !roleSelection) {
    return (
      <div className="min-h-screen bg-[#F7F8F9] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow-sm border border-[#8A949E]/20 text-center">
          <h1 className="text-2xl font-bold text-[#1F2430] mb-1">شَهْم</h1>
          <p className="text-xs text-[#6B7280] mb-6 italic">﴿وَمَنْ أَحْيَاهَا فَكَأَنَّمَا أَحْيَا النَّاسَ جَمِيعًا﴾</p>

          <div className="space-y-3">
            <button
              onClick={() => setRoleSelection('volunteer')}
              className="w-full h-[52px] bg-[#146B44] active:bg-[#0F5636] text-white font-semibold rounded-xl text-base transition-colors flex items-center justify-center gap-2"
            >
              عندي سيارة، عايز أساعد
            </button>
            <button
              onClick={() => setRoleSelection('requester')}
              className="w-full h-[52px] bg-white border-2 border-[#146B44] text-[#146B44] font-semibold rounded-xl text-base hover:bg-[#E6F4ED] transition-colors flex items-center justify-center gap-2"
            >
              محتاج نقل لحالة علاجية
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-[#F7F8F9] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow-sm border border-[#8A949E]/20">
          <button
            onClick={() => { setRoleSelection(null); setAuthStep('details'); }}
            className="text-xs text-[#6B7280] mb-4 hover:text-[#1F2430]"
          >
            ← العودة لاختيار الدور
          </button>

          <h2 className="text-xl font-bold text-[#1F2430] mb-2">
            {authStep === 'details' ? 'تسجيل البيانات' : 'تأكيد الحساب مجاناً'}
          </h2>
          <p className="text-xs text-[#6B7280] mb-6">
            {authStep === 'details'
              ? 'الاسم ورقم الجوال للتواصل عند القبول، والبريد للتحقق المجاني'
              : `ابعتنالك كود على ${email}`}
          </p>

          {errorMessage && (
            <div className="p-3 mb-4 bg-[#FCEAEA] text-[#B53A3A] text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {authStep === 'details' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#1F2430] mb-1">اسمك الأول</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="مثال: أحمد"
                  className="w-full h-[52px] px-4 bg-white border border-[#8A949E] rounded-xl text-base text-[#1F2430] focus:border-[#2F6FED] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1F2430] mb-1">رقم الجوال (للتواصل)</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full h-[52px] px-4 bg-white border border-[#8A949E] rounded-xl text-base text-[#1F2430] focus:border-[#2F6FED] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1F2430] mb-1">البريد الإلكتروني (للتحقق)</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-[52px] px-4 bg-white border border-[#8A949E] rounded-xl text-base text-[#1F2430] focus:border-[#2F6FED] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full h-[52px] bg-[#146B44] active:bg-[#0F5636] text-white font-semibold rounded-xl text-base transition-colors flex items-center justify-center gap-2"
              >
                {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إرسال كود التحقق مجاناً'}
              </button>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={authLoading}
                className="w-full h-[52px] bg-white border border-[#8A949E] text-[#1F2430] font-semibold rounded-xl text-base hover:bg-[#F7F8F9] transition-colors flex items-center justify-center gap-2"
              >
                {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="font-bold text-[#4285F4]">G</span>}
                الدخول باستخدام Google
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#1F2430] mb-1">أدخل رمز التحقق</label>
                <input
                  type="text"
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  className="w-full h-[52px] px-4 text-center tracking-widest text-lg font-bold bg-white border border-[#8A949E] rounded-xl focus:border-[#2F6FED] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full h-[52px] bg-[#146B44] active:bg-[#0F5636] text-white font-semibold rounded-xl text-base transition-colors flex items-center justify-center gap-2"
              >
                {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد ودخول'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const isAdmin = profile?.role && ['ops_admin', 'super_admin', 'analytics_viewer'].includes(profile.role);
  // ملاحظة إصلاح: المشرفون ليسوا أبداً بدور 'requester'، لذلك تعرض تبويبة "المشاوير"
  // للمشرفين دائماً واجهة المتطوع (للعمل الميداني)، والمستخدم العادي يرى واجهته حسب دوره فقط.
  const showRequesterView = profile?.role === 'requester';
  const showVolunteerView = profile?.role === 'volunteer' || (isAdmin && adminTab === 'trips');

  return (
    <div className="min-h-screen bg-[#F7F8F9] flex flex-col text-right">
      <header className="bg-white border-b border-[#8A949E]/20 p-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#1F2430]">أهلاً، {profile?.first_name}</span>
            <span className="text-xs bg-[#E6F4ED] text-[#146B44] px-2 py-0.5 rounded-full font-medium">
              {profile?.role === 'volunteer' ? 'متطوع' : profile?.role === 'requester' ? 'صاحب طلب' : 'إدارة النظام'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {canInstall && (
              <button onClick={install} className="text-xs text-[#146B44] font-semibold">
                تثبيت التطبيق
              </button>
            )}
            <button onClick={() => supabase.auth.signOut()} className="text-xs text-[#6B7280] hover:text-[#1F2430]">
              تسجيل الخروج
            </button>
          </div>
        </div>

        {isAdmin && (
          <div className="max-w-2xl mx-auto flex gap-2 mt-3 pt-2 border-t border-[#8A949E]/10 overflow-x-auto">
            <button
              onClick={() => setAdminTab('trips')}
              className={`px-3 py-1 text-xs rounded-lg font-semibold flex items-center gap-1 ${
                adminTab === 'trips' ? 'bg-[#146B44] text-white' : 'bg-[#F7F8F9] text-[#6B7280]'
              }`}
            >
              المشاوير الميدانية
            </button>
            <button
              onClick={() => setAdminTab('safety')}
              className={`px-3 py-1 text-xs rounded-lg font-semibold flex items-center gap-1 ${
                adminTab === 'safety' ? 'bg-[#146B44] text-white' : 'bg-[#F7F8F9] text-[#6B7280]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              البلاغات والسلامة
            </button>
            <button
              onClick={() => setAdminTab('analytics')}
              className={`px-3 py-1 text-xs rounded-lg font-semibold flex items-center gap-1 ${
                adminTab === 'analytics' ? 'bg-[#146B44] text-white' : 'bg-[#F7F8F9] text-[#6B7280]'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              المؤشرات والتحليلات
            </button>
            <button
              onClick={() => setAdminTab('usage')}
              className={`px-3 py-1 text-xs rounded-lg font-semibold flex items-center gap-1 ${
                adminTab === 'usage' ? 'bg-[#146B44] text-white' : 'bg-[#F7F8F9] text-[#6B7280]'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              استهلاك الخطة المجانية
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 space-y-4">
        {isAdmin && adminTab === 'safety' && <SafetyPanel />}
        {isAdmin && adminTab === 'analytics' && <AnalyticsDashboard />}
        {isAdmin && adminTab === 'usage' && <UsageMonitor />}

        {showRequesterView && (
          <>
            {reportSuccess && (
              <div className="p-3 bg-[#E6F4ED] text-[#146B44] text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>تم استلام ملاحظتك بسرية تامة وسيتم مراجعتها من قبل المشرفين.</span>
              </div>
            )}

            {activeRequesterTrip ? (
              <div className="bg-white p-6 rounded-2xl border border-[#8A949E]/20 text-center space-y-4">
                {activeRequesterTrip.status === 'pending' ? (
                  <>
                    <div className="w-16 h-16 mx-auto bg-[#FBEFDC] rounded-full flex items-center justify-center">
                      <Clock className="w-8 h-8 text-[#8F5A0A] animate-pulse" />
                    </div>
                    <h3 className="text-lg font-bold text-[#1F2430]">جارٍ البحث عن متطوع قريب...</h3>
                    <p className="text-xs text-[#6B7280]">طلبك معروض الآن للمتطوعين على مستوى الحي لحفظ خصوصيتك</p>
                    <div className="p-3 bg-[#F7F8F9] rounded-xl text-xs text-right space-y-1">
                      <div><strong>من:</strong> {activeRequesterTrip.origin_area_label}</div>
                      <div><strong>إلى:</strong> {activeRequesterTrip.destination_area_label}</div>
                    </div>
                    <button
                      onClick={() => handleCancelTrip(activeRequesterTrip.id)}
                      className="w-full h-[48px] bg-[#FCEAEA] text-[#B53A3A] font-semibold rounded-xl text-sm hover:bg-[#B53A3A] hover:text-white transition-colors"
                    >
                      إلغاء الطلب
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 mx-auto bg-[#E6F4ED] rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-[#146B44]" />
                    </div>
                    <h3 className="text-lg font-bold text-[#1F2430]">تم قبول طلبك!</h3>
                    <p className="text-xs text-[#6B7280]">أحد المتطوعين في طريقه إليك الآن</p>
                    <button
                      onClick={() => handleCompleteTrip(activeRequesterTrip.id)}
                      className="w-full h-[52px] bg-[#146B44] text-white font-semibold rounded-xl text-base"
                    >
                      تم الوصول بأمان ✓
                    </button>
                    <button
                      onClick={() => setReportModalOpen(true)}
                      className="text-xs text-[#6B7280] hover:text-[#B53A3A] flex items-center justify-center gap-1 mx-auto mt-2"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      إبلاغ عن مشكلة في المشوار
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl border border-[#8A949E]/20 space-y-4">
                <h2 className="text-lg font-bold text-[#1F2430]">طلب نقل لموعد طبي</h2>

                {errorMessage && (
                  <div className="p-3 bg-[#FCEAEA] text-[#B53A3A] text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <LocationPicker
                  label="هتتحرك منين؟"
                  placeholder="ابحث عن منطقتك أو حيك"
                  onSelect={(val) => setOrigin(val)}
                />

                <LocationPicker
                  label="هتروح فين؟"
                  placeholder="اسم المستشفى أو المركز الطبي"
                  onSelect={(val) => setDest(val)}
                />

                <div>
                  <label className="block text-sm font-semibold text-[#1F2430] mb-2">الطلب ده لـ:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'patient', label: 'أنا' },
                      { id: 'guardian', label: 'شخص تحت رعايتي' },
                      { id: 'companion', label: 'مرافقة شخص' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setRelation(item.id as RequesterRelation)}
                        className={`h-10 text-xs font-semibold rounded-lg border transition-colors ${
                          relation === item.id
                            ? 'border-[#146B44] bg-[#E6F4ED] text-[#146B44]'
                            : 'border-[#8A949E] bg-white text-[#1F2430]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-[#F7F8F9] rounded-xl border border-[#8A949E]/30 space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ackChecked}
                      onChange={(e) => setAckChecked(e.target.checked)}
                      className="mt-1 accent-[#146B44] w-4 h-4"
                    />
                    <span className="text-xs text-[#1F2430] leading-relaxed">
                      أقر بأن هذا الطلب لحالة علاجية حقيقية، وأتحمل المسؤولية الكاملة عن دقة البيانات المُدخلة.
                    </span>
                  </label>
                </div>

                <button
                  disabled={!origin || !dest || !ackChecked || createTripLoading}
                  onClick={handleCreateTrip}
                  className="w-full h-[52px] bg-[#146B44] disabled:opacity-40 active:bg-[#0F5636] text-white font-semibold rounded-xl text-base transition-colors flex items-center justify-center gap-2"
                >
                  {createTripLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إرسال الطلب الآن'}
                </button>
              </div>
            )}
          </>
        )}

        {showVolunteerView && (
          <>
            {raceConditionDetected && (
              <RaceConditionToast onClose={() => setRaceConditionDetected(false)} />
            )}

            {activeVolunteerTripData ? (
              <div className="bg-white p-6 rounded-2xl border border-[#8A949E]/20 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs bg-[#E6F4ED] text-[#146B44] px-3 py-1 rounded-full font-semibold">
                    تم قبول المشوار بنجاح
                  </span>
                  <ShieldCheck className="w-5 h-5 text-[#146B44]" />
                </div>

                <div>
                  <h3 className="text-xl font-bold text-[#1F2430]">{activeVolunteerTripData.requester_first_name}</h3>
                  <p className="text-xs text-[#6B7280]">
                    {activeVolunteerTripData.requester_relation === 'patient' && 'مريض'}
                    {activeVolunteerTripData.requester_relation === 'guardian' && 'ولي أمر'}
                    {activeVolunteerTripData.requester_relation === 'companion' && 'مرافق'}
                  </p>
                </div>

                <div className="p-3 bg-[#F7F8F9] rounded-xl text-xs space-y-2 text-right">
                  <div><strong>نقطة الانطلاق:</strong> {activeVolunteerTripData.origin_address}</div>
                  <div><strong>الوجهة:</strong> {activeVolunteerTripData.destination_address}</div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={`tel:${activeVolunteerTripData.requester_phone}`}
                    className="h-11 bg-[#146B44] text-white rounded-xl flex items-center justify-center gap-1 text-xs font-semibold active:bg-[#0F5636]"
                  >
                    <Phone className="w-4 h-4" />
                    اتصال
                  </a>
                  <a
                    href={`https://wa.me/${toWhatsAppNumber(activeVolunteerTripData.requester_phone)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="h-11 bg-[#1E8E5A] text-white rounded-xl flex items-center justify-center gap-1 text-xs font-semibold active:bg-[#0F5636]"
                  >
                    <MessageSquare className="w-4 h-4" />
                    واتساب
                  </a>
                  <a
                    href={`https://maps.google.com/?q=${activeVolunteerTripData.origin_lat},${activeVolunteerTripData.origin_lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="h-11 bg-[#2F6FED] text-white rounded-xl flex items-center justify-center gap-1 text-xs font-semibold"
                  >
                    <Map className="w-4 h-4" />
                    الخرائط
                  </a>
                </div>

                <button
                  onClick={() => handleCompleteTrip(activeVolunteerTripData.trip_id)}
                  className="w-full h-[52px] bg-[#146B44] text-white font-semibold rounded-xl text-base active:bg-[#0F5636] transition-colors"
                >
                  ✓ تم إيصاله بأمان
                </button>

                <button
                  onClick={() => setReportModalOpen(true)}
                  className="text-xs text-[#6B7280] hover:text-[#B53A3A] flex items-center justify-center gap-1 mx-auto"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  إبلاغ عن مشكلة
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <h2 className="text-base font-bold text-[#1F2430] flex items-center justify-between">
                  <span>الطلبات المتاحة قربك</span>
                  <span className="text-xs font-normal text-[#6B7280]">({pendingTrips.length})</span>
                </h2>

                {pendingTrips.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-[#8A949E]/20 text-center space-y-2">
                    <Clock className="w-8 h-8 text-[#8A949E] mx-auto" />
                    <p className="text-sm font-semibold text-[#1F2430]">مفيش طلبات قريبة منك دلوقتي</p>
                    <p className="text-xs text-[#6B7280]">هنبلغك أول ما يظهر طلب جديد في منطقتك</p>
                  </div>
                ) : (
                  pendingTrips.map((trip) => (
                    <div
                      key={trip.id}
                      onClick={() => setSelectedTripDetails(trip)}
                      className="bg-white p-4 rounded-2xl border border-[#8A949E]/20 shadow-sm cursor-pointer hover:border-[#146B44] transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs text-[#6B7280]">
                        <span className="bg-[#FBEFDC] text-[#8F5A0A] px-2 py-0.5 rounded-md font-medium">
                          {trip.requester_relation === 'patient' && 'مريض'}
                          {trip.requester_relation === 'guardian' && 'ولي أمر'}
                          {trip.requester_relation === 'companion' && 'مرافق'}
                        </span>
                        <span>{new Date(trip.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div className="text-sm font-bold text-[#1F2430] flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#146B44] shrink-0" />
                        <span>{trip.origin_area_label}</span>
                        <span className="text-[#6B7280]">⟶</span>
                        <span>{trip.destination_area_label}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {selectedTripDetails && (
              <div className="fixed inset-0 z-50 bg-black/40 flex flex-col justify-end p-0" role="dialog" aria-modal="true">
                <div className="bg-white rounded-t-3xl p-6 space-y-4 max-w-md mx-auto w-full">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-[#1F2430]">تفاصيل المشوار</h3>
                    <button onClick={() => setSelectedTripDetails(null)} className="text-[#6B7280]">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-2 text-sm text-[#1F2430]">
                    <div><strong>من:</strong> {selectedTripDetails.origin_area_label} (منطقة تقريبية)</div>
                    <div><strong>إلى:</strong> {selectedTripDetails.destination_area_label}</div>
                  </div>

                  <div className="p-3 bg-[#E6F4ED] rounded-xl text-xs text-[#146B44] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>العنوان ورقم التواصل هيظهروا فور ما تقبل الطلب حفاظاً على خصوصية الأهالي.</span>
                  </div>

                  <button
                    disabled={acceptingTripId === selectedTripDetails.id}
                    onClick={() => handleAcceptTrip(selectedTripDetails.id)}
                    className="w-full h-[52px] bg-[#146B44] active:bg-[#0F5636] text-white font-semibold rounded-xl text-base transition-colors flex items-center justify-center gap-2"
                  >
                    {acceptingTripId === selectedTripDetails.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'قبول المشوار'
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <ReportModal
          tripId={activeVolunteerTripData?.trip_id || activeRequesterTrip?.id}
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          onSuccess={() => setReportSuccess(true)}
        />
      </main>
    </div>
  );
};

export default App;
