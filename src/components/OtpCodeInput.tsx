interface OtpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  error?: string | null;
  id?: string;
  autoFocus?: boolean;
}

const OtpCodeInput = ({
  value,
  onChange,
  disabled = false,
  label = 'Код',
  placeholder = 'Введите код',
  minLength = 1,
  maxLength = 10,
  error = null,
  id = 'otp-code',
  autoFocus = false,
}: OtpCodeInputProps) => {
  const normalize = (raw: string): string => raw.replace(/\D/g, '').slice(0, Math.max(maxLength, minLength));

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={value}
        onChange={(e) => onChange(normalize(e.target.value))}
        onPaste={(e) => {
          e.preventDefault();
          const pastedText = e.clipboardData?.getData('text') ?? '';
          onChange(normalize(pastedText));
        }}
        autoFocus={autoFocus}
        disabled={disabled}
        className="input-field"
        placeholder={placeholder}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default OtpCodeInput;
