// src/services/accept-invite.ts
import {
    doc,
    getDoc,
    serverTimestamp,
    updateDoc,
    writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

export async function acceptInviteByCode(codeRaw: string): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const code = codeRaw.trim().toUpperCase();
    if (!code) throw new Error('Código inválido');

    // 1) Leer la invitación (permitido por rules si está pending y no vencida)
    const invRef = doc(db, 'invites', code);
    const invSnap = await getDoc(invRef);
    if (!invSnap.exists()) throw new Error('La invitación no existe');

    const inv = invSnap.data() as any;
    if (inv.status !== 'pending') throw new Error('La invitación ya fue utilizada o revocada');

    const expiresAt: Date =
        typeof inv.expiresAt?.toDate === 'function' ? inv.expiresAt.toDate() : new Date(inv.expiresAt);
    if (expiresAt.getTime() <= Date.now()) throw new Error('La invitación está vencida');

    const projectId = inv.projectId as string;
    if (!projectId) throw new Error('Invitación inválida (sin proyecto)');

    const memberRef = doc(db, 'projects', projectId, 'members', user.uid);

    // 2) Intento principal: crear membresía + marcar invitación aceptada (un único batch)
    try {
        const batch = writeBatch(db);
        // create (si existe, esto sería "update" y las rules lo van a bloquear)
        batch.set(memberRef, {
            role: 'member',
            uid: user.uid,            // 👈 agregar
            joinedAt: serverTimestamp(),
            displayName:
                auth.currentUser!.displayName ??
                auth.currentUser!.email?.split("@")[0] ??
                "Sin nombre",
        });
        batch.update(invRef, {
            status: 'accepted',
            acceptedBy: user.uid,
            acceptedAt: serverTimestamp(),
        });
        await batch.commit();
        return projectId;
    } catch (err) {
        // 3) Fallback: si no pudimos tocar "members" (p.ej. ya existía o rules), al menos marcamos la invitación como aceptada
        //    (las rules permiten este update si seguía pending y no vencida)
        try {
            await updateDoc(invRef, {
                status: 'accepted',
                acceptedBy: user.uid,
                acceptedAt: serverTimestamp(),
            });
            return projectId;
        } catch (err2: any) {
            // Propagamos el error real si tampoco pudimos actualizar la invitación
            throw err2;
        }
    }
}
