function pluralize(value: number, singular: string, plural: string) {
  return value === 1 ? singular : plural;
}

export function formatRelativeTime(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const diff = Math.max(Date.now() - date.getTime(), 0);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;

  if (diff < minute) {
    return "Agora";
  }

  if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `Há ${minutes} ${pluralize(minutes, "min", "min")}`;
  }

  if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `Há ${hours} ${pluralize(hours, "h", "h")}`;
  }

  if (diff < 2 * day) {
    return "Ontem";
  }

  if (diff < month) {
    const days = Math.floor(diff / day);
    return `Há ${days} ${pluralize(days, "dia", "dias")}`;
  }

  const months = Math.floor(diff / month);
  return `Há ${months} ${pluralize(months, "mês", "meses")}`;
}
