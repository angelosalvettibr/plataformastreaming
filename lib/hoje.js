// Data/hora oficial do sistema: horário de Brasília (America/Sao_Paulo)
export function agoraBR() {
  const d = new Date();
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const g = (t) => p.find((x) => x.type === t).value;
  return { iso: `${g("year")}-${g("month")}-${g("day")}`, hora: `${g("hour")}:${g("minute")}`, dia: +g("day"), mes: `${g("year")}-${g("month")}` };
}
export function hojeISO() { return agoraBR().iso; }
