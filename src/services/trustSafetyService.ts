export type TrustIssueCategory =
  | "network"
  | "data"
  | "medical"
  | "overtraining"
  | "timeout"
  | "low_confidence"
  | "unknown";

export type TrustAction = "block" | "warn" | "adapt" | "fallback" | "explain";

export interface TrustDecision {
  category: TrustIssueCategory;
  action: TrustAction;
  message: string;
}

export interface TrustContext {
  confidence?: number;
  safetyFlags?: string[];
}

const NETWORK_HINTS = ["network", "timeout", "failed to fetch", "fetch"];
const DATA_HINTS = ["invalid", "schema", "rls", "row-level", "permission"];
const MEDICAL_HINTS = ["pain", "injury", "medical"];
const OVERTRAINING_HINTS = ["fatigue", "overload", "overtraining"];

function includesHint(value: string, hints: string[]): boolean {
  const lowered = value.toLowerCase();
  return hints.some((hint) => lowered.includes(hint));
}

export function classifyTrustDecision(
  error?: unknown,
  context: TrustContext = {}
): TrustDecision {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const flags = (context.safetyFlags || []).map((flag) => String(flag).toLowerCase());

  if (message.toLowerCase().includes("loading_timeout")) {
    return {
      category: "timeout",
      action: "recover",
      message: "Данные загружаются слишком долго. Попробуйте восстановить.",
    };
  }

  if (includesHint(message, NETWORK_HINTS)) {
    return { category: "network", action: "fallback", message: "Проблемы с сетью. Используем офлайн-данные." };
  }

  if (flags.some((flag) => includesHint(flag, MEDICAL_HINTS))) {
    return { category: "medical", action: "block", message: "Есть риск для здоровья. Действие ограничено." };
  }

  if (flags.some((flag) => includesHint(flag, OVERTRAINING_HINTS))) {
    return { category: "overtraining", action: "adapt", message: "Высокая нагрузка. Рекомендуем адаптацию." };
  }

  if (context.confidence !== undefined && context.confidence < 0.5) {
    return { category: "low_confidence", action: "warn", message: "Недостаточно данных для уверенного вывода." };
  }

  if (includesHint(message, DATA_HINTS)) {
    return { category: "data", action: "explain", message: "Проблемы с данными. Покажем доступные факты." };
  }

  return { category: "unknown", action: "explain", message: "Произошла ошибка. Мы постарались сохранить данные." };
}
