import type { FC } from 'react';
import type { ComponentType } from 'react';

type ProgressCardProps = {
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
};

const ProgressCard: FC<ProgressCardProps> = ({ title, subtitle, icon: Icon, onClick }) => {
  return (
    <button className="progress-card" onClick={onClick} type="button">
      <div className="progress-card-icon" aria-hidden="true">
        <Icon className="w-7 h-7 text-gray-700" />
      </div>
      <div className="progress-card-content">
        <div className="progress-card-title">{title}</div>
        <div className="progress-card-subtitle">{subtitle}</div>
      </div>
    </button>
  );
};

export default ProgressCard;
