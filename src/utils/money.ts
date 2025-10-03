// src/utils/money.ts
export function toCents(value: string | number): number {
const n = typeof value === "number" ? value : Number(
String(value).replace(/[^0-9.,-]/g, "").replace(",", ".")
);
if (isNaN(n)) return 0;
return Math.round(n * 100);
}


export function formatARS(cents: number): string {
const amount = (cents / 100).toFixed(2);
const [intPart, dec] = amount.split(".");
const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
return `ARS ${withThousands},${dec}`;
}