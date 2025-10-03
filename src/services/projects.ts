// src/services/projects.ts
import { collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';

export async function createProject(name: string, currency = 'ARS') {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const now = serverTimestamp();
    const batch = writeBatch(db);

    const projectRef = doc(collection(db, 'projects'));
    batch.set(projectRef, {
        ownerUid: user.uid,
        name,
        currency,
        status: 'active',
        createdAt: now,
        updatedAt: now,
    });

    const memberRef = doc(db, 'projects', projectRef.id, 'members', user.uid);
    batch.set(memberRef, {
        role: 'owner',
        uid: user.uid,
        joinedAt: now,
        displayName:
            auth.currentUser!.displayName ??
            auth.currentUser!.email?.split("@")[0] ??
            "Sin nombre",
    });

    await batch.commit();
    return projectRef.id;
}

export async function updateProject(projectId: string, data: { name?: string; currency?: string; status?: 'active' | 'archived' }) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const patch: any = { updatedAt: serverTimestamp() };
    if (data.name) patch.name = data.name;
    if (data.currency) patch.currency = data.currency;
    if (data.status) patch.status = data.status;

    await updateDoc(doc(db, 'projects', projectId), patch);
}

export async function deleteProjectDeep(projectId: string) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    // 1) Intentar borrar MEMBERS en páginas
    try {
        // leer y borrar en lotes, puede lanzar si no hay permiso
        while (true) {
            const snap = await getDocs(query(collection(db, 'projects', projectId, 'members'), limit(300)));
            if (snap.empty) break;
            const batch = writeBatch(db);
            snap.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
    } catch (err) {
        console.log('skip members cleanup:', err);
        // seguimos igual, el owner podrá borrar el proyecto igualmente
    }

    // 2) Intentar borrar INVITES del proyecto en páginas
    try {
        while (true) {
            const snap = await getDocs(query(collection(db, 'invites'), where('projectId', '==', projectId), limit(300)));
            if (snap.empty) break;
            const batch = writeBatch(db);
            snap.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
    } catch (err) {
        console.log('skip invites cleanup:', err);
    }

    // 3) Borrar el PROJECT doc (owner-only en rules)
    await deleteDoc(doc(db, 'projects', projectId));
}