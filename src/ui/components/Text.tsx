import type { ReactNode, CSSProperties } from 'react';
import { colors, typography } from '../theme/tokens';

type TextVariant = 'hero' | 'title' | 'subtitle' | 'body' | 'micro';

interface TextProps {
  children: ReactNode;
  variant?: TextVariant;
  as?: 'p' | 'span' | 'div' | 'h1' | 'h2';
}

const variantStyles: Record<TextVariant, CSSProperties> = {
  hero: {
    fontSize: '28px',
    lineHeight: '32px',
    fontWeight: 600,
    color: colors.text.primary,
  },
  title: typography.title,
  subtitle: typography.subtitle,
  body: typography.body,
  micro: typography.micro,
};

const Text = ({ children, variant = 'body', as = 'p' }: TextProps) => {
  const Component = as;
  return <Component style={variantStyles[variant]}>{children}</Component>;
};

export default Text;
