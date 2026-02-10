import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { animation, colors, radius, spacing } from '../theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  align?: 'center' | 'start';
}

const sizeStyles: Record<ButtonSize, { height: number; paddingX: number; fontSize: string }> = {
  sm: { height: 32, paddingX: spacing.sm, fontSize: '12px' },
  md: { height: 40, paddingX: spacing.md, fontSize: '13px' },
  lg: { height: 48, paddingX: spacing.lg, fontSize: '14px' },
};

const variantStyles: Record<ButtonVariant, { background: string; color: string; border: string }> = {
  primary: { background: colors.primary, color: '#FFFFFF', border: colors.primary },
  secondary: { background: colors.surface, color: colors.primary, border: colors.border },
  outline: { background: 'transparent', color: colors.text.primary, border: colors.border },
  ghost: { background: 'transparent', color: colors.text.secondary, border: 'transparent' },
  danger: { background: colors.danger, color: '#FFFFFF', border: colors.danger },
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    align = 'center',
    style,
    disabled,
    ...props
  }: ButtonProps,
  ref
) {
  const sizing = sizeStyles[size];
  const variantStyle = variantStyles[variant];

  return (
    <button
      {...props}
      ref={ref}
      disabled={disabled}
      className="inline-flex items-center justify-center font-semibold transition-transform"
      style={{
        height: sizing.height,
        paddingLeft: sizing.paddingX,
        paddingRight: sizing.paddingX,
        fontSize: sizing.fontSize,
        borderRadius: radius.md,
        border: `1px solid ${variantStyle.border}`,
        backgroundColor: variantStyle.background,
        color: variantStyle.color,
        opacity: disabled ? 0.6 : 1,
        transform: 'translateZ(0)',
        transition: `opacity ${animation.base} ${animation.easing}, transform ${animation.base} ${animation.easing}`,
        width: fullWidth ? '100%' : undefined,
        justifyContent: align === 'start' ? 'flex-start' : 'center',
        ...style,
      }}
    />
  );
});

(Button as any).displayName = 'Button';

export default Button;
