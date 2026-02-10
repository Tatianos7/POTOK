interface CoachVoiceButtonProps {
  label?: string;
  disabled?: boolean;
  onClick?: () => void;
}

const CoachVoiceButton = ({ label = '🎙 Голос', disabled, onClick }: CoachVoiceButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
        disabled
          ? 'border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-500'
          : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  );
};

export default CoachVoiceButton;
