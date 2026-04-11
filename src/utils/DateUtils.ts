// ============================================================
// utils/DateUtils.ts
// Pure date helper functions — no side effects
// ============================================================

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export function today(): string {
  return toDateString(new Date());
}

export function parseDate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

export function addDays(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateString(d);
}


export function currentWeekDates(): string[] {
  return weekDates(0);
}


export function weekDates(offsetWeeks: number): string[] {
  const now = new Date();
  const day = now.getDay() === 0 ? 7 : now.getDay(); // Mon=1
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1 + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toDateString(d);
  });
}


export function formatWeekday(iso: string): string {
  return parseDate(iso).toLocaleDateString("de-AT", { weekday: "short" });
}


export function currentMonthDates(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return toDateString(d);
  });
}

/** Last N days including today */
export function lastNDays(n: number): string[] {
  const result: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    result.push(addDays(today(), -i));
  }
  return result;
}

export function formatDisplay(iso: string): string {
  return parseDate(iso).toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatShort(iso: string): string {
  return parseDate(iso).toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "short",
  });
}
