import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { testSupabaseConnection } from './lib/supabaseClient'
import { initializeExerciseData } from './utils/initializeExerciseData'

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
