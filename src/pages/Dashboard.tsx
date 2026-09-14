import { useAuth } from '../context/AuthContext';
import { Menu as MenuIcon } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Menu from '../components/Menu';
import ProgressDailyGoalCard from '../components/ProgressDailyGoalCard';
import Today from './Today';
import { activityService } from '../services/activityService';
import { hasDemoPremiumAccess } from '../services/demoPremiumAccess';
import { progressHubService, type ProgressHubData } from '../services/progressHubService';
import {
  deriveProgressDailyGoalPeriodMetrics,
  deriveProgressDailyGoalState,
  normalizeProgressDailyGoalPreferences,
  type ProgressDailyGoalPreferences,
} from '../utils/progressDailyGoal';
import './ProgressHub.css';

function getDailyGoalPreferencesStorageKey(userId: string): string {
  return `potok_progress_daily_goal_preferences_${userId}`;
}

function loadDailyGoalPreferences(userId: string | undefined): ProgressDailyGoalPreferences {
  if (!userId || typeof window === 'undefined') {
    return normalizeProgressDailyGoalPreferences(null);
  }

  try {
    const raw = window.localStorage.getItem(getDailyGoalPreferencesStorageKey(userId));
    return normalizeProgressDailyGoalPreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeProgressDailyGoalPreferences(null);
  }
}

function saveDailyGoalPreferences(userId: string | undefined, preferences: ProgressDailyGoalPreferences): void {
  if (!userId || typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(getDailyGoalPreferencesStorageKey(userId), JSON.stringify(preferences));
  } catch {
    // localStorage can be unavailable in restricted browser modes.
  }
}

function getNutritionSummaryResult(data: ProgressHubData): string {
  if (data.nutrition.state === 'error') return 'Питание временно недоступно.';
  if (data.nutrition.loggedDays === 0) return 'Питание пока не заполнено.';

  const averageCalories =
    data.nutrition.averageCalories !== null ? `${data.nutrition.averageCalories} ккал/день` : 'есть записи';
  return `Питание: ${data.nutrition.loggedDays}/${data.nutrition.totalDays} дней, ${averageCalories}.`;
}

function getHomeSummaryResults(data: ProgressHubData | null): string[] {
  if (!data) return [];

  const results: string[] = [];

  if (data.goal.state === 'error') {
    results.push('Цель временно недоступна.');
  } else if (data.goal.hasGoal) {
    const remaining =
      data.goal.remainingWeight !== null ? `осталось ${data.goal.remainingWeight} кг` : 'цель задана';
    results.push(`Цель: ${data.goal.goalTypeLabel ?? 'личная цель'}, ${remaining}.`);
  } else {
    results.push('Цель ещё не задана.');
  }

  results.push(getNutritionSummaryResult(data));

  if (data.workouts.state === 'error') {
    results.push('Тренировки временно недоступны.');
  } else if (data.workouts.workoutsCount30d > 0) {
    results.push(`Тренировки: ${data.workouts.workoutsCount30d} за 30 дней, последняя ${data.workouts.lastWorkoutLabel}.`);
  } else {
    results.push('Тренировок за 30 дней пока нет.');
  }

  return results;
}

const Dashboard = () => {
  const { user, profile, authStatus, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [progressData, setProgressData] = useState<ProgressHubData | null>(null);
  const [isProgressLoading, setIsProgressLoading] = useState(false);
  const [progressErrorMessage, setProgressErrorMessage] = useState<string | null>(null);
  const [dailyGoalPreferences, setDailyGoalPreferences] = useState<ProgressDailyGoalPreferences>(() =>
    loadDailyGoalPreferences(user?.id),
  );

  // Перенаправляем админов в админ-панель
  useEffect(() => {
    if (authStatus === 'authenticated' && (profile?.is_admin || user?.isAdmin)) {
      navigate('/admin');
    }
  }, [authStatus, profile?.is_admin, user?.isAdmin, navigate]);

  // Обновляем активность пользователя
  useEffect(() => {
    if (user?.id) {
      activityService.updateActivity(user.id);
      
      // Обновляем активность каждую минуту
      const interval = setInterval(() => {
        if (user?.id) {
          activityService.updateActivity(user.id);
        }
      }, 60000); // Каждую минуту

      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    setDailyGoalPreferences(loadDailyGoalPreferences(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !user?.id) {
      setProgressData(null);
      return;
    }

    let cancelled = false;
    setIsProgressLoading(true);
    setProgressErrorMessage(null);

    progressHubService
      .getProgressHubData(user.id)
      .then((result) => {
        if (cancelled) return;
        setProgressData(result);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[Dashboard] progress hub load failed', error);
        setProgressErrorMessage('Главная временно не может загрузить Progress.');
        setProgressData(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsProgressLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, user?.id]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName = user?.profile?.firstName || user?.name || 'Пользователь';
  const effectiveHasPremium = Boolean(user?.hasPremium || hasDemoPremiumAccess());
  const summaryResults = useMemo(() => getHomeSummaryResults(progressData), [progressData]);
  const dailyGoalState = useMemo(
    () =>
      deriveProgressDailyGoalState({
        caloriesLogged: progressData?.today.caloriesLogged ?? 0,
        calorieTarget: progressData?.goal.caloriesTarget,
        hasWorkoutEntries: progressData?.today.hasWorkoutEntries ?? false,
        waterGlasses: progressData?.today.waterGlasses,
        waterEnabled: progressData?.today.waterGlasses !== null,
        progressViewed: true,
        periodMetrics: progressData
          ? deriveProgressDailyGoalPeriodMetrics(progressData.dailyGoalPeriodDays, dailyGoalPreferences.selectedItemIds)
          : null,
        preferences: dailyGoalPreferences,
      }),
    [dailyGoalPreferences, progressData],
  );

  const handleDailyGoalPreferencesChange = (nextPreferences: ProgressDailyGoalPreferences) => {
    const normalizedPreferences = normalizeProgressDailyGoalPreferences(nextPreferences);
    setDailyGoalPreferences(normalizedPreferences);
    saveDailyGoalPreferences(user?.id, normalizedPreferences);
  };

  return (
    <div className="min-h-screen bg-white w-full min-w-[320px]">
      <div className="container-responsive">
        {/* Header */}
        <header className="py-4 flex items-center justify-center relative border-b border-gray-200">
          <h1 className="text-base mobile-lg:text-lg font-semibold text-gray-900">
            Привет, {displayName}
          </h1>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="absolute right-0 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Меню"
          >
            <MenuIcon className="w-5 h-5 mobile-lg:w-6 mobile-lg:h-6 text-gray-700" />
          </button>
        </header>

        {/* Menu Popup */}
        <Menu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          onLogout={handleLogout}
          userEmail={user?.profile?.email || user?.email}
        />

        {/* Main Content */}
        <main className="py-4 tablet:py-6">
          {effectiveHasPremium ? (
            <div className="space-y-4" aria-label="Premium dashboard">
              <Today embeddedInAppShell />
            </div>
          ) : null}

          {!effectiveHasPremium ? (
            <div className="space-y-4">
              <ProgressDailyGoalCard state={dailyGoalState} onPreferencesChange={handleDailyGoalPreferencesChange} />

              <section className="progress-summary-card" aria-label="Основной результат">
                <p className="progress-summary-kicker">Последние 30 дней</p>
                <h2 className="progress-summary-title">Основной результат</h2>
                {isProgressLoading ? (
                  <p className="progress-summary-text">Загрузка...</p>
                ) : progressErrorMessage ? (
                  <p className="progress-summary-text">{progressErrorMessage}</p>
                ) : summaryResults.length > 0 ? (
                  <div className="progress-summary-list">
                    {summaryResults.map((item) => (
                      <p key={item} className="progress-summary-text">
                        {item}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="progress-summary-text">Здесь появится результат по цели, питанию и тренировкам.</p>
                )}
              </section>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
