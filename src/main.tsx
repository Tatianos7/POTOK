import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { testSupabaseConnection } from './lib/supabaseClient'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { resolveGithubPagesFallbackRoute } from './utils/githubPagesRouteRestore'

// Restore original SPA route after GitHub Pages 404 fallback redirect.
(() => {
  const nextUrl = resolveGithubPagesFallbackRoute(window.location.search, import.meta.env.BASE_URL);
  if (!nextUrl) return;
  window.history.replaceState(null, '', nextUrl);
})();

// Проверяем подключение к Supabase при старте приложения
testSupabaseConnection().catch((err) => {
  console.error('[main] Failed to test Supabase connection:', err);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
