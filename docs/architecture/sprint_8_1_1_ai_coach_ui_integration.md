# Sprint 8.1.1 — AI Coach Runtime Integration

## Event Flow (что вызывает коуча)
- Открытие экранов Today / My Program / Progress / Habits / Paywall.
- Завершение ключевого действия (день закрыт, привычка выполнена, адаптация создана).
- Сигналы риска (боль, усталость, стресс, регресс).
- Запрос пользователя: “почему”, “что дальше”, “мне тяжело”.

## State Sync (что он читает/пишет)
**Читает**
- Goal + Program state (план, статус, адаптации).
- Progress snapshot + trends.
- Habits state (streak, slip, recovery).
- Today state (сессия, guard, readiness).
- Trust score + confidence.

**Пишет**
- Coaching events (лог коуча, категория, тон, результат).
- Explainability references (decision_ref, confidence).
- Optional: flags для UI (recovery_mode, safe_mode, support_needed).

## Emotional Routing (Care / Power / Recovery / Challenge)
- **Care**: низкая энергия, тревога, первые дни, низкий trust.
- **Power**: стабильный прогресс, высокая энергия, устойчивость.
- **Recovery**: боль, выгорание, регресс, долгий перерыв.
- **Challenge**: plateau, запрос усиления, достижение цели.

## Safety Gates
- Медицинские guard‑флаги блокируют директивные советы.
- Психологические риски переводят в поддержку и ресурсы.
- Низкий trust → минимум давления и короткие форматы.
- Без согласия — никакой чувствительной памяти.

## Explainability Surface
- Карточка “Почему этот совет?” с источниками и confidence.
- Drawer для глубокой причины и альтернатив.
- История изменений (почему сегодня иначе, чем раньше).

## Premium Gating Logic
- Free: короткий коуч‑комментарий и базовое объяснение.
- Pro: полная explainability, альтернативы и контекст.
- Paywall без давления: “поддержка и глубина доступны при желании”.

## UI-компоненты для живого коуча
- **Карточки**: Today, Progress, Habits (in‑line поддержка).
- **Баннеры**: TrustBanner / SafetyBanner при рисках.
- **Диалоги**: короткий диалог при кризисе или возврате.
- **Drawer**: ExplainabilityDrawer для “почему”.
