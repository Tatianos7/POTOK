# Sprint 8.1.5 — Coach Relationship Runtime

Цель: описать исполняемую модель отношений и доверия между пользователем и
AI‑коучем, чтобы глубина поддержки росла без давления.

## Runtime State Model
- trust_level
- emotional_state
- resilience
- autonomy
- safety_mode
- confidence_decay / confidence_growth

## Relationship State Machine
1. **onboarding**
   - базовая поддержка, короткие подсказки, минимальная память
2. **trust building**
   - растет глубина, объяснения, первые микро‑планы
3. **stable partnership**
   - стабильный тон, персональные паттерны и долгосрочные цели
4. **relapse & recovery**
   - снижение давления, восстановление ритма, мягкий возврат
5. **long‑term companion**
   - память, устойчивость, доверие и высокий уровень автономии

## Trust Dynamics
- доверие растет от устойчивых выполнений и честных объяснений
- доверие падает при несоответствии ожиданий, давлении или потере данных
- trust_level влияет на частоту и тон вмешательств

## Emotional State Dynamics
- тревога/усталость → режим Care/Recovery
- рост/успех → режим Confidence Boost/Guide
- риск/боль → Safety Hold и медицинский режим

## Integration Points
- `trustSafetyService`
- `uiRuntimeAdapter`
- Coach UI Components (cards, dialogs, banners)

## Definition of Done
- Зафиксирована state machine отношений.
- Определены trust/emotional динамики.
- Связано с UI и guard‑слоем.
