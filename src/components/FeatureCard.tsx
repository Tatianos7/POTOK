import { FeatureCard as FeatureCardType } from '../types';
import { ComponentType } from 'react';

interface FeatureCardProps {
  card: FeatureCardType;
  icon: ComponentType<{ className?: string }>;
  hasPremium: boolean;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ card, icon: Icon, hasPremium }) => {
  const showPremium = card.isPremium && !hasPremium;
  
  const getPremiumStyles = () => {
    if (card.premiumColor === 'green') {
      return 'text-primary-600 bg-primary-50';
    } else if (card.premiumColor === 'yellow') {
      return 'text-yellow-600 bg-yellow-50';
    }
    return 'text-primary-600 bg-primary-50';
  };

  return (
    <div className="card relative">
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
          <Icon className="w-7 h-7 text-gray-700" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-base font-semibold text-gray-900">
              {card.title}
            </h3>
            {showPremium && (
              <span className={`flex-shrink-0 px-2 py-1 text-xs font-semibold rounded ${getPremiumStyles()}`}>
                PREMIUM
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">
            {card.subtitle}
          </p>
        </div>
      </div>
    </div>
  );
};

export default FeatureCard;
