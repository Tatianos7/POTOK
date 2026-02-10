import type { InputHTMLAttributes, ReactNode } from 'react';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: ReactNode;
  error?: string;
}

const Input = ({ label, helperText, error, style, ...props }: InputProps) => {
  return (
    <label className="flex flex-col gap-2">
      {label && <span style={typography.subtitle}>{label}</span>}
      <input
        {...props}
        style={{
          height: 44,
          padding: `0 ${spacing.md}px`,
          borderRadius: radius.md,
          border: `1px solid ${error ? colors.danger : colors.border}`,
          backgroundColor: colors.surface,
          color: colors.text.primary,
          fontSize: '14px',
          ...style,
        }}
      />
      {error ? (
        <span style={{ ...typography.micro, color: colors.danger }}>{error}</span>
      ) : (
        helperText && <span style={typography.micro}>{helperText}</span>
      )}
    </label>
  );
};

export default Input;
