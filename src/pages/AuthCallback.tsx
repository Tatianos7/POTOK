import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { getPostLoginRoute } from '../services/pinLockService';

const CALLBACK_TIMEOUT_MS = 15000;

const AuthCallback = () => {
  const navigate = useNavigate();
  const [isTimedOut, setIsTimedOut] = useState(false);
  const isFinishedRef = useRef(false);

  useEffect(() => {
    if (!supabase) {
      setIsTimedOut(true);
      return;
    }
    const client = supabase;

    const finishWithSessionCheck = async () => {
      const { data } = await client.auth.getSession();
      if (data.session && !isFinishedRef.current) {
        isFinishedRef.current = true;
        navigate(getPostLoginRoute(), { replace: true });
      }
    };

    void finishWithSessionCheck();

    const timeoutId = window.setTimeout(() => {
      if (isFinishedRef.current) return;
      setIsTimedOut(true);
    }, CALLBACK_TIMEOUT_MS);

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      if (!session || isFinishedRef.current) return;
      isFinishedRef.current = true;
      window.clearTimeout(timeoutId);
      navigate(getPostLoginRoute(), { replace: true });
    });

    return () => {
      window.clearTimeout(timeoutId);
      subscription.subscription.unsubscribe();
    };
  }, [navigate]);

  if (isTimedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="w-full max-w-md rounded-xl border border-gray-200 p-6 text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-3">Не удалось завершить вход</h1>
          <p className="text-gray-600 mb-5">Проверьте интернет и попробуйте войти снова.</p>
          <button
            type="button"
            onClick={() => navigate('/auth', { replace: true })}
            className="w-full bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
          >
            Вернуться ко входу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="text-center">
        <div className="h-10 w-10 mx-auto mb-4 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        <p className="text-gray-700">Завершаем вход…</p>
      </div>
    </div>
  );
};

export default AuthCallback;
