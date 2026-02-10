interface CoachSpeakingIndicatorProps {
  label?: string;
}

const CoachSpeakingIndicator = ({ label = 'Коуч говорит…' }: CoachSpeakingIndicatorProps) => {
  return (
    <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
      {label}
    </div>
  );
};

export default CoachSpeakingIndicator;
