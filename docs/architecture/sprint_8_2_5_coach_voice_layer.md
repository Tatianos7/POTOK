# Sprint 8.2.5 — Coach Voice Layer

## Цель
Подготовить архитектуру голосового коуча без подключения внешних API: UX‑сценарии, контракты рантайма, safety и premium‑гейтинг.

## Voice UX сценарии
- Утренний голосовой нудж
- Поддержка при пропуске
- Объяснение плана голосом
- Эмоциональное восстановление

## Слои
- **TTS (Text → Speech):** преобразование `CoachResponse` в голос.
- **STT (Speech → Text):** распознавание пользовательского запроса.
- **Emotion → Prosody:** тон, темп, паузы, мягкие акценты.

## Safety
- Анти‑давление, анти‑вина.
- Crisis‑тон при distress/medical_risk.
- Медицинские дисклеймеры в голосе при риске.

## Premium‑гейтинг
- **Free:** нет голоса или 1 демо‑реплика.
- **Premium:** полноценный голосовой коуч.

## Runtime контракты (без API)
```ts
interface CoachVoiceService {
  speak(response: CoachResponse): Promise<VoiceUtterance>;
  listen(): Promise<UserSpeechIntent>;
  stop(): void;
  setVoiceStyle(style: Calm | Motivational | Neutral | Recovery);
}

type VoiceEmotionTone = 'calm' | 'motivational' | 'neutral' | 'recovery' | 'safety';
type VoiceSafetyMode = 'normal' | 'caution' | 'crisis';

interface VoiceState {
  enabled: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  tone: VoiceEmotionTone;
  safetyMode: VoiceSafetyMode;
}
```

## UI‑заготовки
- `CoachVoiceButton` (🎧 / 🎙)
- `CoachSpeakingIndicator`
- `CoachListeningOverlay`

Встраивание:
- Today
- CoachDialogThread
- CoachMessageCard

## E2E 306–310
См. `docs/architecture/e2e_matrix_v2.md`.

## Definition of Done
- Архитектура описана.
- Контракты объявлены.
- UI‑заготовки созданы.
- Гейтинг и safety‑тон описаны.
