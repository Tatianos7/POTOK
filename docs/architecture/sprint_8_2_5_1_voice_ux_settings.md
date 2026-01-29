# Sprint 8.2.5.1 — Voice UX, Settings & Trust Integration

## Цель
Сделать голосовой слой продуктово зрелым: управляемым пользователем, безопасным и объяснимым.

## Profile → Voice Settings
Раздел профиля включает:
- Переключатель «Голосовой коуч»
- Режимы:
  - Выключен
  - Только при риске
  - По запросу
  - Всегда (Premium)
- Выбор голоса (заготовка):
  - Спокойный
  - Поддерживающий
  - Мотивирующий
- Интенсивность:
  - Мягко
  - Нейтрально
  - Ведуще

## DTO
```ts
interface CoachVoiceSettings {
  enabled: boolean;
  mode: 'off' | 'risk_only' | 'on_request' | 'always';
  style: 'calm' | 'supportive' | 'motivational';
  intensity: 'soft' | 'neutral' | 'leading';
}
```

## Storage
- `localStorage` (быстрый старт)
- `user_profiles.voice_settings` (jsonb)

## Runtime Policy
Добавляется `VoiceInterventionPolicy`:
- `daily_voice_limit`
- `silence_after_ignore`
- `emotional_overload_guard`

Правила:
- Respect silent mode и cooldown.
- `risk_only`: голос только при safety/fatigue/relapse.
- `on_request`: голос только при явном запросе.
- `always`: доступно в Premium.

## Premium Gating
- **Free:** 1 демо‑реплика в неделю, только `risk_only`.
- **Premium:** полноценный голос, диалоги, эмоциональная модуляция, история.

## Explainability
Для каждого voice‑ответа:
- Почему голос, а не текст
- Почему такой тон
- Какие сигналы вызвали

UI:
«Почему коуч сейчас говорит?» → `ExplainabilityDrawer`.

## Trust Integration
Голос не усиливает давление, а поддерживает устойчивость:
- нет стыда и обвинений
- кризисный тон только при риске

## E2E 311–320
См. `docs/architecture/e2e_matrix_v2.md`.

## Definition of Done
- Настройки голоса в Profile.
- Политика вмешательств в рантайме.
- Premium‑гейтинг учтён.
- Объяснимость голосовых триггеров.
