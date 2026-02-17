import { forwardRef, useMemo, useState, type InputHTMLAttributes } from 'react';

type InputVisualState = 'idle' | 'focus' | 'filled';

type BaseInputProps = InputHTMLAttributes<HTMLInputElement>;

const BaseInput = forwardRef<HTMLInputElement, BaseInputProps>(
  ({ value, className = '', onFocus, onBlur, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    const hasValue = useMemo(() => {
      if (value == null) return false;
      return String(value).length > 0;
    }, [value]);

    const inputState: InputVisualState = useMemo(() => {
      if (isFocused) return 'focus';
      if (hasValue) return 'filled';
      return 'idle';
    }, [isFocused, hasValue]);

    return (
      <input
        {...props}
        ref={ref}
        value={value}
        data-state={inputState}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        className={`base-input ${className}`.trim()}
      />
    );
  }
);

BaseInput.displayName = 'BaseInput';

export default BaseInput;
