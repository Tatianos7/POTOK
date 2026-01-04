import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { testSupabaseConnection } from './lib/supabaseClient'
import { foodService } from './services/foodService'

// Проверяем подключение к Supabase при старте приложения
testSupabaseConnection().catch((err) => {
  console.error('[main] Failed to test Supabase connection:', err);
});


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
