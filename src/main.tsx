import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { testSupabaseConnection } from './lib/supabaseClient'
import { initializeExerciseData } from './utils/initializeExerciseData'

// Restore original SPA route after GitHub Pages 404 fallback redirect.
(() => {
  const searchParams = new URLSearchParams(window.location.search);
  const encodedPath = searchParams.get('p');
  if (!encodedPath) return;
  const decoded = decodeURIComponent(encodedPath);
  const normalizedPath = decoded.startsWith('/') ? decoded : `/${decoded}`;
  const nextUrl = `${import.meta.env.BASE_URL.replace(/\/$/, '')}${normalizedPath}`;
  window.history.replaceState(null, '', nextUrl);
})();

// Проверяем подключение к Supabase при старте приложения
testSupabaseConnection().catch((err) => {
  console.error('[main] Failed to test Supabase connection:', err);
});

// Автоматически инициализируем данные упражнений при первом запуске
initializeExerciseData().catch((err) => {
  console.error('[main] Failed to initialize exercise data:', err);
});


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
