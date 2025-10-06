import {
    addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query,
    serverTimestamp,
    updateDoc, where, writeBatch
} from "firebase/firestore";
import { db } from "../firebase";
import { toYearMonth } from "../utils/date";

export type ServiceInput = {
    type: 'Luz' | 'Gas' | 'Agua' | 'Cuota IPV' | 'Resumen tarjeta' | 'custom';
    title: string;
    amountCents: number;
    dueDate: Date;
    description?: string;
    createdByUid: string;
    createdByName: string;
    assignedToUid?: string;
    assignedToName?: string;
};

export type Service = ServiceInput & {
    id: string;
    status: 'pending' | 'paid';
    paidAt?: Date;
    paidByUid?: string;
    paidByName?: string;
    linkedExpenseId?: string;
    createdAt: Date;
    updatedAt: Date;
};

function colRef(projectId: string) {
    return collection(db, "projects", projectId, "services");
}

function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) out[k] = v;
    }
    return out;
}

export async function createService(projectId: string, input: ServiceInput) {
    const now = serverTimestamp();
    const ref = await addDoc(colRef(projectId), stripUndefined({
        ...input,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
    }));
    return ref.id;
}

export async function updateService(projectId: string, id: string, patch: Partial<ServiceInput>) {
    const ref = doc(db, "projects", projectId, "services", id);
    await updateDoc(ref, stripUndefined({ ...patch, updatedAt: serverTimestamp() }));
}

export async function deleteService(projectId: string, id: string) {
    const ref = doc(db, "projects", projectId, "services", id);
    await deleteDoc(ref);
}

export function listenPendingServices(
    projectId: string,
    onChange: (items: Service[]) => void,
    onError?: (e: any) => void
) {
    const q = query(colRef(projectId), where('status', '==', 'pending'), orderBy('dueDate', 'asc'));
    return onSnapshot(q, (snap) => {
        const out: Service[] = [];
        snap.forEach(docu => {
            const d = docu.data() as any;
            out.push({
                id: docu.id,
                ...d,
                dueDate: d.dueDate?.toDate?.() ?? new Date(d.dueDate),
                createdAt: d.createdAt?.toDate?.() ?? new Date(),
                updatedAt: d.updatedAt?.toDate?.() ?? new Date(),
            });
        });
        onChange(out);
    }, onError);
}

/**
 * Marca un servicio como pagado y crea el gasto vinculado en un batch atómico.
 */
export async function markServiceAsPaid(projectId: string, serviceId: string, opts: {
    paidAt: Date;
    paidByUid: string;
    paidByName: string;
    createdByUid: string; // el que ejecuta la acción (para expense.createdByUid)
}) {
    const serviceRef = doc(db, "projects", projectId, "services", serviceId);
    const snap = await getDoc(serviceRef);
    if (!snap.exists()) throw new Error("Servicio no encontrado");
    const s: any = snap.data();

    const batch = writeBatch(db);

    // Crear gasto
    const expensesRef = collection(db, "projects", projectId, "expenses");
    const expenseDoc = doc(expensesRef); // generar ID para linkear
    const title = s.title || s.type || "Servicio";
    const yearMonth = toYearMonth(opts.paidAt);

    batch.set(expenseDoc, {
        title,
        category: 'Servicios',
        amountCents: s.amountCents,
        paidByUid: opts.paidByUid,
        paidByName: opts.paidByName,
        date: opts.paidAt,
        yearMonth,
        createdAt: serverTimestamp(),
        createdByUid: opts.createdByUid,
    });

    // Actualizar servicio a 'paid'
    batch.update(serviceRef, {
        status: 'paid',
        paidAt: opts.paidAt,
        paidByUid: opts.paidByUid,
        paidByName: opts.paidByName,
        linkedExpenseId: expenseDoc.id,
        updatedAt: serverTimestamp(),
    });

    await batch.commit();

    return expenseDoc.id;
}
