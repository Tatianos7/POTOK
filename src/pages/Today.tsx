import { useNavigate } from 'react-router-dom';
import { ClipboardList, ShieldCheck, Sparkles, UserCheck, X } from 'lucide-react';
import ScreenContainer from '../ui/components/ScreenContainer';
import Card from '../ui/components/Card';
import Button from '../ui/components/Button';

const todayModes = [
  {
    id: 'ai',
    title: 'POTOK AI',
    subtitle: 'Адаптивный план под вашу цель',
    icon: Sparkles,
    points: ['Питание и тренировки на день', 'Замены, если пункт не подходит', 'Анализ дня и недели позже'],
    cta: 'Подключить AI',
  },
  {
    id: 'plans',
    title: 'Готовые программы',
    subtitle: 'Готовый путь без тренера',
    icon: ClipboardList,
    points: ['План раскрывается по дням', 'Ежедневные карточки в Today', 'Не PDF, а живой план'],
    cta: 'Смотреть программы',
  },
  {
    id: 'coach',
    title: 'Персональный тренер',
    subtitle: 'План от проверенного специалиста',
    icon: UserCheck,
    points: ['Тренер назначает план', 'План появляется в Today', 'Контроль и корректировки позже'],
    cta: 'Найти тренера',
  },
];

const Today = () => {
  const navigate = useNavigate();

  return (
    <ScreenContainer padding="lg" gap="sm">
      <Card
        variant="surface"
        size="md"
        action={
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} aria-label="Закрыть">
            <X size={18} />
          </Button>
        }
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">План на день</p>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold leading-tight text-stone-950">Today</h1>
            <p className="text-base font-medium leading-6 text-stone-800">План на день, который ведёт вас к цели</p>
            <p className="text-sm leading-5 text-stone-600">
              Идите самостоятельно в бесплатном POTOK или подключите поддержку: AI, программу или тренера.
            </p>
          </div>
          <div className="flex flex-col gap-2 min-[360px]:flex-row">
            <Button variant="outline" size="sm" onClick={() => navigate('/progress')} align="center">
              Бесплатный Progress
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3">
        {todayModes.map((mode) => {
          const Icon = mode.icon;
          return (
            <Card key={mode.id} variant="default" size="sm">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-800">
                  <Icon size={18} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <h2 className="text-base font-semibold leading-6 text-stone-950">{mode.title}</h2>
                      <p className="text-sm leading-5 text-stone-600">{mode.subtitle}</p>
                    </div>
                    <span className="flex-shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium leading-none text-stone-600">
                      Скоро
                    </span>
                  </div>
                  <ul className="space-y-1 text-sm leading-5 text-stone-700">
                    {mode.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span className="mt-[0.45rem] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" size="sm" disabled align="center">
                    {mode.cta}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card variant="soft" size="sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 flex-shrink-0 text-emerald-700" size={18} aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold leading-5 text-stone-950">План ≠ запись в дневнике</h2>
            <p className="text-sm leading-5 text-stone-700">В дневник попадает только подтверждённое или выполненное.</p>
          </div>
        </div>
      </Card>
    </ScreenContainer>
  );
};

export default Today;
