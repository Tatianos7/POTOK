import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { UserGoalData } from '../types/aiAdvice';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildAdviceContainer = (title: string, advice: string, userData: UserGoalData, includeTargets: boolean) => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.padding = '24px';
  container.style.background = '#ffffff';
  container.style.color = '#111827';
  container.style.fontFamily = 'Arial, "Helvetica Neue", sans-serif';
  container.style.fontSize = '12px';
  container.style.lineHeight = '1.4';

  const userInfo = `Пол: ${userData.gender === 'male' ? 'Мужчина' : 'Женщина'} | Возраст: ${userData.age} лет | Вес: ${userData.weight} кг | Рост: ${userData.height} см`;
  const targets = [
    `Калории: ${userData.calories} ккал/день`,
    `Белки: ${userData.protein} г/день`,
    `Жиры: ${userData.fat} г/день`,
    `Углеводы: ${userData.carbs} г/день`,
  ];

  const adviceHtml = escapeHtml(advice).replace(/\n/g, '<br/>');

  container.innerHTML = `
    <div style="font-size:18px;font-weight:700;margin-bottom:12px;">${escapeHtml(title)}</div>
    <div style="font-size:12px;margin-bottom:10px;">${escapeHtml(userInfo)}</div>
    ${
      includeTargets
        ? `<div style="font-size:14px;font-weight:700;margin:10px 0 6px;">ВАШИ ЦЕЛЕВЫЕ ПОКАЗАТЕЛИ:</div>
           <div style="margin-bottom:10px;">
             ${targets.map((target) => `<div style="margin:2px 0;">• ${escapeHtml(target)}</div>`).join('')}
           </div>`
        : ''
    }
    <div style="font-size:11px;white-space:normal;">${adviceHtml}</div>
    <div style="margin-top:12px;font-size:9px;color:#6b7280;font-style:italic;">
      ⚠️ Рекомендации носят информационный характер и не заменяют консультацию врача или специалиста.
    </div>
  `;

  return container;
};

const renderPdfFromContainer = async (container: HTMLDivElement, fileName: string): Promise<void> => {
  document.body.appendChild(container);
  const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff' });
  document.body.removeChild(container);

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
  heightLeft -= pdfHeight;

  while (heightLeft > 0) {
    position -= pdfHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;
  }

  pdf.save(fileName);
};

type TrainingPlace = 'home' | 'gym';

export const getCaloriesBucket = (calories: number): number => {
  if (!Number.isFinite(calories)) return 1300;
  if (calories < 1400) return 1300;
  if (calories < 1600) return 1500;
  if (calories < 1800) return 1700;
  if (calories < 2000) return 1900;
  if (calories < 2200) return 2100;
  if (calories < 2400) return 2300;
  if (calories < 2600) return 2500;
  if (calories < 2800) return 2700;
  if (calories < 3000) return 2900;
  if (calories < 3200) return 3100;
  if (calories < 3400) return 3300;
  if (calories < 3600) return 3500;
  if (calories < 3800) return 3700;
  if (calories < 4000) return 3900;
  return 4100;
};

export const getNutritionPdfUrl = (
  trainingPlace: TrainingPlace,
  calories: number,
  goalType: 'lose' | 'gain' | 'maintain'
): string => {
  const bucket = getCaloriesBucket(calories);
  return `/plans/nutrition/${goalType}/${trainingPlace}/${bucket}.pdf`;
};

export const getWorkoutPdfUrl = (
  trainingPlace: TrainingPlace,
  goalType: 'lose' | 'gain' | 'maintain'
): string => {
  return `/plans/workouts/${goalType}/${trainingPlace}/base.pdf`;
};

/**
 * Генерирует PDF с рекомендациями по питанию
 */
export async function generateNutritionPDF(advice: string, userData: UserGoalData): Promise<void> {
  const placeLabel = userData.trainingPlace === 'gym' ? 'В ЗАЛЕ' : 'ДОМА / НА УЛИЦЕ';
  const container = buildAdviceContainer(
    `ПЕРСОНАЛЬНЫЕ РЕКОМЕНДАЦИИ ПО ПИТАНИЮ (${placeLabel})`,
    advice,
    userData,
    true
  );
  const fileName = `Рекомендации_по_питанию_${new Date().toISOString().split('T')[0]}.pdf`;
  await renderPdfFromContainer(container, fileName);
}

/**
 * Генерирует PDF с рекомендациями по тренировкам
 */
export async function generateTrainingPDF(advice: string, userData: UserGoalData): Promise<void> {
  const placeLabel = userData.trainingPlace === 'gym' ? 'В ЗАЛЕ' : 'ДОМА / НА УЛИЦЕ';
  const container = buildAdviceContainer(
    `ПЕРСОНАЛЬНЫЕ РЕКОМЕНДАЦИИ ПО ТРЕНИРОВКАМ (${placeLabel})`,
    advice,
    userData,
    false
  );
  const fileName = `Рекомендации_по_тренировкам_${new Date().toISOString().split('T')[0]}.pdf`;
  await renderPdfFromContainer(container, fileName);
}
