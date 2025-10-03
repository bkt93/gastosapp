// src/constants/categories.ts
export const CATEGORIES = [
"Alimentos",
"Hogar",
"Servicios",
"Transporte",
"Salud",
"Mascotas",
"Educación",
"Ocio",
"Varios",
] as const;
export type Category = typeof CATEGORIES[number];