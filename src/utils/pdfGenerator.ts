import jsPDF from 'jspdf';
import { UserGoalData } from '../types/aiAdvice';

/**
 * Генерирует PDF с рекомендациями по питанию
 */
export function generateNutritionPDF(advice: string, userData: UserGoalData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Заголовок
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ПЕРСОНАЛЬНЫЕ РЕКОМЕНДАЦИИ ПО ПИТАНИЮ', margin, yPosition);
  yPosition += 15;

  // Информация о пользователе
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const userInfo = `Пол: ${userData.gender === 'male' ? 'Мужчина' : 'Женщина'} | Возраст: ${userData.age} лет | Вес: ${userData.weight} кг | Рост: ${userData.height} см`;
  doc.text(userInfo, margin, yPosition);
  yPosition += 10;

  // Целевые показатели
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ВАШИ ЦЕЛЕВЫЕ ПОКАЗАТЕЛИ:', margin, yPosition);
  yPosition += 8;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const targets = [
    `Калории: ${userData.calories} ккал/день`,
    `Белки: ${userData.protein} г/день`,
    `Жиры: ${userData.fat} г/день`,
    `Углеводы: ${userData.carbs} г/день`,
  ];
  targets.forEach((target) => {
    doc.text(`• ${target}`, margin + 5, yPosition);
    yPosition += 6;
  });
  yPosition += 5;

  // Разбиваем текст совета на части
  const adviceLines = doc.splitTextToSize(advice, maxWidth - 10) as string[];
  
  // Проверяем, нужно ли добавить новую страницу
  adviceLines.forEach((line) => {
    if (yPosition > pageHeight - margin - 10) {
      doc.addPage();
      yPosition = margin;
    }
    doc.setFontSize(10);
    doc.text(line, margin + 5, yPosition);
    yPosition += 5;
  });

  // Юридическое предупреждение
  if (yPosition > pageHeight - margin - 20) {
    doc.addPage();
    yPosition = margin;
  }
  yPosition += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  const disclaimer = '⚠️ Рекомендации носят информационный характер и не заменяют консультацию врача или специалиста.';
  const disclaimerLines = doc.splitTextToSize(disclaimer, maxWidth - 10) as string[];
  disclaimerLines.forEach((line) => {
    doc.text(line, margin + 5, yPosition);
    yPosition += 5;
  });

  // Сохраняем PDF
  const fileName = `Рекомендации_по_питанию_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

/**
 * Генерирует PDF с рекомендациями по тренировкам
 */
export function generateTrainingPDF(advice: string, userData: UserGoalData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Заголовок
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ПЕРСОНАЛЬНЫЕ РЕКОМЕНДАЦИИ ПО ТРЕНИРОВКАМ', margin, yPosition);
  yPosition += 15;

  // Информация о пользователе
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const userInfo = `Пол: ${userData.gender === 'male' ? 'Мужчина' : 'Женщина'} | Возраст: ${userData.age} лет | Вес: ${userData.weight} кг | Рост: ${userData.height} см`;
  doc.text(userInfo, margin, yPosition);
  yPosition += 10;

  // Разбиваем текст совета на части
  const adviceLines = doc.splitTextToSize(advice, maxWidth - 10) as string[];
  
  // Проверяем, нужно ли добавить новую страницу
  adviceLines.forEach((line) => {
    if (yPosition > pageHeight - margin - 10) {
      doc.addPage();
      yPosition = margin;
    }
    doc.setFontSize(10);
    doc.text(line, margin + 5, yPosition);
    yPosition += 5;
  });

  // Юридическое предупреждение
  if (yPosition > pageHeight - margin - 20) {
    doc.addPage();
    yPosition = margin;
  }
  yPosition += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  const disclaimer = '⚠️ Рекомендации носят информационный характер и не заменяют консультацию врача или специалиста.';
  const disclaimerLines = doc.splitTextToSize(disclaimer, maxWidth - 10) as string[];
  disclaimerLines.forEach((line) => {
    doc.text(line, margin + 5, yPosition);
    yPosition += 5;
  });

  // Сохраняем PDF
  const fileName = `Рекомендации_по_тренировкам_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
