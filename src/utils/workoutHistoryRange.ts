export function getDefaultWorkoutHistoryRange(today = new Date()): { from: string; to: string } {
  const to = formatDate(today);
  const fromDate = new Date(today);
  fromDate.setFullYear(fromDate.getFullYear() - 1);
  return {
    from: formatDate(fromDate),
    to,
  };
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
