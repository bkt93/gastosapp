import {
    collection, deleteDoc, doc, getDoc,
    onSnapshot, query, serverTimestamp, setDoc, where
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { genCode } from '../utils/code';

export type PendingInvite = {
    id: string;
    code: string;
    expiresAt: Date;   // mapeamos a Date para UI
};

export async function generateInvite(projectId: string, ttlDays = 7): Promise<PendingInvite> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    // guard UX (opcional pero útil)
    const proj = await getDoc(doc(db, 'projects', projectId));
    if (!proj.exists()) throw new Error('Proyecto no encontrado');
    if (proj.data()?.ownerUid !== user.uid) {
        throw new Error('Solo el owner puede generar invitaciones');
    }

    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    // Intentar hasta 5 códigos distintos
    for (let i = 0; i < 5; i++) {
        const code = genCode(6);
        const ref = doc(db, 'invites', code); // 👈 usamos el código como ID del doc

        try {
            await setDoc(ref, {
                projectId,
                code,                    // redundante pero práctico
                createdBy: user.uid,
                status: 'pending',
                createdAt: serverTimestamp(),
                expiresAt,               // Timestamp en Firestore
                acceptedBy: null,
                acceptedAt: null,
            }, { merge: false });      // create si no existe; si existe sería update y las rules lo rechazan

            return { id: code, code, expiresAt }; // id == code
        } catch (e: any) {
            // Si chocamos con un código existente, las rules de "update" lo van a bloquear (permission-denied).
            // Reintentamos con otro code.
            if (i === 4) throw new Error('No se pudo generar un código único. Probá de nuevo.');
        }
    }

    throw new Error('No se pudo generar el código. Intentá otra vez.');
}
export function subscribePendingInvites(
    projectId: string,
    onChange: (rows: PendingInvite[]) => void
) {
    const q = query(
        collection(db, 'invites'),
        where('projectId', '==', projectId),
        where('status', '==', 'pending')
    );

    return onSnapshot(q, (snap) => {
        const rows = snap.docs.map((d) => {
            const v = d.data() as any;
            const when: Date =
                typeof v.expiresAt?.toDate === 'function' ? v.expiresAt.toDate() : new Date(v.expiresAt);
            return { id: d.id, code: v.code, expiresAt: when } as PendingInvite;
        });
        onChange(rows);
    });
}

export async function revokeInvite(inviteId: string) {
    await deleteDoc(doc(db, 'invites', inviteId)); // reglas: owner/creator puede borrar
}
