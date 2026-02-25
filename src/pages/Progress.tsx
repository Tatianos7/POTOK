import { type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Dumbbell, Ruler, UtensilsCrossed, X } from 'lucide-react';
import ProgressCard from '../components/ProgressCard';
import './ProgressHub.css';

const Progress: FC = () => {
  const navigate = useNavigate();

  return (
    <div className="progress-hub">
      <div className="progress-header">
        <h1 className="progress-title">ПРОГРЕСС</h1>
        <button
          type="button"
          className="progress-close"
          onClick={() => navigate('/')}
          aria-label="Закрыть"
        >
          <X size={22} />
        </button>
      </div>

      <ProgressCard
        title="ЗАМЕРЫ"
        subtitle="Замерь себя"
        icon={Ruler}
        onClick={() => navigate('/progress/measurements')}
      />

      <ProgressCard
        title="ПИТАНИЕ"
        subtitle="Здесь твой дневник питания"
        icon={UtensilsCrossed}
        onClick={() => navigate('/progress/nutrition')}
      />

      <ProgressCard
        title="ТРЕНИРОВКИ"
        subtitle="Здесь дневник твоих тренировок"
        icon={Dumbbell}
        onClick={() => navigate('/progress/workouts')}
      />

      <ProgressCard
        title="ПРИВЫЧКИ"
        subtitle="Здесь твой трекер-привычек"
        icon={CheckSquare}
        onClick={() => navigate('/progress/habits')}
      />
    </div>
  );
};

export default Progress;
