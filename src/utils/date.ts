// src/utils/date.ts
export function toYearMonth(d: Date): string {
const y = d.getFullYear();
const m = (d.getMonth() + 1).toString().padStart(2, "0");
return `${y}-${m}`;
}


export function addMonths(d: Date, diff: number): Date {
const nd = new Date(d);
nd.setMonth(nd.getMonth() + diff);
return nd;
}