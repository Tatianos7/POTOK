import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import OtpCodeInput from '../components/OtpCodeInput';
import { getPostLoginRoute } from '../services/pinLockService';

type AuthTab = 'email' | 'phone';
const OTP_DEFAULT_COOLDOWN_SEC = 60;
const OTP_RATE_LIMIT_COOLDOWN_SEC = 90;
const OTP_COOLDOWN_UNTIL_KEY = 'otp_cooldown_until_v1';

const formatCooldown = (seconds: number): string => {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const isRateLimitError = (error: { status?: number; code?: string; message?: string }): boolean => {
  const message = (error.message || '').toLowerCase();
  return (
    error.status === 429 ||
    error.code === '429' ||
    message.includes('too many') ||
    message.includes('rate limit')
  );
};

const mapOtpError = (message: string): string => {
  const value = message.toLowerCase();
  if (
    value.includes('sms') ||
    value.includes('phone provider') ||
    value.includes('twilio') ||
    value.includes('messagebird') ||
    value.includes('vonage') ||
    value.includes('otp disabled')
  ) {
    return 'SMS временно недоступны.';
  }
  if (value.includes('expired')) return 'Код просрочен. Запросите новый код.';
  if (value.includes('invalid')) return 'Неверный код. Проверьте и попробуйте снова.';
  if (value.includes('too many') || value.includes('rate limit') || value.includes('over_')) {
    return 'Слишком много попыток. Подождите немного и повторите.';
  }
  return 'Не удалось выполнить вход. Попробуйте ещё раз.';
};

const isSessionExpiredError = (error: { name?: string; message?: string } | null | undefined): boolean => {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return (
    error.name === 'AuthSessionMissingError' ||
    message.includes('authsessionmissingerror') ||
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found') ||
    message.includes('session expired')
  );
};

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { setThemeExplicit } = useTheme();
  const [tab, setTab] = useState<AuthTab>('email');

  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailStatus, setEmailStatus] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailIsSending, setEmailIsSending] = useState(false);
  const [emailIsVerifying, setEmailIsVerifying] = useState(false);
  const [emailIsCodeStep, setEmailIsCodeStep] = useState(false);
  const [emailResendIn, setEmailResendIn] = useState(0);

  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneStatus, setPhoneStatus] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phoneIsSending, setPhoneIsSending] = useState(false);
  const [phoneIsVerifying, setPhoneIsVerifying] = useState(false);
  const [phoneIsCodeStep, setPhoneIsCodeStep] = useState(false);
  const [phoneResendIn, setPhoneResendIn] = useState(0);
  const [oauthError, setOauthError] = useState('');
  const [sessionNotice, setSessionNotice] = useState('');
  const emailSendRequestIdRef = useRef(0);
  const emailVerifyRequestIdRef = useRef(0);
  const phoneSendRequestIdRef = useRef(0);
  const phoneVerifyRequestIdRef = useRef(0);

  const persistCooldownUntil = (seconds: number) => {
    const untilTs = Date.now() + seconds * 1000;
    sessionStorage.setItem(OTP_COOLDOWN_UNTIL_KEY, String(untilTs));
  };

  useEffect(() => {
    setThemeExplicit('light');
  }, [setThemeExplicit]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(getPostLoginRoute(), { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const rawUntil = sessionStorage.getItem(OTP_COOLDOWN_UNTIL_KEY);
    if (!rawUntil) return;
    const untilTs = Number(rawUntil);
    if (!Number.isFinite(untilTs)) {
      sessionStorage.removeItem(OTP_COOLDOWN_UNTIL_KEY);
      return;
    }
    const remainingSec = Math.ceil((untilTs - Date.now()) / 1000);
    if (remainingSec > 0) {
      setEmailResendIn(remainingSec);
      setPhoneResendIn(remainingSec);
    } else {
      sessionStorage.removeItem(OTP_COOLDOWN_UNTIL_KEY);
    }
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const reason = query.get('reason');
    if (reason === 'session-expired') {
      setSessionNotice('Сессия истекла. Войдите снова.');
    } else {
      setSessionNotice('');
    }
  }, [location.search]);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const isEmailValid = normalizedEmail.includes('@');
  const isEmailCodeValid = emailCode.length >= 1;

  const normalizedPhone = useMemo(() => phone.trim().replace(/\s+/g, ''), [phone]);
  const isPhoneValid = /^\+\d+$/.test(normalizedPhone);
  const isPhoneCodeValid = phoneCode.length >= 1;

  useEffect(() => {
    if (emailResendIn <= 0) return;
    const timer = window.setInterval(() => {
      setEmailResendIn((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [emailResendIn]);

  useEffect(() => {
    if (phoneResendIn <= 0) return;
    const timer = window.setInterval(() => {
      setPhoneResendIn((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phoneResendIn]);

  useEffect(() => {
    if (emailResendIn <= 0 && phoneResendIn <= 0) {
      sessionStorage.removeItem(OTP_COOLDOWN_UNTIL_KEY);
    }
  }, [emailResendIn, phoneResendIn]);

  const handleSendEmailCode = async () => {
    setEmailError('');
    setEmailStatus('');
    if (!isEmailValid) {
      setEmailError('Введите корректный email.');
      return;
    }
    if (!supabase) {
      setEmailError('Сервис авторизации временно недоступен.');
      return;
    }
    if (emailResendIn > 0) {
      setEmailStatus(`Повторить через ${formatCooldown(emailResendIn)}`);
      return;
    }
    const requestId = ++emailSendRequestIdRef.current;
    setEmailIsSending(true);
    try {
      const { error: signError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: true },
      });
      if (requestId !== emailSendRequestIdRef.current) return;
      if (signError) {
        if (isRateLimitError(signError)) {
          setEmailError('Слишком много попыток. Подождите немного.');
          setEmailResendIn(OTP_RATE_LIMIT_COOLDOWN_SEC);
          setPhoneResendIn(OTP_RATE_LIMIT_COOLDOWN_SEC);
          persistCooldownUntil(OTP_RATE_LIMIT_COOLDOWN_SEC);
          return;
        }
        setEmailError(mapOtpError(signError.message || ''));
        return;
      }
      setEmailIsCodeStep(true);
      setEmailStatus('Код отправлен на email.');
      setEmailResendIn(OTP_DEFAULT_COOLDOWN_SEC);
      setPhoneResendIn(OTP_DEFAULT_COOLDOWN_SEC);
      persistCooldownUntil(OTP_DEFAULT_COOLDOWN_SEC);
    } catch {
      if (requestId !== emailSendRequestIdRef.current) return;
      setEmailError('Не удалось отправить код. Проверьте соединение и попробуйте снова.');
    } finally {
      if (requestId === emailSendRequestIdRef.current) {
        setEmailIsSending(false);
      }
    }
  };

  const handleVerifyEmailCode = async () => {
    if (emailIsVerifying) return;
    setEmailError('');
    setEmailStatus('');
    if (!isEmailValid) {
      setEmailError('Введите корректный email.');
      return;
    }
    if (!isEmailCodeValid) {
      setEmailError('Введите код из письма.');
      return;
    }
    if (!supabase) {
      setEmailError('Сервис авторизации временно недоступен.');
      return;
    }
    const requestId = ++emailVerifyRequestIdRef.current;
    setEmailIsVerifying(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: emailCode,
        type: 'email',
      });
      if (requestId !== emailVerifyRequestIdRef.current) return;
      if (verifyError) {
        if (isSessionExpiredError(verifyError)) {
          await supabase.auth.signOut();
          navigate('/auth?reason=session-expired', { replace: true });
          return;
        }
        setEmailError(mapOtpError(verifyError.message || ''));
        return;
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (requestId !== emailVerifyRequestIdRef.current) return;
      if (sessionError || !sessionData?.session) {
        if (isSessionExpiredError(sessionError)) {
          await supabase.auth.signOut();
          navigate('/auth?reason=session-expired', { replace: true });
          return;
        }
        setEmailError('Не удалось завершить вход. Повторите попытку.');
        return;
      }
      navigate(getPostLoginRoute(), { replace: true });
    } catch {
      if (requestId !== emailVerifyRequestIdRef.current) return;
      setEmailError('Не удалось выполнить вход. Попробуйте снова.');
    } finally {
      if (requestId === emailVerifyRequestIdRef.current) {
        setEmailIsVerifying(false);
      }
    }
  };

  const handleSendPhoneCode = async () => {
    setPhoneError('');
    setPhoneStatus('');
    if (!isPhoneValid) {
      setPhoneError('Введите телефон в формате +79991234567.');
      return;
    }
    if (!supabase) {
      setPhoneError('Сервис авторизации временно недоступен.');
      return;
    }
    if (phoneResendIn > 0) {
      setPhoneStatus(`Повторить через ${formatCooldown(phoneResendIn)}`);
      return;
    }
    const requestId = ++phoneSendRequestIdRef.current;
    setPhoneIsSending(true);
    try {
      const { error: signError } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
        options: { shouldCreateUser: true },
      });
      if (requestId !== phoneSendRequestIdRef.current) return;
      if (signError) {
        if (isRateLimitError(signError)) {
          setPhoneError('Слишком много попыток. Подождите немного.');
          setPhoneResendIn(OTP_RATE_LIMIT_COOLDOWN_SEC);
          setEmailResendIn(OTP_RATE_LIMIT_COOLDOWN_SEC);
          persistCooldownUntil(OTP_RATE_LIMIT_COOLDOWN_SEC);
          return;
        }
        setPhoneError(mapOtpError(signError.message || ''));
        return;
      }
      setPhoneIsCodeStep(true);
      setPhoneStatus('Код отправлен по SMS.');
      setPhoneResendIn(OTP_DEFAULT_COOLDOWN_SEC);
      setEmailResendIn(OTP_DEFAULT_COOLDOWN_SEC);
      persistCooldownUntil(OTP_DEFAULT_COOLDOWN_SEC);
    } catch {
      if (requestId !== phoneSendRequestIdRef.current) return;
      setPhoneError('SMS временно недоступны.');
    } finally {
      if (requestId === phoneSendRequestIdRef.current) {
        setPhoneIsSending(false);
      }
    }
  };

  const handleVerifyPhoneCode = async () => {
    if (phoneIsVerifying) return;
    setPhoneError('');
    setPhoneStatus('');
    if (!isPhoneValid) {
      setPhoneError('Введите телефон в формате +79991234567.');
      return;
    }
    if (!isPhoneCodeValid) {
      setPhoneError('Введите код из SMS.');
      return;
    }
    if (!supabase) {
      setPhoneError('Сервис авторизации временно недоступен.');
      return;
    }
    const requestId = ++phoneVerifyRequestIdRef.current;
    setPhoneIsVerifying(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: phoneCode,
        type: 'sms',
      });
      if (requestId !== phoneVerifyRequestIdRef.current) return;
      if (verifyError) {
        if (isSessionExpiredError(verifyError)) {
          await supabase.auth.signOut();
          navigate('/auth?reason=session-expired', { replace: true });
          return;
        }
        setPhoneError(mapOtpError(verifyError.message || ''));
        return;
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (requestId !== phoneVerifyRequestIdRef.current) return;
      if (sessionError || !sessionData?.session) {
        if (isSessionExpiredError(sessionError)) {
          await supabase.auth.signOut();
          navigate('/auth?reason=session-expired', { replace: true });
          return;
        }
        setPhoneError('Не удалось завершить вход. Повторите попытку.');
        return;
      }
      navigate(getPostLoginRoute(), { replace: true });
    } catch {
      if (requestId !== phoneVerifyRequestIdRef.current) return;
      setPhoneError('SMS временно недоступны.');
    } finally {
      if (requestId === phoneVerifyRequestIdRef.current) {
        setPhoneIsVerifying(false);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setOauthError('');
    if (!supabase) {
      setOauthError('Сервис авторизации временно недоступен.');
      return;
    }

    const baseUrl = import.meta.env.BASE_URL || '/';
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const redirectTo = new URL(`${normalizedBase}auth/callback`, window.location.origin).toString();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });

    if (error) {
      setOauthError('Не удалось начать вход через Google. Попробуйте снова.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white w-full min-w-[320px]">
      <div className="container-responsive w-full flex justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">ПОТОК</h1>
            <p className="text-gray-600">Вход в аккаунт</p>
          </div>

          <div className="bg-white rounded-xl p-6 space-y-4">
            {sessionNotice && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
                {sessionNotice}
              </div>
            )}

            <div className="grid grid-cols-2 rounded-lg border border-gray-200 p-1">
              <button
                type="button"
                onClick={() => setTab('email')}
                className={`rounded-md py-2 text-sm font-medium transition-colors ${
                  tab === 'email' ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => setTab('phone')}
                className={`rounded-md py-2 text-sm font-medium transition-colors ${
                  tab === 'phone' ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Телефон
              </button>
            </div>

            {tab === 'phone' ? (
              <>
                {phoneError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {phoneError}
                  </div>
                )}
                {phoneStatus && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                    {phoneStatus}
                  </div>
                )}

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Телефон
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-field"
                    placeholder="+79991234567"
                  />
                </div>

                {phoneIsCodeStep && (
                  <OtpCodeInput
                    id="otpCodePhone"
                    value={phoneCode}
                    onChange={(value) => {
                      setPhoneCode(value);
                      if (phoneError) setPhoneError('');
                    }}
                    disabled={phoneIsVerifying}
                    label="Код из SMS"
                    placeholder="Введите код"
                    minLength={1}
                    maxLength={12}
                  />
                )}

                {!phoneIsCodeStep ? (
                  <button
                    type="button"
                    onClick={handleSendPhoneCode}
                    disabled={phoneIsSending || phoneResendIn > 0}
                    className="w-full min-[768px]:button-limited bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 active:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {phoneIsSending ? 'Отправка...' : phoneResendIn > 0 ? `Повтор через ${formatCooldown(phoneResendIn)}` : 'Получить код'}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleVerifyPhoneCode}
                      disabled={phoneIsVerifying || !isPhoneCodeValid}
                      className="w-full min-[768px]:button-limited bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 active:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {phoneIsVerifying ? 'Вход...' : 'Войти'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSendPhoneCode}
                      disabled={phoneResendIn > 0 || phoneIsSending}
                      className="w-full border border-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {phoneResendIn > 0 ? `Получить код повторно через ${formatCooldown(phoneResendIn)}` : 'Получить код повторно'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {emailError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {emailError}
                  </div>
                )}
                {emailStatus && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                    {emailStatus}
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="you@example.com"
                  />
                </div>

                {emailIsCodeStep && (
                  <OtpCodeInput
                    id="otpCodeEmail"
                    value={emailCode}
                    onChange={(value) => {
                      setEmailCode(value);
                      if (emailError) setEmailError('');
                    }}
                    disabled={emailIsVerifying}
                    label="Код из письма"
                    placeholder="Введите код"
                    minLength={1}
                    maxLength={12}
                  />
                )}

                {!emailIsCodeStep ? (
                  <button
                    type="button"
                    onClick={handleSendEmailCode}
                    disabled={emailIsSending || emailResendIn > 0}
                    className="w-full min-[768px]:button-limited bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 active:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {emailIsSending ? 'Отправка...' : emailResendIn > 0 ? `Повтор через ${formatCooldown(emailResendIn)}` : 'Получить код'}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleVerifyEmailCode}
                      disabled={emailIsVerifying || !isEmailCodeValid}
                      className="w-full min-[768px]:button-limited bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 active:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {emailIsVerifying ? 'Вход...' : 'Войти'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSendEmailCode}
                      disabled={emailResendIn > 0 || emailIsSending}
                      className="w-full border border-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {emailResendIn > 0 ? `Получить код повторно через ${formatCooldown(emailResendIn)}` : 'Получить код повторно'}
                    </button>
                  </div>
                )}
              </>
            )}

            <div className="pt-2">
              {oauthError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-3">
                  {oauthError}
                </div>
              )}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full border border-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Войти через Google
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
