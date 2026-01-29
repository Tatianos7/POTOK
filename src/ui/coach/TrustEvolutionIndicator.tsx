interface TrustEvolutionIndicatorProps {
  narrative: string;
}

const TrustEvolutionIndicator = ({ narrative }: TrustEvolutionIndicatorProps) => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
      {narrative}
    </div>
  );
};

export default TrustEvolutionIndicator;
