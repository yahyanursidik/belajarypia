export function validDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export function wibDateKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return validDateKey(value) ? value : "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}
export function inWibDateRange(value: string, from: string, to: string) {
  if (!from && !to) return true;
  const date = wibDateKey(value);
  return !!date && (!from || date >= from) && (!to || date <= to);
}
