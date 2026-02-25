import { type FC } from 'react';
import { useNavigate } from 'react-router-dom';

const ProgressHabits: FC = () => {
  const navigate = useNavigate();
  return (
    <div className="p-4">
      <button type="button" className="mb-4 text-sm text-gray-600" onClick={() => navigate('/progress')}>
        Назад
      </button>
      <h1 className="text-xl font-semibold">Привычки</h1>
      <p className="mt-2 text-sm text-gray-500">Раздел в разработке.</p>
    </div>
  );
};

export default ProgressHabits;
