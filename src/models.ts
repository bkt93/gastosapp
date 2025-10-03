// src/models.ts
import type { Category } from "../constants/categories";

// Campos que el usuario carga en el formulario (los que se envían en create/update)
export type ExpenseInput = {
  title: string;
  category: Category;
  amountCents: number;
  paidByUid: string;
  paidByName: string;
  date: Date;
};

// Documento completo leído desde Firestore (subcolección projects/{projectId}/expenses)
export type Expense = ExpenseInput & {
  id: string;
  yearMonth: string;       // YYYY-MM (derivado de date)
  createdAt: Date;
  createdByUid: string;
  updatedAt?: Date;
  updatedByUid?: string;
};
