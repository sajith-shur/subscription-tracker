import { differenceInDays, parseISO, startOfDay } from 'date-fns';

/**
 * Calculates days remaining until a given date from today.
 * Returns negative value if the date has passed.
 */
export const getDaysLeft = (dateString: string): number => {
  const today = startOfDay(new Date());
  const targetDate = startOfDay(parseISO(dateString));
  return differenceInDays(targetDate, today);
};

/**
 * Formats the days left into a human-readable string.
 */
export const formatDaysLeft = (daysLeft: number): string => {
  if (daysLeft === 0) return 'Due Today';
  if (daysLeft === 1) return 'Tomorrow';
  if (daysLeft > 1) return `${daysLeft} days left`;
  if (daysLeft === -1) return 'Expired yesterday';
  return `Expired ${Math.abs(daysLeft)} days ago`;
};

/**
 * Returns a color class based on the days left.
 */
export const getDaysLeftColorClass = (daysLeft: number): string => {
  if (daysLeft <= 0) return 'text-red-600 bg-red-50';
  if (daysLeft <= 7) return 'text-amber-600 bg-amber-50';
  return 'text-emerald-600 bg-emerald-50';
};
