// src/services/expenses.ts
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import type { Expense, ExpenseInput } from "../models";
import { toYearMonth } from "../utils/date";

// 🔁 mapea un doc Firestore -> Expense (sin projectId en el documento)
function mapFromFirestore(id: string, data: any): Expense {
  return {
    id,
    title: data.title,
    category: data.category,
    amountCents: data.amountCents,
    paidByUid: data.paidByUid,
    paidByName: data.paidByName,
    date: data.date?.toDate?.() ?? new Date(data.date),
    yearMonth: data.yearMonth,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    createdByUid: data.createdByUid,
    updatedAt: data.updatedAt?.toDate?.(),
    updatedByUid: data.updatedByUid,
  };
}

/** Crea un gasto dentro de `projects/{projectId}/expenses` */
export async function createExpense(projectId: string, input: ExpenseInput) {
  const user = auth.currentUser;
  if (!user) throw new Error("No auth user");

  const yearMonth = toYearMonth(input.date);

  // ⚠️ NO enviar projectId en el documento (las reglas no lo esperan)
  await addDoc(collection(db, "projects", projectId, "expenses"), {
    ...input,
    date: Timestamp.fromDate(input.date),
    yearMonth,
    createdAt: serverTimestamp(),
    createdByUid: user.uid,
  });
}

/** Actualiza un gasto de `projects/{projectId}/expenses/{id}` */
export async function updateExpense(
  projectId: string,
  id: string,
  patch: Partial<ExpenseInput>
) {
  const user = auth.currentUser;
  if (!user) throw new Error("No auth user");

  const ref = doc(db, "projects", projectId, "expenses", id);
  const update: any = { ...patch, updatedAt: serverTimestamp(), updatedByUid: user.uid };
  if (patch.date) {
    update.date = Timestamp.fromDate(patch.date);
    update.yearMonth = toYearMonth(patch.date);
  }
  await updateDoc(ref, update);
}

/** Elimina un gasto de `projects/{projectId}/expenses/{id}` */
export async function deleteExpense(projectId: string, id: string) {
  await deleteDoc(doc(db, "projects", projectId, "expenses", id));
}

/** Suscripción a gastos del mes (por `yearMonth`) dentro del proyecto */
export function listenMonthExpenses(
  projectId: string,
  yearMonth: string,
  onChange: (items: Expense[]) => void,
  onError?: (e: any) => void
) {
  const q = query(
    collection(db, "projects", projectId, "expenses"),
    where("yearMonth", "==", yearMonth),
    orderBy("date", "desc")
  );

  const unsub = onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => mapFromFirestore(d.id, d.data()));
      onChange(items);
    },
    (err) => onError?.(err)
  );
  return unsub;
}
