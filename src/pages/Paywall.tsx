import { useNavigate } from 'react-router-dom';
import { Check, ShoppingBasket, X } from 'lucide-react';
import Card from '../ui/components/Card';
import ScreenContainer from '../ui/components/ScreenContainer';
import Button from '../ui/components/Button';
import { colors, spacing, typography } from '../ui/theme/tokens';
import { clearDemoPremiumAccess, enableDemoPremiumAccess, hasDemoPremiumAccess } from '../services/demoPremiumAccess';

const premiumValues = [
  'Готовые планы питания и тренировок под вашу цель',
  'Рецепты с КБЖУ, граммовками и способом приготовления',
  'Замены блюд, если что-то не подходит',
  'Подсказки без весов: сколько это примерно на глаз',
  'Список покупок для выбранных дней',
  'Просмотр 14 дней с понятной структурой плана',
];

const Paywall = () => {
  const navigate = useNavigate();
  const demoAccessEnabled = hasDemoPremiumAccess();

  const openDemoPremium = () => {
    enableDemoPremiumAccess();
    navigate('/today');
  };

  const exitDemoPremium = () => {
    clearDemoPremiumAccess();
    navigate('/');
  };

  return (
    <ScreenContainer padding="lg" gap="sm">
      <header className="flex items-center justify-between" style={{ marginBottom: spacing.sm }}>
        <div style={{ width: 32 }} />
        <h1 style={{ ...typography.title, textTransform: 'uppercase', textAlign: 'center' }}>POTOK Premium</h1>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} aria-label="Закрыть">
          <X className="w-5 h-5" style={{ color: colors.text.secondary }} />
        </Button>
      </header>

      <Card variant="surface" size="md">
        <div className="space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <ShoppingBasket size={20} aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold leading-tight text-stone-950">Меньше думайте — больше выполняйте</h2>
            <p className="text-sm leading-5 text-stone-600">
              Посмотрите, как POTOK собирает питание, тренировки и покупки под вашу цель. Сейчас демо помогает оценить
              структуру Premium без оформления.
            </p>
          </div>
        </div>
      </Card>

      <Card variant="default" size="sm">
        <div className="space-y-2">
          {premiumValues.map((value) => (
            <div key={value} className="flex items-start gap-2 text-sm leading-5 text-stone-700">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <Check size={14} aria-hidden="true" />
              </span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card variant="soft" size="sm">
        <p className="text-sm leading-5 text-stone-700">
          Бесплатные дневники питания, тренировок, замеры и Progress остаются доступны. Демо Premium можно открыть без
          покупки: оно показывает сценарий, но не оформляет доступ.
        </p>
      </Card>

      <div className="flex flex-col gap-2 min-[360px]:flex-row">
        <Button variant="primary" size="md" disabled style={{ flex: 1 }}>
          Подписка скоро
        </Button>
        <Button variant="outline" size="md" disabled style={{ flex: 1 }}>
          Покупки скоро
        </Button>
      </div>

      <Button variant="ghost" size="sm" onClick={openDemoPremium} align="center">
        Посмотреть демо Premium
      </Button>

      {demoAccessEnabled && (
        <Button variant="ghost" size="sm" onClick={exitDemoPremium} align="center">
          Выйти из демо Premium
        </Button>
      )}
    </ScreenContainer>
  );
};

export default Paywall;
