import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  hasSupabaseConfig,
  supabase,
  supabaseUrl,
  UserRole,
  PublicTrip,
  ContactCardData,
  RequesterRelation,
} from './lib/supabase';
import { LocationPicker } from './components/common/LocationPicker';
import { ReportModal } from './components/common/ReportModal';
import { RaceConditionToast } from './components/common/StateViews';
import { SafetyPanel } from './components/admin/SafetyPanel';
import { AnalyticsDashboard } from './components/admin/AnalyticsDashboard';
import { UsageMonitor } from './components/admin/UsageMonitor';
import { toWhatsAppNumber } from './lib/phone';
import { useInstallPrompt } from './lib/useInstallPrompt';
import { registerPushNotifications } from './lib/push';
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
  Server,
  Download,
  LocateFixed,
  RefreshCw,
  Bell,
  BellRing,
  Settings,
} from 'lucide-react';

type InstallNoticeProps = {
  canInstall: boolean;
  showManualInstructions: boolean;
  onInstall: () => Promise<void>;
  onDismiss: () => void;
  message: string | null;
};

const InstallNotice: React.FC<InstallNoticeProps> = ({
  canInstall,
  showManualInstructions,
  onInstall,
  onDismiss,
  message,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
    role="dialog"
    aria-label="تثبيت تطبيق شَهْم"
  >
    <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl relative border border-[#146B44]/20">
      <button
        onClick={onDismiss}
        aria-label="إغلاق"
        className="absolute top-3 left-3 text-gray-400 hover:text-gray-600 p-1 rounded-full transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="w-16 h-16 bg-[#E6F4ED] text-[#146B44] rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
        <Download className="w-8 h-8" />
      </div>

      <h2 className="text-xl font-bold text-[#1F2430] mb-2">
        تثبيت تطبيق شَهْم
      </h2>

      {showManualInstructions ? (
        <div className="text-right bg-[#F7F8F9] p-3 rounded-xl mb-4 text-xs leading-6 text-[#6B7280] border border-gray-100">
          <p className="font-semibold text-[#1F2430] mb-1">
            خطوات التثبيت على جهازك:
          </p>

          <ol className="list-decimal pr-5 space-y-1">
            <li>اضغط زر مشاركة (Share) من المتصفح.</li>
            <li>اختر «إضافة إلى الشاشة الرئيسية».</li>
            <li>افتح شَهْم من الأيقونة مباشرة.</li>
          </ol>
        </div>
      ) : (
        <p className="text-xs text-[#6B7280] mb-6 leading-relaxed">
          قم بتثبيت التطبيق على شاشة هاتفك الرئيسية للوصول السريع،
          وتلقي التنبيهات، والعمل بأفضل أداء.
        </p>
      )}

      {message && (
        <p className="mb-4 text-xs font-semibold text-[#146B44] bg-[#E6F4ED] p-2.5 rounded-xl border border-[#146B44]/20">
          {message}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {!message && canInstall && (
          <button
            onClick={onInstall}
            className="w-full h-12 rounded-xl bg-[#146B44] active:bg-[#0F5636] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-md"
          >
            <Download className="w-4 h-4" />
            تثبيت التطبيق الآن
          </button>
        )}

        <button
          onClick={onDismiss}
          className="w-full text-[#6B7280] hover:text-[#1F2430] text-xs py-2 font-medium transition-colors"
        >
          المتابعة عبر المتصفح
        </button>
      </div>
    </div>
  </div>
);

const TRIP_PUBLIC_COLUMNS =
  'id, requester_id, volunteer_id, origin_area_label, destination_area_label, status, requester_relation, scheduled_at, created_at, accepted_at, completed_at';

const getDateTimeInputLimits = () => {
  const now = new Date();

  const minDate = new Date(now.getTime() + 5 * 60 * 1000);
  const maxDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const toLocalInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return {
    min: toLocalInput(minDate),
    max: toLocalInput(maxDate),
  };
};

const formatScheduledAt = (value?: string | null) => {
  if (!value) return 'غير محدد';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'غير محدد';
  }

  return date.toLocaleString('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const formatDistance = (distance?: number | null) => {
  if (distance === null || distance === undefined) {
    return null;
  }

  if (!Number.isFinite(Number(distance))) {
    return null;
  }

  const numericDistance = Number(distance);

  if (numericDistance < 1) {
    return `${Math.round(numericDistance * 1000)} متر`;
  }

  return `${numericDistance.toFixed(1)} كم`;
};

const formatTimeSince = (value?: string | null) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) return 'الآن';
  if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;

  const diffDays = Math.round(diffHours / 24);
  return `منذ ${diffDays} يوم`;
};

export const App: React.FC = () => {
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [roleSelection, setRoleSelection] =
    useState<UserRole | null>(null);

  const [adminTab, setAdminTab] = useState
    'trips' | 'safety' | 'analytics' | 'usage'
  >('trips');

  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');

  const [patientAge, setPatientAge] = useState('');
  const [patientCondition, setPatientCondition] = useState('');

  const [authLoading, setAuthLoading] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [sessionLoading, setSessionLoading] =
    useState(true);

  const [profileLoading, setProfileLoading] =
    useState(false);

  const [profileError, setProfileError] =
    useState<string | null>(null);

  const activeUserId = useRef<string | null>(null);

  const [origin, setOrigin] = useState<{
    areaLabel: string;
    fullAddress: string;
    lat: number;
    lng: number;
  } | null>(null);

  const [dest, setDest] = useState<{
    areaLabel: string;
    fullAddress: string;
    lat: number;
    lng: number;
  } | null>(null);

  const [relation, setRelation] =
    useState<RequesterRelation>('patient');

  const [scheduledAt, setScheduledAt] = useState('');

  const [ackChecked, setAckChecked] = useState(false);

  const [createTripLoading, setCreateTripLoading] =
    useState(false);

  const [activeRequesterTrip, setActiveRequesterTrip] =
    useState<PublicTrip | null>(null);

  const [pendingTrips, setPendingTrips] =
    useState<PublicTrip[]>([]);

  const [
    activeVolunteerTripData,
    setActiveVolunteerTripData,
  ] = useState<ContactCardData | null>(null);

  const [selectedTripDetails, setSelectedTripDetails] =
    useState<PublicTrip | null>(null);

  const [acceptingTripId, setAcceptingTripId] =
    useState<string | null>(null);

  const [raceConditionDetected, setRaceConditionDetected] =
    useState(false);

  const [volunteerLocation, setVolunteerLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [locationLoading, setLocationLoading] =
    useState(false);

  const [locationError, setLocationError] =
    useState<string | null>(null);

  const [pushLoading, setPushLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  // Volunteer's contact info, revealed to the requester once their trip
  // is accepted (mirrors activeVolunteerTripData, but for the other side).
  const [volunteerContactData, setVolunteerContactData] = useState<{
    trip_id: string;
    volunteer_first_name: string;
    volunteer_phone: string;
    accepted_at: string | null;
  } | null>(null);

  // Settings panel — available to every role to edit their own profile.
  const [showSettings, setShowSettings] = useState(false);
  const [settingsFirstName, setSettingsFirstName] = useState('');
  const [settingsPhone, setSettingsPhone] = useState('');
  const [settingsPatientAge, setSettingsPatientAge] = useState('');
  const [settingsPatientCondition, setSettingsPatientCondition] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  const [loadingNearbyTrips, setLoadingNearbyTrips] =
    useState(false);

  const [reportModalOpen, setReportModalOpen] =
    useState(false);

  const [reportSuccess, setReportSuccess] =
    useState(false);

  const [installDismissed, setInstallDismissed] =
    useState(false);

  const [installMessage, setInstallMessage] =
    useState<string | null>(null);

  const {
    canInstall,
    showManualInstructions,
    showInstallPrompt,
    install,
  } = useInstallPrompt();

  const dateTimeLimits = useMemo(
    () => getDateTimeInputLimits(),
    [],
  );

  const handleInstall = async () => {
    const installed = await install();

    setInstallMessage(
      installed
        ? 'تم تجهيز التطبيق للاستخدام بنجاح.'
        : 'لم يتم التثبيت. يمكنك المحاولة لاحقاً من قائمة المتصفح.',
    );
  };

  const installNotice =
    showInstallPrompt && !installDismissed ? (
      <InstallNotice
        canInstall={canInstall}
        showManualInstructions={showManualInstructions}
        onInstall={handleInstall}
        onDismiss={() => setInstallDismissed(true)}
        message={installMessage}
      />
    ) : null;

  const configurationNotice = !hasSupabaseConfig ? (
    <div
      className="fixed top-4 left-4 right-4 z-40 mx-auto max-w-md rounded-xl border border-[#E8A33D]/40 bg-[#FBEFDC] p-3 text-right text-xs text-[#8F5A0A]"
      role="alert"
    >
      التطبيق يحتاج ضبط مفتاح Supabase العام في إعدادات النشر قبل
      تسجيل الدخول.
    </div>
  ) : null;

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      activeUserId.current = null;

      supabase.removeAllChannels();

      localStorage.removeItem('shahm.pendingProfile');

      setSessionUser(null);
      setProfile(null);
      setRoleSelection(null);

      setFirstName('');
      setPhone('');
      setPatientAge('');
      setPatientCondition('');

      setAuthLoading(false);
      setErrorMessage(null);
      setProfileError(null);

      setPendingTrips([]);
      setActiveRequesterTrip(null);
      setActiveVolunteerTripData(null);
      setSelectedTripDetails(null);

      setAcceptingTripId(null);
      setRaceConditionDetected(false);

      setVolunteerLocation(null);
      setLocationError(null);

      setScheduledAt('');
      setOrigin(null);
      setDest(null);
      setAckChecked(false);

      setReportModalOpen(false);
      setReportSuccess(false);
      setAdminTab('trips');

      setVolunteerContactData(null);
      setShowSettings(false);
      setSettingsError(null);
      setSettingsSuccess(false);
    }
  };

  const fetchProfile = async (uid: string) => {
    setProfileLoading(true);
    setProfileError(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      if (error) throw error;

      if (activeUserId.current !== uid) return;

      if (!data) {
        const pendingProfile = JSON.parse(
          localStorage.getItem('shahm.pendingProfile') ||
            'null',
        );

        if (
          pendingProfile?.firstName &&
          pendingProfile?.phone &&
          pendingProfile?.role
        ) {
          const isRequester =
            pendingProfile.role === 'requester';

          const age = Number(
            pendingProfile.patientAge,
          );

          if (
            isRequester &&
            (!Number.isInteger(age) ||
              age < 0 ||
              age > 120)
          ) {
            throw new Error(
              'بيانات عمر المريض غير صحيحة. أعد تسجيل الدخول وأدخل العمر بشكل صحيح.',
            );
          }

          if (
            isRequester &&
            typeof pendingProfile.patientCondition !==
              'string'
          ) {
            throw new Error(
              'بيانات الحالة الصحية غير مكتملة.',
            );
          }

          const { data: createdProfile, error: createError } =
            await supabase
              .from('profiles')
              .upsert(
                {
                  id: uid,
                  first_name:
                    pendingProfile.firstName,
                  phone_number:
                    pendingProfile.phone,
                  role: pendingProfile.role,
                  verification_status:
                    'unverified',
                  ...(isRequester
                    ? {
                        patient_age: age,
                        patient_condition:
                          pendingProfile.patientCondition.trim(),
                      }
                    : {}),
                },
                { onConflict: 'id' },
              )
              .select()
              .single();

          if (createError) throw createError;

          if (activeUserId.current !== uid) return;

          setProfile(createdProfile);

          localStorage.removeItem(
            'shahm.pendingProfile',
          );
        } else {
          setProfile(null);

          setProfileError(
            'بيانات الحساب غير مكتملة. سجّل الخروج وأعد الدخول بعد اختيار الدور.',
          );
        }
      } else {
        setProfile(data);
      }
    } catch (error: unknown) {
      setProfile(null);

      setProfileError(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل بيانات المستخدم',
      );
    } finally {
      setProfileLoading(false);
      setSessionLoading(false);
    }
  };

  const handleEnablePushNotifications = async () => {
    if (pushLoading || pushEnabled) return;

    setPushError(null);
    setPushLoading(true);

    try {
      const enabled = await registerPushNotifications();

      if (enabled) {
        setPushEnabled(true);
      } else {
        setPushError(
          'لم يتم تفعيل الإشعارات. اسمح بالإشعارات من إعدادات المتصفح ثم حاول مرة أخرى.',
        );
      }
    } catch (error) {
      console.error('Enable push notifications failed:', error);
      setPushError('تعذر تفعيل الإشعارات. حاول مرة أخرى.');
    } finally {
      setPushLoading(false);
    }
  };

  // Reflect the browser's actual permission state on load, so a user who
  // already granted (or previously denied) notifications doesn't see a
  // stale "not enabled" state after a refresh or on another screen.
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      setPushEnabled(true);
    }
  }, []);

  // Ask for notification permission exactly once per device, shortly
  // after login, for any role — then never again automatically. The
  // browser's own permission prompt is the only thing shown; there is no
  // persistent banner. Whether the user allows or dismisses it, a control
  // to (re)enable notifications remains available afterwards in Settings.
  useEffect(() => {
    if (!profile) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;

    const alreadyPrompted = localStorage.getItem('shahm.pushPrompted');
    if (alreadyPrompted) return;

    localStorage.setItem('shahm.pushPrompted', '1');

    const timer = setTimeout(() => {
      void handleEnablePushNotifications();
    }, 1500);

    return () => clearTimeout(timer);
  }, [profile]);

  const requestVolunteerLocation = () => {
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError(
        'المتصفح لا يدعم تحديد الموقع.',
      );
      return;
    }

    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng)
        ) {
          setLocationError(
            'تعذر قراءة موقعك الحالي.',
          );

          setLocationLoading(false);
          return;
        }

        setVolunteerLocation({
          lat,
          lng,
        });

        setLocationLoading(false);
      },
      (error) => {
        let message =
          'تعذر الحصول على موقعك الحالي.';

        if (
          error.code ===
          error.PERMISSION_DENIED
        ) {
          message =
            'اسمح للتطبيق باستخدام موقعك حتى نعرض الطلبات الموجودة ضمن 20 كم منك.';
        } else if (
          error.code ===
          error.POSITION_UNAVAILABLE
        ) {
          message =
            'موقعك الحالي غير متاح. جرّب تشغيل GPS ثم المحاولة مرة أخرى.';
        } else if (
          error.code ===
          error.TIMEOUT
        ) {
          message =
            'انتهى وقت انتظار تحديد الموقع. حاول مرة أخرى.';
        }

        setLocationError(message);
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      },
    );
  };

  const loadNearbyTrips = async (
    locationOverride?: {
      lat: number;
      lng: number;
    },
  ) => {
    if (profile?.role !== 'volunteer') {
      return;
    }

    const location =
      locationOverride ||
      volunteerLocation;

    if (!location) return;

    setLoadingNearbyTrips(true);

    try {
      const { data, error } =
        await supabase.rpc(
          'get_pending_trips_nearby',
          {
            p_lat: location.lat,
            p_lng: location.lng,
            p_radius_km: 20,
          },
        );

      if (error) throw error;

      setPendingTrips(
        (data || []) as unknown as PublicTrip[],
      );
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل الطلبات القريبة',
      );
    } finally {
      setLoadingNearbyTrips(false);
    }
  };

  const loadActiveVolunteerTrip = async (
    uid: string,
  ) => {
    const { data, error } =
      await supabase
        .from('trips')
        .select('id')
        .eq('volunteer_id', uid)
        .eq('status', 'accepted')
        .limit(1)
        .maybeSingle();

    if (error || !data) {
      return;
    }

    const { data: contact, error: contactError } =
      await supabase.rpc(
        'reveal_contact',
        {
          p_trip_id: data.id,
        },
      );

    if (
      !contactError &&
      contact &&
      contact.length > 0
    ) {
      setActiveVolunteerTripData(
        contact[0] as ContactCardData,
      );
    }
  };

  useEffect(() => {
    let cancelled = false;

    supabase.auth
      .getSession()
      .then(
        ({
          data: { session },
          error,
        }) => {
          if (cancelled) return;

          if (error) {
            setProfileError(
              `تعذر استعادة جلسة الدخول: ${error.message}`,
            );
          }

          setSessionUser(
            session?.user ?? null,
          );

          activeUserId.current =
            session?.user.id ?? null;

          if (session?.user) {
            void fetchProfile(
              session.user.id,
            );
          } else {
            setSessionLoading(false);
          }
        },
      )
      .catch((error: unknown) => {
        if (cancelled) return;

        setProfileError(
          error instanceof Error
            ? error.message
            : 'تعذر استعادة جلسة الدخول',
        );

        setSessionLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSessionUser(
          session?.user ?? null,
        );

        activeUserId.current =
          session?.user.id ?? null;

        if (session?.user) {
          void fetchProfile(
            session.user.id,
          );
        } else {
          setProfile(null);
          setProfileError(null);
        }

        setSessionLoading(false);
      },
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!profile) return;

    if (profile.role === 'requester') {
      const fetchActiveRequesterTrip = () => {
        supabase
          .from('trips')
          .select(TRIP_PUBLIC_COLUMNS)
          .in('status', [
            'pending',
            'accepted',
          ])
          .eq('requester_id', profile.id)
          .order('created_at', {
            ascending: false,
          })
          .limit(1)
          .then(({ data, error }) => {
            if (error) {
              setErrorMessage(error.message);
              return;
            }

            if (
              data &&
              data.length > 0
            ) {
              const trip = data[0] as unknown as PublicTrip;
              setActiveRequesterTrip(trip);

              if (trip.status === 'accepted') {
                void supabase
                  .rpc('reveal_volunteer_contact', { p_trip_id: trip.id })
                  .then(({ data: contact, error: contactError }) => {
                    if (!contactError && contact && contact.length > 0) {
                      setVolunteerContactData(contact[0]);
                    }
                  });
              } else {
                setVolunteerContactData(null);
              }
            } else {
              setActiveRequesterTrip(null);
              setVolunteerContactData(null);
            }
          });
      };

      fetchActiveRequesterTrip();

      const requesterChannel = supabase
        .channel(`trips-requester-realtime-${profile.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'trips',
            filter: `requester_id=eq.${profile.id}`,
          },
          () => fetchActiveRequesterTrip(),
        )
        .subscribe();

      return () => {
        supabase.removeChannel(requesterChannel);
      };
    }

    if (profile.role === 'volunteer') {
      requestVolunteerLocation();

      void loadActiveVolunteerTrip(
        profile.id,
      );

      const channel = supabase
        .channel(
          `trips-realtime-${profile.id}`,
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'trips',
          },
          () => {
            if (volunteerLocation) {
              void loadNearbyTrips(
                volunteerLocation,
              );
            }
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    /*
     * الـ Admin لا يستخدم get_pending_trips_nearby
     * لأنها مخصصة للـ volunteer فقط.
     *
     * نترك شاشة الإدارة تعتمد على صلاحيات RLS الموجودة
     * في المشروع بدون طلب GPS.
     */
    if (
      profile.role === 'ops_admin' ||
      profile.role === 'super_admin' ||
      profile.role === 'analytics_viewer'
    ) {
      const channel = supabase
        .channel(
          `admin-trips-realtime-${profile.id}`,
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'trips',
          },
          () => {
            /*
             * شاشة الإدارة تعالج بياناتها من مكوناتها
             * الحالية. لا نستدعي RPC الخاص بالمتطوع.
             */
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile]);

  useEffect(() => {
    if (
      profile?.role !== 'volunteer' ||
      !volunteerLocation
    ) {
      return;
    }

    void loadNearbyTrips(
      volunteerLocation,
    );
  }, [
    profile?.role,
    volunteerLocation,
  ]);

  const handleOpenSettings = () => {
    setSettingsFirstName(profile?.first_name ?? '');
    setSettingsPhone(profile?.phone_number ?? '');
    setSettingsPatientAge(
      profile?.patient_age !== null && profile?.patient_age !== undefined
        ? String(profile.patient_age)
        : '',
    );
    setSettingsPatientCondition(profile?.patient_condition ?? '');
    setSettingsError(null);
    setSettingsSuccess(false);
    setShowSettings(true);
  };

  const handleSaveSettings = async () => {
    setSettingsError(null);
    setSettingsSuccess(false);

    if (
      !settingsFirstName.trim() ||
      !/^01\d{9}$/.test(settingsPhone.trim())
    ) {
      setSettingsError('أدخل الاسم ورقم هاتف مصري صحيح يبدأ بـ 01.');
      return;
    }

    const updates: Record<string, unknown> = {
      first_name: settingsFirstName.trim(),
      phone_number: settingsPhone.trim(),
    };

    if (profile?.role === 'requester') {
      const age = Number(settingsPatientAge);

      if (!Number.isInteger(age) || age < 0 || age > 120) {
        setSettingsError('أدخل عمر المريض من 0 إلى 120 سنة.');
        return;
      }

      if (
        !settingsPatientCondition.trim() ||
        settingsPatientCondition.trim().length > 500
      ) {
        setSettingsError('اكتب وصفًا مختصرًا للحالة الصحية بحد أقصى 500 حرف.');
        return;
      }

      updates.patient_age = age;
      updates.patient_condition = settingsPatientCondition.trim();
    }

    setSettingsSaving(true);

    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id)
      .select()
      .single();

    setSettingsSaving(false);

    if (error) {
      setSettingsError(error.message);
      return;
    }

    setProfile(updatedProfile);
    setSettingsSuccess(true);
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);

    if (
      !firstName.trim() ||
      !/^01\d{9}$/.test(
        phone.trim(),
      )
    ) {
      setErrorMessage(
        'أدخل الاسم ورقم هاتف مصري صحيح يبدأ بـ 01.',
      );
      return;
    }

    if (
      roleSelection === 'requester'
    ) {
      const age = Number(
        patientAge,
      );

      if (
        !Number.isInteger(age) ||
        age < 0 ||
        age > 120
      ) {
        setErrorMessage(
          'أدخل عمر المريض من 0 إلى 120 سنة.',
        );
        return;
      }

      if (
        !patientCondition.trim() ||
        patientCondition.trim().length >
          500
      ) {
        setErrorMessage(
          'اكتب وصفًا مختصرًا للحالة الصحية بحد أقصى 500 حرف.',
        );
        return;
      }
    }

    localStorage.setItem(
      'shahm.pendingProfile',
      JSON.stringify({
        firstName:
          firstName.trim(),

        phone:
          phone.trim(),

        role:
          roleSelection,

        ...(roleSelection ===
        'requester'
          ? {
              patientAge:
                Number(patientAge),

              patientCondition:
                patientCondition.trim(),
            }
          : {}),
      }),
    );

    setAuthLoading(true);

    const { error } =
      await supabase.auth.signInWithOAuth(
        {
          provider: 'google',

          options: {
            redirectTo:
              window.location.origin,

            queryParams: {
              prompt:
                'select_account',
            },
          },
        },
      );

    if (error) {
      setAuthLoading(false);

      setErrorMessage(
        `تعذر تسجيل الدخول عبر Google: ${error.message}`,
      );
    }
  };

  const handleCreateTrip = async () => {
    if (
      !origin ||
      !dest ||
      !ackChecked ||
      !scheduledAt
    ) {
      return;
    }

    const selectedDate =
      new Date(scheduledAt);

    const now = Date.now();

    const max =
      now +
      48 *
        60 *
        60 *
        1000;

    if (
      Number.isNaN(
        selectedDate.getTime(),
      ) ||
      selectedDate.getTime() <=
        now ||
      selectedDate.getTime() > max
    ) {
      setErrorMessage(
        'اختار موعدًا مستقبليًا خلال الـ 48 ساعة القادمة.',
      );
      return;
    }

    setCreateTripLoading(true);
    setErrorMessage(null);

    try {
      const session =
        (
          await supabase.auth.getSession()
        ).data.session;

      if (
        !session?.access_token
      ) {
        throw new Error(
          'انتهت جلسة الدخول. سجّل الدخول مرة أخرى.',
        );
      }

      const response =
        await fetch(
          `${supabaseUrl}/functions/v1/create-trip-proxy`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body: JSON.stringify({
              origin_area_label:
                origin.areaLabel,

              origin_address:
                origin.fullAddress,

              origin_lat:
                origin.lat,

              origin_lng:
                origin.lng,

              destination_area_label:
                dest.areaLabel,

              destination_address:
                dest.fullAddress,

              destination_lat:
                dest.lat,

              destination_lng:
                dest.lng,

              requester_relation:
                relation,

              scheduled_at:
                selectedDate.toISOString(),
            }),
          },
        );

      const responseText =
        await response.text();

      let resJson: {
        error?: string;
        trip_id?: string;
      } = {};

      try {
        resJson =
          JSON.parse(
            responseText,
          );
      } catch {
        resJson = {
          error:
            responseText,
        };
      }

      if (!response.ok) {
        throw new Error(
          resJson.error ||
            `فشل إنشاء الطلب (${response.status})`,
        );
      }

      if (!resJson.trip_id) {
        throw new Error(
          'تم استلام الطلب بدون رقم طلب من الخادم',
        );
      }

      /*
       * لا نعتمد على قراءة trips بعد الإنشاء.
       * نبني الحالة محليًا من البيانات التي أرسلناها،
       * وبذلك لا نتأثر بقيود RLS على الطلبات المعلقة.
       */
      const newTrip: PublicTrip = {
        id:
          resJson.trip_id,

        requester_id:
          profile?.id ||
          session.user.id,

        volunteer_id:
          null,

        origin_area_label:
          origin.areaLabel,

        destination_area_label:
          dest.areaLabel,

        status:
          'pending',

        requester_relation:
          relation,

        scheduled_at:
          selectedDate.toISOString(),

        created_at:
          new Date().toISOString(),

        accepted_at:
          null,

        completed_at:
          null,
      };

      setActiveRequesterTrip(
        newTrip,
      );

      setScheduledAt('');
      setOrigin(null);
      setDest(null);
      setAckChecked(false);
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          'تعذر إنشاء طلب النقل.',
      );
    } finally {
      setCreateTripLoading(false);
    }
  };

  const handleAcceptTrip = async (
    tripId: string,
  ) => {
    if (!volunteerLocation) {
      setErrorMessage(
        'لازم نحدد موقعك الحالي قبل قبول المشوار.',
      );

      requestVolunteerLocation();

      return;
    }

    setAcceptingTripId(
      tripId,
    );

    setErrorMessage(null);

    const {
      data,
      error,
    } = await supabase.rpc(
      'accept_trip',
      {
        p_trip_id:
          tripId,

        p_volunteer_lat:
          volunteerLocation.lat,

        p_volunteer_lng:
          volunteerLocation.lng,
      },
    );

    setAcceptingTripId(
      null,
    );

    if (error) {
      if (
        error.message.includes(
          'تم قبول هذا الطلب من متطوع آخر',
        )
      ) {
        setRaceConditionDetected(
          true,
        );
      } else {
        setErrorMessage(
          error.message,
        );
      }

      setSelectedTripDetails(
        null,
      );

      await loadNearbyTrips(
        volunteerLocation,
      );

      return;
    }

    if (
      data &&
      data.length > 0
    ) {
      setActiveVolunteerTripData(
        data[0] as ContactCardData,
      );

      setSelectedTripDetails(
        null,
      );

      setPendingTrips(
        (prev) =>
          prev.filter(
            (trip) =>
              trip.id !== tripId,
          ),
      );

      // Best-effort: let the requester know their trip was accepted.
      // Never blocks the UI and never surfaces as an error to the
      // volunteer if it fails — the trip itself already succeeded.
      void (async () => {
        try {
          const session = (await supabase.auth.getSession()).data.session;
          if (!session?.access_token) return;

          await fetch(`${supabaseUrl}/functions/v1/notify-trip-accepted`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ trip_id: tripId }),
          });
        } catch (notifyError) {
          console.error('notify-trip-accepted failed', notifyError);
        }
      })();
    }
  };

  const handleCancelTrip = async (
    tripId: string,
  ) => {
    const { error } =
      await supabase.rpc(
        'cancel_trip',
        {
          p_trip_id:
            tripId,
        },
      );

    if (!error) {
      setActiveRequesterTrip(
        null,
      );
    } else {
      setErrorMessage(
        error.message,
      );
    }
  };

  const handleCompleteTrip = async (
    tripId: string,
  ) => {
    const { error } =
      await supabase.rpc(
        'complete_trip',
        {
          p_trip_id:
            tripId,
        },
      );

    if (!error) {
      setActiveRequesterTrip(
        null,
      );

      setActiveVolunteerTripData(
        null,
      );
    } else {
      setErrorMessage(
        error.message,
      );
    }
  };

  if (
    sessionLoading ||
    (sessionUser &&
      profileLoading)
  ) {
    return (
      <div className="min-h-screen bg-[#F7F8F9] flex items-center justify-center p-4 text-[#6B7280]">
        <div
          className="flex items-center gap-2 text-sm"
          role="status"
        >
          <Loader2 className="w-5 h-5 animate-spin text-[#146B44]" />

          جاري تحميل الحساب...
        </div>
      </div>
    );
  }

  if (
    sessionUser &&
    profileError
  ) {
    return (
      <div className="min-h-screen bg-[#F7F8F9] flex items-center justify-center p-4 text-center">
        <div className="w-full max-w-sm bg-white p-6 rounded-2xl border border-[#FCEAEA] space-y-3">
          <AlertCircle className="w-8 h-8 mx-auto text-[#B53A3A]" />

          <h2 className="font-bold text-[#1F2430]">
            تعذر تحميل دور الحساب
          </h2>

          <p className="text-xs text-[#6B7280]">
            {profileError}
          </p>

          <button
            onClick={
              handleSignOut
            }
            className="text-xs text-[#146B44] font-bold"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  if (
    profile &&
    !profile.is_active
  ) {
    return (
      <div className="min-h-screen bg-[#F7F8F9] flex flex-col justify-center items-center p-4 text-center">
        <div className="w-16 h-16 bg-[#FCEAEA] text-[#B53A3A] rounded-full flex items-center justify-center mx-auto mb-4">
          <Ban className="w-8 h-8" />
        </div>

        <h2 className="text-lg font-bold text-[#1F2430] mb-2">
          الحساب غير نشط مؤقتاً
        </h2>

        <p className="text-xs text-[#6B7280] max-w-xs mb-6 leading-relaxed">
          تم تعليق استخدام هذا الحساب مؤقتاً لمراجعة
          معايير السلامة والتكافل.
        </p>

        <button
          onClick={
            handleSignOut
          }
          className="text-xs text-[#146B44] font-bold"
        >
          تسجيل الخروج
        </button>
      </div>
    );
  }

  if (
    !sessionUser &&
    !roleSelection
  ) {
    return (
      <div className="min-h-screen bg-[#F7F8F9] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow-sm border border-[#8A949E]/20 text-center">
          <h1 className="text-2xl font-bold text-[#1F2430] mb-1">
            شَهْم
          </h1>

          <p className="text-xs text-[#6B7280] mb-6 italic">
            ﴿وَمَنْ أَحْيَاهَا فَكَأَنَّمَا أَحْيَا
            النَّاسَ جَمِيعًا﴾
          </p>

          <div className="space-y-3">
            <button
              onClick={() =>
                setRoleSelection(
                  'volunteer',
                )
              }
              className="w-full h-[52px] bg-[#146B44] active:bg-[#0F5636] text-white font-semibold rounded-xl text-base transition-colors flex items-center justify-center gap-2"
            >
              عندي سيارة، عايز أساعد
            </button>

            <button
              onClick={() =>
                setRoleSelection(
                  'requester',
                )
              }
              className="w-full h-[52px] bg-white border-2 border-[#146B44] text-[#146B44] font-semibold rounded-xl text-base hover:bg-[#E6F4ED] transition-colors flex items-center justify-center gap-2"
            >
              محتاج نقل لحالة علاجية
            </button>
          </div>
        </div>

        {configurationNotice}
        {installNotice}
      </div>
    );
  }

  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-[#F7F8F9] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow-sm border border-[#8A949E]/20">
          <button
            onClick={() =>
              setRoleSelection(null)
            }
            className="text-xs text-[#6B7280] mb-4 hover:text-[#1F2430]"
          >
            ← العودة لاختيار الدور
          </button>

          <h2 className="text-xl font-bold text-[#1F2430] mb-2">
            تسجيل البيانات
          </h2>

          <p className="text-xs text-[#6B7280] mb-6">
            الاسم ورقم الجوال للتواصل عند القبول
          </p>

          {errorMessage && (
            <div className="p-3 mb-4 bg-[#FCEAEA] text-[#B53A3A] text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />

              <span>
                {errorMessage}
              </span>
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();

              void handleGoogleLogin();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-semibold text-[#1F2430] mb-1">
                اسمك الأول
              </label>

              <input
                type="text"
                required
                value={firstName}
                onChange={(e) =>
                  setFirstName(
                    e.target.value,
                  )
                }
                placeholder="مثال: أحمد"
                className="w-full h-[52px] px-4 bg-white border border-[#8A949E] rounded-xl text-base text-[#1F2430] focus:border-[#2F6FED] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1F2430] mb-1">
                رقم الجوال (للتواصل)
              </label>

              <input
                type="tel"
                required
                value={phone}
                onChange={(e) =>
                  setPhone(
                    e.target.value,
                  )
                }
                placeholder="01XXXXXXXXX"
                className="w-full h-[52px] px-4 bg-white border border-[#8A949E] rounded-xl text-base text-[#1F2430] focus:border-[#2F6FED] focus:outline-none"
              />
            </div>

            {roleSelection ===
              'requester' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-[#1F2430] mb-1">
                    عمر المريض
                  </label>

                  <input
                    type="number"
                    required
                    min={0}
                    max={120}
                    value={patientAge}
                    onChange={(e) =>
                      setPatientAge(
                        e.target.value,
                      )
                    }
                    placeholder="مثال: 45"
                    className="w-full h-[52px] px-4 bg-white border border-[#8A949E] rounded-xl text-base text-[#1F2430] focus:border-[#2F6FED] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1F2430] mb-1">
                    وصف مختصر للحالة الصحية
                  </label>

                  <textarea
                    required
                    maxLength={500}
                    value={patientCondition}
                    onChange={(e) =>
                      setPatientCondition(
                        e.target.value,
                      )
                    }
                    placeholder="مثال: جلسات غسيل كلى، متابعة أورام، علاج طبيعي..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white border border-[#8A949E] rounded-xl text-sm text-[#1F2430] focus:border-[#2F6FED] focus:outline-none resize-none"
                  />

                  <p className="text-[10px] text-[#6B7280] mt-1">
                    البيانات تستخدم لتنسيق المشوار وتظهر للمتطوع
                    بعد قبول الطلب.
                  </p>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() =>
                void handleGoogleLogin()
              }
              disabled={authLoading}
              className="w-full h-[52px] bg-white border border-[#8A949E] text-[#1F2430] font-semibold rounded-xl text-base hover:bg-[#F7F8F9] transition-colors flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="font-bold text-[#4285F4]">
                  G
                </span>
              )}

              الدخول باستخدام Google
            </button>
          </form>
        </div>

        {configurationNotice}
        {installNotice}
      </div>
    );
  }

  const isAdmin =
    profile?.role &&
    [
      'ops_admin',
      'super_admin',
      'analytics_viewer',
    ].includes(profile.role);

  const showRequesterView =
    profile?.role === 'requester';

  const showVolunteerView =
    profile?.role === 'volunteer' ||
    (isAdmin &&
      adminTab === 'trips');

  if (
    sessionUser &&
    ![
      'requester',
      'volunteer',
      'ops_admin',
      'super_admin',
      'analytics_viewer',
    ].includes(
      profile?.role,
    )
  ) {
    return (
      <div className="min-h-screen bg-[#F7F8F9] flex items-center justify-center p-4 text-center">
        <div className="w-full max-w-sm bg-white p-6 rounded-2xl border border-[#8A949E]/20 space-y-3">
          <AlertCircle className="w-8 h-8 mx-auto text-[#B53A3A]" />

          <h2 className="font-bold text-[#1F2430]">
            الدور غير مكتمل
          </h2>

          <p className="text-xs text-[#6B7280]">
            حسابك لا يحتوي على دور صالح في جدول profiles.
          </p>

          <button
            onClick={
              handleSignOut
            }
            className="text-xs text-[#146B44] font-bold"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8F9] flex flex-col text-right">
      {configurationNotice}
      {installNotice}

      <header className="bg-white border-b border-[#8A949E]/20 p-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#1F2430]">
              أهلاً، {profile?.first_name}
            </span>

            <span className="text-xs bg-[#E6F4ED] text-[#146B44] px-2 py-0.5 rounded-full font-medium">
              {profile?.role ===
              'volunteer'
                ? 'متطوع'
                : profile?.role ===
                    'requester'
                  ? 'صاحب طلب'
                  : 'إدارة النظام'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {canInstall && (
              <button
                onClick={install}
                className="text-xs text-[#146B44] font-semibold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                تثبيت التطبيق
              </button>
            )}

            <button
              onClick={handleOpenSettings}
              aria-label="الإعدادات"
              className="text-[#6B7280] hover:text-[#1F2430] p-1"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={
                handleSignOut
              }
              className="text-xs text-[#6B7280] hover:text-[#1F2430]"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>

        {isAdmin && (
          <div className="max-w-2xl mx-auto flex gap-2 mt-3 pt-2 border-t border-[#8A949E]/10 overflow-x-auto">
            <button
              onClick={() =>
                setAdminTab('trips')
              }
              className={`px-3 py-1 text-xs rounded-lg font-semibold flex items-center gap-1 ${
                adminTab ===
                'trips'
                  ? 'bg-[#146B44] text-white'
                  : 'bg-[#F7F8F9] text-[#6B7280]'
              }`}
            >
              المشاوير الميدانية
            </button>

            <button
              onClick={() =>
                setAdminTab('safety')
              }
              className={`px-3 py-1 text-xs rounded-lg font-semibold flex items-center gap-1 ${
                adminTab ===
                'safety'
                  ? 'bg-[#146B44] text-white'
                  : 'bg-[#F7F8F9] text-[#6B7280]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              البلاغات والسلامة
            </button>

            <button
              onClick={() =>
                setAdminTab('analytics')
              }
              className={`px-3 py-1 text-xs rounded-lg font-semibold flex items-center gap-1 ${
                adminTab ===
                'analytics'
                  ? 'bg-[#146B44] text-white'
                  : 'bg-[#F7F8F9] text-[#6B7280]'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              المؤشرات والتحليلات
            </button>

            <button
              onClick={() =>
                setAdminTab('usage')
              }
              className={`px-3 py-1 text-xs rounded-lg font-semibold flex items-center gap-1 ${
                adminTab ===
                'usage'
                  ? 'bg-[#146B44] text-white'
                  : 'bg-[#F7F8F9] text-[#6B7280]'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              استهلاك الخطة المجانية
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 space-y-4">
        {isAdmin &&
          adminTab ===
            'safety' && (
            <SafetyPanel />
          )}

        {isAdmin &&
          adminTab ===
            'analytics' && (
            <AnalyticsDashboard />
          )}

        {isAdmin &&
          adminTab ===
            'usage' && (
            <UsageMonitor />
          )}

        {showRequesterView && (
          <>
            {reportSuccess && (
              <div className="p-3 bg-[#E6F4ED] text-[#146B44] text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />

                <span>
                  تم استلام ملاحظتك بسرية تامة وسيتم مراجعتها
                  من قبل المشرفين.
                </span>
              </div>
            )}

            {activeRequesterTrip ? (
              <div className="bg-white p-6 rounded-2xl border border-[#8A949E]/20 text-center space-y-4">
                {activeRequesterTrip.status ===
                'pending' ? (
                  <>
                    <div className="w-16 h-16 mx-auto bg-[#FBEFDC] rounded-full flex items-center justify-center">
                      <Clock className="w-8 h-8 text-[#8F5A0A] animate-pulse" />
                    </div>

                    <h3 className="text-lg font-bold text-[#1F2430]">
                      جارٍ البحث عن متطوع قريب...
                    </h3>

                    <p className="text-xs text-[#6B7280]">
                      طلبك معروض للمتطوعين الموجودين ضمن
                      النطاق الجغرافي المحدد
                    </p>

                    <div className="p-3 bg-[#F7F8F9] rounded-xl text-xs text-right space-y-2">
                      <div>
                        <strong>من:</strong>{' '}
                        {
                          activeRequesterTrip.origin_area_label
                        }
                      </div>

                      <div>
                        <strong>إلى:</strong>{' '}
                        {
                          activeRequesterTrip.destination_area_label
                        }
                      </div>

                      <div>
                        <strong>الموعد:</strong>{' '}
                        {formatScheduledAt(
                          activeRequesterTrip.scheduled_at,
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        void handleCancelTrip(
                          activeRequesterTrip.id,
                        )
                      }
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

                    <h3 className="text-lg font-bold text-[#1F2430]">
                      تم قبول طلبك!
                    </h3>

                    <p className="text-xs text-[#6B7280]">
                      أحد المتطوعين قبل طلب النقل الخاص بك.
                    </p>

                    <div className="p-3 bg-[#F7F8F9] rounded-xl text-xs text-right">
                      <strong>الموعد:</strong>{' '}
                      {formatScheduledAt(
                        activeRequesterTrip.scheduled_at,
                      )}
                    </div>

                    {volunteerContactData && (
                      <div className="p-3 bg-[#E6F4ED] rounded-xl text-right space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[#1F2430]">
                            {volunteerContactData.volunteer_first_name}
                          </span>
                          <span className="text-[11px] text-[#146B44] font-semibold">
                            {formatTimeSince(volunteerContactData.accepted_at) &&
                              `قبل طلبك ${formatTimeSince(volunteerContactData.accepted_at)}`}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          
                            href={`tel:${volunteerContactData.volunteer_phone}`}
                            className="h-11 bg-[#146B44] text-white rounded-xl flex items-center justify-center gap-1 text-xs font-semibold active:bg-[#0F5636]"
                          >
                            <Phone className="w-4 h-4" />
                            اتصال بالمتطوع
                          </a>

                          
                            href={`https://wa.me/${toWhatsAppNumber(
                              volunteerContactData.volunteer_phone,
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="h-11 bg-[#1E8E5A] text-white rounded-xl flex items-center justify-center gap-1 text-xs font-semibold active:bg-[#0F5636]"
                          >
                            <MessageSquare className="w-4 h-4" />
                            واتساب
                          </a>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() =>
                        void handleCompleteTrip(
                          activeRequesterTrip.id,
                        )
                      }
                      className="w-full h-[52px] bg-[#146B44] text-white font-semibold rounded-xl text-base"
                    >
                      تم الوصول بأمان ✓
                    </button>

                    <button
                      onClick={() =>
                        setReportModalOpen(
                          true,
                        )
                      }
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
                <h2 className="text-lg font-bold text-[#1F2430]">
                  طلب نقل لموعد طبي
                </h2>

                {errorMessage && (
                  <div className="p-3 bg-[#FCEAEA] text-[#B53A3A] text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />

                    <span>
                      {errorMessage}
                    </span>
                  </div>
                )}

            <LocationPicker
                  label="هتتحرك منين؟"
                  placeholder="ابحث عن منطقتك أو حيك"
                  onSelect={(val) =>
                    setOrigin(val)
                  }
                  allowCurrentLocation
                />

                <LocationPicker
                  label="هتروح فين؟"
                  placeholder="اسم المستشفى أو المركز الطبي"
                  onSelect={(val) =>
                    setDest(val)
                  }
                />

                <div>
                  <label className="block text-sm font-semibold text-[#1F2430] mb-2">
                    موعد المشوار
                  </label>

                  <input
                    type="datetime-local"
                    required
                    min={
                      dateTimeLimits.min
                    }
                    max={
                      dateTimeLimits.max
                    }
                    value={scheduledAt}
                    onChange={(e) =>
                      setScheduledAt(
                        e.target.value,
                      )
                    }
                    className="w-full h-[52px] px-4 bg-white border border-[#8A949E] rounded-xl text-base text-[#1F2430] focus:border-[#2F6FED] focus:outline-none"
                  />

                  <p className="text-[10px] text-[#6B7280] mt-1">
                    يمكن اختيار موعد خلال الـ 48 ساعة القادمة فقط.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1F2430] mb-2">
                    الطلب ده لـ:
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        id: 'patient',
                        label: 'أنا',
                      },
                      {
                        id: 'guardian',
                        label: 'شخص تحت رعايتي',
                      },
                      {
                        id: 'companion',
                        label: 'مرافقة شخص',
                      },
                    ].map(
                      (item) => (
                        <button
                          key={
                            item.id
                          }
                          type="button"
                          onClick={() =>
                            setRelation(
                              item.id as RequesterRelation,
                            )
                          }
                          className={`h-10 text-xs font-semibold rounded-lg border transition-colors ${
                            relation ===
                            item.id
                              ? 'border-[#146B44] bg-[#E6F4ED] text-[#146B44]'
                              : 'border-[#8A949E] bg-white text-[#1F2430]'
                          }`}
                        >
                          {
                            item.label
                          }
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div className="p-3 bg-[#F7F8F9] rounded-xl border border-[#8A949E]/30 space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        ackChecked
                      }
                      onChange={(e) =>
                        setAckChecked(
                          e.target.checked,
                        )
                      }
                      className="mt-1 accent-[#146B44] w-4 h-4"
                    />

                    <span className="text-xs text-[#1F2430] leading-relaxed">
                      أقر بأن هذا الطلب لحالة علاجية حقيقية،
                      وأتحمل المسؤولية الكاملة عن دقة البيانات
                      المُدخلة.
                    </span>
                  </label>
                </div>

                <button
                  disabled={
                    !origin ||
                    !dest ||
                    !scheduledAt ||
                    !ackChecked ||
                    createTripLoading
                  }
                  onClick={() =>
                    void handleCreateTrip()
                  }
                  className="w-full h-[52px] bg-[#146B44] disabled:opacity-40 active:bg-[#0F5636] text-white font-semibold rounded-xl text-base transition-colors flex items-center justify-center gap-2"
                >
                  {createTripLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'إرسال الطلب'
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {showVolunteerView && (
          <>
            {raceConditionDetected && (
              <RaceConditionToast
                onClose={() =>
                  setRaceConditionDetected(
                    false,
                  )
                }
              />
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
                  <h3 className="text-xl font-bold text-[#1F2430]">
                    {
                      activeVolunteerTripData.requester_first_name
                    }
                  </h3>

                  <p className="text-xs text-[#6B7280]">
                    {activeVolunteerTripData.requester_relation ===
                      'patient' &&
                      'مريض'}

                    {activeVolunteerTripData.requester_relation ===
                      'guardian' &&
                      'ولي أمر'}

                    {activeVolunteerTripData.requester_relation ===
                      'companion' &&
                      'مرافق'}
                  </p>
                </div>

                <div className="p-3 bg-[#F7F8F9] rounded-xl text-xs space-y-2 text-right">
                  <div>
                    <strong>موعد المشوار:</strong>{' '}
                    {formatScheduledAt(
                      activeVolunteerTripData.scheduled_at,
                    )}
                  </div>

                  {activeVolunteerTripData.patient_age !==
                    undefined &&
                    activeVolunteerTripData.patient_age !==
                      null && (
                      <div>
                        <strong>عمر المريض:</strong>{' '}
                        {
                          activeVolunteerTripData.patient_age
                        } سنة
                      </div>
                    )}

                  {activeVolunteerTripData.patient_condition && (
                    <div>
                      <strong>الحالة:</strong>{' '}
                      {
                        activeVolunteerTripData.patient_condition
                      }
                    </div>
                  )}

                  <div>
                    <strong>نقطة الانطلاق:</strong>{' '}
                    {
                      activeVolunteerTripData.origin_address
                    }
                  </div>

                  <div>
                    <strong>الوجهة:</strong>{' '}
                    {
                      activeVolunteerTripData.destination_address
                    }
                  </div>

                  {formatDistance(
                    activeVolunteerTripData.distance_km,
                  ) && (
                    <div>
                      <strong>
                        المسافة من موقعك وقت القبول:
                      </strong>{' '}
                      {formatDistance(
                        activeVolunteerTripData.distance_km,
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  
                    href={`tel:${activeVolunteerTripData.requester_phone}`}
                    className="h-11 bg-[#146B44] text-white rounded-xl flex items-center justify-center gap-1 text-xs font-semibold active:bg-[#0F5636]"
                  >
                    <Phone className="w-4 h-4" />
                    اتصال
                  </a>

                  
                    href={`https://wa.me/${toWhatsAppNumber(
                      activeVolunteerTripData.requester_phone,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="h-11 bg-[#1E8E5A] text-white rounded-xl flex items-center justify-center gap-1 text-xs font-semibold active:bg-[#0F5636]"
                  >
                    <MessageSquare className="w-4 h-4" />
                    واتساب
                  </a>

                  
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
                  onClick={() =>
                    void handleCompleteTrip(
                      activeVolunteerTripData.trip_id,
                    )
                  }
                  className="w-full h-[52px] bg-[#146B44] text-white font-semibold rounded-xl text-base active:bg-[#0F5636] transition-colors"
                >
                  ✓ تم إيصاله بأمان
                </button>

                <button
                  onClick={() =>
                    setReportModalOpen(
                      true,
                    )
                  }
                  className="text-xs text-[#6B7280] hover:text-[#B53A3A] flex items-center justify-center gap-1 mx-auto"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  إبلاغ عن مشكلة
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-white p-4 rounded-2xl border border-[#8A949E]/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-[#1F2430]">
                        الطلبات المتاحة قربك
                      </h2>

                      <p className="text-[11px] text-[#6B7280] mt-1">
                        تظهر فقط الطلبات الموجودة ضمن 20 كم من موقعك.
                      </p>
                    </div>

                    <LocateFixed className="w-5 h-5 text-[#146B44]" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {volunteerLocation ? (
                      <div className="flex items-center justify-between bg-[#E6F4ED] rounded-xl px-3 py-2">
                      <span className="text-[11px] text-[#146B44] font-semibold">
                        تم تحديد موقعك
                      </span>

                      <button
                        onClick={
                          requestVolunteerLocation
                        }
                        disabled={
                          locationLoading
                        }
                        className="text-[11px] text-[#146B44] font-semibold flex items-center gap-1"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            locationLoading
                              ? 'animate-spin'
                              : ''
                          }`}
                        />

                        تحديث
                      </button>
                    </div>
                    ) : (
                      <button
                        onClick={
                          requestVolunteerLocation
                        }
                        disabled={
                          locationLoading
                        }
                        className="w-full h-11 bg-[#146B44] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
                      >
                        {locationLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <LocateFixed className="w-4 h-4" />
                        )}

                        تحديد موقعي وعرض الطلبات القريبة
                      </button>
                    )}
                  </div>

                  {locationError && (
                    <div className="p-3 bg-[#FCEAEA] text-[#B53A3A] text-xs rounded-xl flex gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />

                      <span>
                        {locationError}
                      </span>
                    </div>
                  )}

                  {pushError && (
                    <div className="p-3 bg-[#FCEAEA] text-[#B53A3A] text-xs rounded-xl flex gap-2">
                      <Bell className="w-4 h-4 shrink-0" />
                      <span>{pushError}</span>
                    </div>
                  )}

                  {errorMessage && (
                    <div className="p-3 bg-[#FCEAEA] text-[#B53A3A] text-xs rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />

                      <span>
                        {errorMessage}
                      </span>
                    </div>
                  )}
                </div>

                <h2 className="text-base font-bold text-[#1F2430] flex items-center justify-between">
                  <span>
                    الطلبات المتاحة
                  </span>

                  <span className="text-xs font-normal text-[#6B7280]">
                    ({pendingTrips.length})
                  </span>
                </h2>

                {loadingNearbyTrips ? (
                  <div className="bg-white p-8 rounded-2xl border border-[#8A949E]/20 text-center">
                    <Loader2 className="w-8 h-8 text-[#146B44] mx-auto animate-spin" />

                    <p className="text-xs text-[#6B7280] mt-3">
                      بنبحث عن الطلبات القريبة...
                    </p>
                  </div>
                ) : !volunteerLocation ? (
                  <div className="bg-white p-8 rounded-2xl border border-[#8A949E]/20 text-center space-y-2">
                    <LocateFixed className="w-8 h-8 text-[#8A949E] mx-auto" />

                    <p className="text-sm font-semibold text-[#1F2430]">
                      حدد موقعك أولًا
                    </p>

                    <p className="text-xs text-[#6B7280]">
                      لن يتم عرض الطلبات إلا بعد تحديد موقعك.
                    </p>
                  </div>
                ) : pendingTrips.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-[#8A949E]/20 text-center space-y-2">
                    <Clock className="w-8 h-8 text-[#8A949E] mx-auto" />

                    <p className="text-sm font-semibold text-[#1F2430]">
                      مفيش طلبات قريبة منك دلوقتي
                    </p>

                    <p className="text-xs text-[#6B7280]">
                      هنظهر لك الطلبات الجديدة الموجودة ضمن 20 كم.
                    </p>
                  </div>
                ) : (
                  pendingTrips.map(
                    (trip) => (
                      <div
                        key={
                          trip.id
                        }
                        onClick={() =>
                          setSelectedTripDetails(
                            trip,
                          )
                        }
                        className="bg-white p-4 rounded-2xl border border-[#8A949E]/20 shadow-sm cursor-pointer hover:border-[#146B44] transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs text-[#6B7280]">
                          <span className="bg-[#FBEFDC] text-[#8F5A0A] px-2 py-0.5 rounded-md font-medium">
                            {trip.requester_relation ===
                              'patient' &&
                              'مريض'}

                            {trip.requester_relation ===
                              'guardian' &&
                              'ولي أمر'}

                            {trip.requester_relation ===
                              'companion' &&
                              'مرافق'}
                          </span>

                          <span>
                            {formatScheduledAt(
                              trip.scheduled_at,
                            )}
                          </span>
                        </div>

                        <div className="text-sm font-bold text-[#1F2430] flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#146B44] shrink-0" />

                          <span>
                            {
                              trip.origin_area_label
                            }
                          </span>

                          <span className="text-[#6B7280]">
                            ⟶
                          </span>

                          <span>
                            {
                              trip.destination_area_label
                            }
                          </span>
                        </div>

                        {formatDistance(
                          trip.distance_km,
                        ) && (
                          <div className="text-xs text-[#146B44] font-semibold flex items-center gap-1">
                            <LocateFixed className="w-3.5 h-3.5" />

                            {formatDistance(
                              trip.distance_km,
                            )}{' '}
                            منك
                          </div>
                        )}
                      </div>
                    ),
                  )
                )}
              </div>
            )}

            {selectedTripDetails && (
              <div
                className="fixed inset-0 z-50 bg-black/40 flex flex-col justify-end p-0"
                role="dialog"
                aria-modal="true"
              >
                <div className="bg-white rounded-t-3xl p-6 space-y-4 max-w-md mx-auto w-full">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-[#1F2430]">
                      تفاصيل المشوار
                    </h3>

                    <button
                      onClick={() =>
                        setSelectedTripDetails(
                          null,
                        )
                      }
                      className="text-[#6B7280]"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-2 text-sm text-[#1F2430]">
                    <div>
                      <strong>من:</strong>{' '}
                      {
                        selectedTripDetails.origin_area_label
                      }{' '}
                      (منطقة تقريبية)
                    </div>

                    <div>
                      <strong>إلى:</strong>{' '}
                      {
                        selectedTripDetails.destination_area_label
                      }
                    </div>

                    <div>
                      <strong>الموعد:</strong>{' '}
                      {formatScheduledAt(
                        selectedTripDetails.scheduled_at,
                      )}
                    </div>

                    {formatDistance(
                      selectedTripDetails.distance_km,
                    ) && (
                      <div>
                        <strong>المسافة:</strong>{' '}
                        {formatDistance(
                          selectedTripDetails.distance_km,
                        )}{' '}
                        منك
                      </div>
                    )}

                    {selectedTripDetails.patient_age !==
                      undefined &&
                      selectedTripDetails.patient_age !==
                        null && (
                        <div>
                          <strong>عمر المريض:</strong>{' '}
                          {
                            selectedTripDetails.patient_age
                          } سنة
                        </div>
                      )}

                    {selectedTripDetails.patient_condition && (
                      <div>
                        <strong>الحالة:</strong>{' '}
                        {
                          selectedTripDetails.patient_condition
                        }
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-[#E6F4ED] rounded-xl text-xs text-[#146B44] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />

                    <span>
                      العنوان ورقم التواصل والبيانات التفصيلية
                      ستظهر بعد قبول الطلب فقط.
                    </span>
                  </div>

                  {!volunteerLocation && (
                    <button
                      onClick={
                        requestVolunteerLocation
                      }
                      className="w-full h-[48px] border border-[#146B44] text-[#146B44] font-semibold rounded-xl text-sm"
                    >
                      تحديد موقعي أولاً
                    </button>
                  )}

                  <button
                    disabled={
                      acceptingTripId ===
                        selectedTripDetails.id ||
                      !volunteerLocation
                    }
                    onClick={() =>
                      void handleAcceptTrip(
                        selectedTripDetails.id,
                      )
                    }
                    className="w-full h-[52px] bg-[#146B44] disabled:opacity-40 active:bg-[#0F5636] text-white font-semibold rounded-xl text-base transition-colors flex items-center justify-center gap-2"
                  >
                    {acceptingTripId ===
                    selectedTripDetails.id ? (
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
          tripId={
            activeVolunteerTripData?.trip_id ||
            activeRequesterTrip?.id
          }
          isOpen={
            reportModalOpen
          }
          onClose={() =>
            setReportModalOpen(
              false,
            )
          }
          onSuccess={() =>
            setReportSuccess(
              true,
            )
          }
        />

        {showSettings && (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex flex-col justify-end p-0"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white rounded-t-3xl p-6 space-y-4 max-w-md mx-auto w-full max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-[#1F2430]">الإعدادات</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-[#6B7280]"
                  aria-label="إغلاق"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {settingsError && (
                <div className="p-3 bg-[#FCEAEA] text-[#B53A3A] text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{settingsError}</span>
                </div>
              )}

              {settingsSuccess && (
                <div className="p-3 bg-[#E6F4ED] text-[#146B44] text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>تم حفظ بياناتك بنجاح.</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-[#1F2430] mb-1">
                  الاسم الأول
                </label>
                <input
                  type="text"
                  value={settingsFirstName}
                  onChange={(e) => setSettingsFirstName(e.target.value)}
                  className="w-full h-[48px] px-4 bg-white border border-[#8A949E] rounded-xl text-base text-[#1F2430] focus:border-[#2F6FED] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1F2430] mb-1">
                  رقم الجوال
                </label>
                <input
                  type="tel"
                  value={settingsPhone}
                  onChange={(e) => setSettingsPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full h-[48px] px-4 bg-white border border-[#8A949E] rounded-xl text-base text-[#1F2430] focus:border-[#2F6FED] focus:outline-none"
                />
              </div>

              {profile?.role === 'requester' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-[#1F2430] mb-1">
                      عمر المريض
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={settingsPatientAge}
                      onChange={(e) => setSettingsPatientAge(e.target.value)}
                      className="w-full h-[48px] px-4 bg-white border border-[#8A949E] rounded-xl text-base text-[#1F2430] focus:border-[#2F6FED] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#1F2430] mb-1">
                      وصف مختصر للحالة الصحية
                    </label>
                    <textarea
                      maxLength={500}
                      rows={3}
                      value={settingsPatientCondition}
                      onChange={(e) => setSettingsPatientCondition(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-[#8A949E] rounded-xl text-sm text-[#1F2430] focus:border-[#2F6FED] focus:outline-none resize-none"
                    />
                  </div>
                </>
              )}

              <div className="pt-2 border-t border-[#8A949E]/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[#1F2430]">الإشعارات</span>
                  <span className="text-[11px] text-[#6B7280]">
                    {pushEnabled ? 'مفعّلة على هذا الجهاز' : 'غير مفعّلة'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void handleEnablePushNotifications()}
                  disabled={pushLoading || pushEnabled}
                  className={`w-full h-11 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-colors ${
                    pushEnabled
                      ? 'bg-[#E6F4ED] border-[#146B44]/20 text-[#146B44]'
                      : 'bg-white border-[#146B44] text-[#146B44] hover:bg-[#F7F8F9]'
                  }`}
                >
                  {pushLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : pushEnabled ? (
                    <BellRing className="w-4 h-4" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                  {pushEnabled ? 'الإشعارات مفعّلة' : 'تفعيل الإشعارات'}
                </button>

                {pushError && (
                  <p className="text-xs text-[#B53A3A] mt-2">{pushError}</p>
                )}
              </div>

              <button
                onClick={() => void handleSaveSettings()}
                disabled={settingsSaving}
                className="w-full h-[52px] bg-[#146B44] disabled:opacity-40 active:bg-[#0F5636] text-white font-semibold rounded-xl text-base transition-colors flex items-center justify-center gap-2"
              >
                {settingsSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'حفظ التعديلات'
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
