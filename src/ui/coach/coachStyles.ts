import { borders, surfaces, typography } from '../theme/tokens';

export type CoachEmotionalMode =
  | 'support'
  | 'motivate'
  | 'stabilize'
  | 'protect'
  | 'celebrate'
  | 'guide'
  | 'reframe';

export const coachModeCopy: Record<CoachEmotionalMode, string> = {
  support: 'Support',
  motivate: 'Motivation',
  stabilize: 'Stabilize',
  protect: 'Safety',
  celebrate: 'Celebrate',
  guide: 'Guidance',
  reframe: 'Reframe',
};

export const coachModeStyles: Record<
  CoachEmotionalMode,
  { container: string; title: string; body: string; accent: string }
> = {
  support: {
    container: `${surfaces.info} ${borders.base}`,
    title: typography.title,
    body: typography.body,
    accent: 'text-sky-700',
  },
  motivate: {
    container: `${surfaces.success} ${borders.success}`,
    title: typography.title,
    body: typography.body,
    accent: 'text-emerald-700',
  },
  stabilize: {
    container: `${surfaces.muted} ${borders.soft}`,
    title: typography.title,
    body: typography.body,
    accent: 'text-gray-700 dark:text-gray-300',
  },
  protect: {
    container: `${surfaces.error} ${borders.error}`,
    title: typography.title,
    body: typography.body,
    accent: 'text-red-700',
  },
  celebrate: {
    container: `${surfaces.success} ${borders.success}`,
    title: typography.title,
    body: typography.body,
    accent: 'text-emerald-700',
  },
  guide: {
    container: `${surfaces.warn} ${borders.warn}`,
    title: typography.title,
    body: typography.body,
    accent: 'text-amber-700',
  },
  reframe: {
    container: `${surfaces.muted} ${borders.base}`,
    title: typography.title,
    body: typography.body,
    accent: 'text-indigo-700',
  },
};
