import type { CSSProperties } from 'react';
import { colors, radius, spacing, typography } from '../theme/tokens';

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
  { containerStyle: CSSProperties; titleStyle: CSSProperties; bodyStyle: CSSProperties; accentColor: string }
> = {
  support: {
    containerStyle: {
      backgroundColor: colors.emotional.support,
      border: `1px solid ${colors.border}`,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    titleStyle: typography.title,
    bodyStyle: typography.body,
    accentColor: colors.primary,
  },
  motivate: {
    containerStyle: {
      backgroundColor: colors.emotional.recovery,
      border: `1px solid ${colors.success}`,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    titleStyle: typography.title,
    bodyStyle: typography.body,
    accentColor: colors.success,
  },
  stabilize: {
    containerStyle: {
      backgroundColor: colors.emotional.support,
      border: `1px solid ${colors.border}`,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    titleStyle: typography.title,
    bodyStyle: typography.body,
    accentColor: colors.text.secondary,
  },
  protect: {
    containerStyle: {
      backgroundColor: colors.emotional.fatigue,
      border: `1px solid ${colors.danger}`,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    titleStyle: typography.title,
    bodyStyle: typography.body,
    accentColor: colors.danger,
  },
  celebrate: {
    containerStyle: {
      backgroundColor: colors.emotional.recovery,
      border: `1px solid ${colors.success}`,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    titleStyle: typography.title,
    bodyStyle: typography.body,
    accentColor: colors.success,
  },
  guide: {
    containerStyle: {
      backgroundColor: colors.emotional.plateau,
      border: `1px solid ${colors.warning}`,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    titleStyle: typography.title,
    bodyStyle: typography.body,
    accentColor: colors.warning,
  },
  reframe: {
    containerStyle: {
      backgroundColor: colors.emotional.plateau,
      border: `1px solid ${colors.border}`,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    titleStyle: typography.title,
    bodyStyle: typography.body,
    accentColor: colors.primary,
  },
};
