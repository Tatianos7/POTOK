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

/**
 * Генерирует PDF с рекомендациями по питанию
 */
export async function generateNutritionPDF(advice: string, userData: UserGoalData): Promise<void> {
  const container = buildAdviceContainer(
    'ПЕРСОНАЛЬНЫЕ РЕКОМЕНДАЦИИ ПО ПИТАНИЮ',
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
  const container = buildAdviceContainer(
    'ПЕРСОНАЛЬНЫЕ РЕКОМЕНДАЦИИ ПО ТРЕНИРОВКАМ',
    advice,
    userData,
    false
  );
  const fileName = `Рекомендации_по_тренировкам_${new Date().toISOString().split('T')[0]}.pdf`;
  await renderPdfFromContainer(container, fileName);
}
