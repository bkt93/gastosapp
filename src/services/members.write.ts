// src/services/members.write.ts
import { collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

/**
 * Auto-repair: asegura que exista /projects/{pid}/members/{uid} con uid correcto
 * y escribe/actualiza el índice plano projectMembersFlat (projectId_uid).
 */
export async function ensureSelfMembership(projectId: string) {
    const me = auth.currentUser;
    if (!me) return;

    const ref = doc(db, "projects", projectId, "members", me.uid);
    const snap = await getDoc(ref);

    // 1) Reparar/crear membresía "oficial" (subcolección members)
    const patch: any = { uid: me.uid };
    if (!snap.exists() || !snap.data()?.displayName) {
        patch.displayName = me.displayName ?? me.email?.split("@")[0] ?? "Sin nombre";
    }
    if (!snap.exists() || !snap.data()?.joinedAt) {
        patch.joinedAt = serverTimestamp();
    }
    if (!snap.exists() || !snap.data()?.role) {
        patch.role = "member";
    }

    await setDoc(ref, patch, { merge: true });

    // 2) Índice plano para listar proyectos compartidos en Home
    await setDoc(
        doc(collection(db, "projectMembersFlat"), `${projectId}_${me.uid}`),
        {
            projectId,
            uid: me.uid,
            role: "member",
            joinedAt: snap.exists() ? snap.data()?.joinedAt ?? serverTimestamp() : serverTimestamp(),
        },
        { merge: true }
    );
}
