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
    "Otros",
] as const;

export type Category = typeof CATEGORIES[number];

export const CATEGORY_OPTIONS = [
    { key: "Alimentos", emoji: "🍽️" },
    { key: "Hogar", emoji: "🏠" },
    { key: "Servicios", emoji: "🧾" },
    { key: "Transporte", emoji: "🚌" },
    { key: "Salud", emoji: "🩺" },
    { key: "Mascotas", emoji: "🐾" },
    { key: "Educación", emoji: "🎓" },
    { key: "Ocio", emoji: "🎉" },
    { key: "Otros", emoji: "🧩" },
] as const satisfies ReadonlyArray<{ key: Category; emoji: string }>;

export function getCategoryEmoji(cat: Category): string {
    const found = CATEGORY_OPTIONS.find(o => o.key === cat);
    return found?.emoji ?? "🧩";
}
