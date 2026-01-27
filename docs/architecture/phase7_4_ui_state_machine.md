# Phase 7.4 — UI State Machine (Calm Power Coach)

## Принципы
- Safety-first, Explainability-by-default
- Manual Mode = полноценный продукт
- Premium = усиление, а не давление
- Эмоциональная устойчивость: без стыда, с поддержкой и контролем

---

## Общая схема состояний
- `empty` → `loading` → `active`
- `active` → `error` → `recovery` → `active`
- `active` → `success`
- `active` → `blocked` (trust/safety) → `recovery`
- `active` → `premium-locked` → `active` (после апгрейда)

---

## Goal
**Состояния:** `empty`, `loading`, `active`, `success`, `error`, `recovery`  
**Триггеры:** ввод целей, сохранение, сетевые ошибки  
**Эмоция:** спокойная ясность, ощущение контроля  

---

## Measurements
**Состояния:** `empty`, `loading`, `active`, `error`, `recovery`, `success`  
**Триггеры:** сохранение замеров/фото, отсутствие данных  
**Эмоция:** фиксация «точки А», поддержка  

---

## Food Diary
**Состояния:** `empty`, `loading`, `active`, `error`, `recovery`, `success`  
**Триггеры:** добавление еды, offline sync  
**Эмоция:** спокойный контроль, без давления  

---

## Training Diary
**Состояния:** `empty`, `loading`, `active`, `error`, `recovery`, `success`  
**Триггеры:** добавление упражнений, офлайн  
**Эмоция:** уверенность, энергия без перегруза  

---

## Progress
**Состояния:** `empty`, `loading`, `active`, `error`, `recovery`, `success`, `blocked`  
**Триггеры:** отсутствие данных, частичные данные, trust drop  
**Эмоция:** поддержка, «ты в ритме»  

---

## Habits
**Состояния:** `empty`, `loading`, `active`, `error`, `recovery`, `success`  
**Триггеры:** streak/slip/recovery  
**Эмоция:** поддержка без стыда  

---

## Today (Follow Plan)
**Состояния:** `loading`, `active`, `blocked`, `premium-locked`, `error`, `recovery`, `success`  
**Триггеры:** status plan, trust/confidence, safety flags  
**Эмоция:** уверенное сопровождение  

---

## My Program
**Состояния:** `empty`, `loading`, `active`, `premium-locked`, `error`, `recovery`  
**Триггеры:** наличие программы, entitlements  
**Эмоция:** ясность, ощущение пути  

---

## Profile
**Состояния:** `loading`, `active`, `error`, `recovery`  
**Триггеры:** ошибки профиля, смена сессии  
**Эмоция:** доверие, безопасность  

---

## Paywall / Subscription
**Состояния:** `active`, `premium-locked`, `success`, `error`, `recovery`  
**Триггеры:** entitlement, restore purchase  
**Эмоция:** ценность, а не давление  

