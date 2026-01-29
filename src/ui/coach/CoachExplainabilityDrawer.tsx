import { useState } from 'react';
import type { CoachExplainabilityBinding } from '../../types/coachMemory';
import CoachExplainability from './CoachExplainability';

interface CoachExplainabilityDrawerProps {
  decisionId?: string;
  trace?: CoachExplainabilityBinding | null;
  title?: string;
  fallbackReason?: string;
  confidence?: number;
  trustLevel?: string;
  safetyFlags?: string[];
}

const CoachExplainabilityDrawer = ({
  decisionId,
  trace,
  title = 'Почему коуч так сказал?',
  fallbackReason = 'Я могу помочь, но сейчас без деталей.',
  confidence,
  trustLevel,
  safetyFlags,
}: CoachExplainabilityDrawerProps) => {
  const [open, setOpen] = useState(false);
  const memoryRefs = trace?.memory_refs ?? [];
  const formatRelative = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const days = Math.max(1, Math.round(diffMs / 86400000));
    if (days >= 28) return 'около месяца назад';
    if (days >= 14) return '2 недели назад';
    if (days >= 7) return 'неделю назад';
    return `${days} дн. назад`;
  };
  const firstMemory = memoryRefs[0];
  const secondMemory = memoryRefs[1];
  const firstSummary = firstMemory?.summary ?? 'Я опираюсь на вашу историю.';
  const reason = trace
    ? memoryRefs.length > 0
      ? `Ты уже проходил похожий спад ${formatRelative(firstMemory?.occurredAt)}. ${firstSummary}`
      : 'Решение связано с текущими сигналами и безопасностью.'
    : fallbackReason;
  const memorySummaries = memoryRefs.map((ref) => ref.summary);
  const trustSummary = trace?.trust_history?.length
    ? 'Я учитываю изменения доверия и беру мягкий тон.'
    : 'Доверие учитывается на основе устойчивости.';
  const voiceSummary = trace?.voice?.triggered
    ? `Почему голос: ${trace.voice.reason ?? 'голосовое сопровождение'}. Тон: ${
        trace.voice.tone ?? 'нейтральный'
      }.`
    : null;
  const voiceSignals = trace?.voice?.signals?.length ? trace.voice.signals.join(', ') : null;
  const decisionWhy = trace?.decision?.whyNow;
  const decisionBasis = trace?.decision?.basis?.length ? trace.decision.basis.join(', ') : null;
  const decisionAlternatives = trace?.decision?.alternatives?.length
    ? trace.decision.alternatives.join(' · ')
    : null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {open ? 'Скрыть объяснение' : 'Почему так?'}
      </button>
      {open && (
        <div className="mt-3">
          <CoachExplainability
            title={title}
            reason={reason}
            sources={memorySummaries}
            confidence={confidence}
            trustLevel={trustLevel}
            safetyFlags={safetyFlags}
          />
          {secondMemory && (
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              Тогда помогло: {secondMemory.summary} Я учитываю это сейчас.
            </p>
          )}
          {trace?.pattern_matches?.length ? (
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              Паттерны: {trace.pattern_matches.join(', ')}
            </p>
          ) : null}
          {voiceSummary && (
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{voiceSummary}</p>
          )}
          {voiceSignals && (
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              Сигналы для голоса: {voiceSignals}
            </p>
          )}
          {decisionWhy && (
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              Почему сейчас: {decisionWhy}
            </p>
          )}
          {decisionBasis && (
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              Основание: {decisionBasis}
            </p>
          )}
          {decisionAlternatives && (
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              Альтернативы: {decisionAlternatives}
            </p>
          )}
          <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{trustSummary}</p>
          {decisionId && (
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Decision: {decisionId}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default CoachExplainabilityDrawer;
