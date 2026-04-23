import { useNavigate } from 'react-router-dom';
import MuscleMap from '../components/MuscleMap';
import type { MuscleKey } from '../constants/muscles';

const DEMO_CASES: Array<{
  title: string;
  primary?: MuscleKey[];
  secondary?: MuscleKey[];
}> = [
  {
    title: 'Только primary front мышцы',
    primary: ['front_delts', 'chest', 'abs'],
  },
  {
    title: 'Primary + secondary mixed',
    primary: ['lats', 'glutes'],
    secondary: ['rear_delts', 'hamstrings'],
  },
  {
    title: 'Смешанный front/back full example',
    primary: ['quads', 'glutes'],
    secondary: ['abs', 'lower_back'],
  },
  {
    title: 'Пустой кейс',
    primary: [],
    secondary: [],
  },
];

const MuscleMapDemo = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white px-4 py-6 text-gray-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">MuscleMap Demo</h1>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700"
          >
            Закрыть
          </button>
        </div>

        <p className="text-sm text-gray-600">
          Временная dev surface для ручной проверки foundation muscle map.
        </p>

        <div className="grid gap-6">
          {DEMO_CASES.map((demoCase) => (
            <section key={demoCase.title} className="rounded border border-gray-200 p-4">
              <h2 className="mb-3 text-lg font-medium">{demoCase.title}</h2>
              <div className="mb-4 space-y-1 text-sm text-gray-700">
                <div>primary: {(demoCase.primary ?? []).length > 0 ? demoCase.primary?.join(', ') : '—'}</div>
                <div>secondary: {(demoCase.secondary ?? []).length > 0 ? demoCase.secondary?.join(', ') : '—'}</div>
              </div>
              <MuscleMap primary={demoCase.primary} secondary={demoCase.secondary} />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MuscleMapDemo;
