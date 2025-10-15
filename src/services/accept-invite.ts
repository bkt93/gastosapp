// src/services/accept-invite.ts
import {
    collection,
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    updateDoc
} from "firebase/firestore";
import { auth, db } from "../firebase";

export async function acceptInviteByCode(codeRaw: string): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");

    const code = codeRaw.trim().toUpperCase();
    if (!code) throw new Error("Código inválido");

    // 1) Leer invitación (permitido si está pending y no vencida)
    const invRef = doc(db, "invites", code);
    const invSnap = await getDoc(invRef);
    if (!invSnap.exists()) throw new Error("La invitación no existe");

    const inv = invSnap.data() as any;
    if (inv.status !== "pending") throw new Error("La invitación ya fue usada o revocada");

    const expiresAt: Date =
        typeof inv.expiresAt?.toDate === "function" ? inv.expiresAt.toDate() : new Date(inv.expiresAt);
    if (expiresAt.getTime() <= Date.now()) throw new Error("La invitación está vencida");

    const projectId = inv.projectId as string;
    if (!projectId) throw new Error("Invitación inválida (sin proyecto)");

    const memberRef = doc(db, "projects", projectId, "members", user.uid);

    // 2) Crear membresía SOLO si no existe (reglas permiten create pero NO update)
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) {
        try {
            await setDoc(memberRef, {
                role: "member",
                uid: user.uid, // 👈 requerido por rules
                joinedAt: serverTimestamp(),
                displayName:
                    user.displayName ??
                    user.email?.split("@")[0] ??
                    "Sin nombre",
            }, { merge: false }); // si existiera, sería update y rules lo niegan
        } catch (e: any) {
            console.log("members create error:", e?.code ?? e);
            // Si falló por permisos, mejor abortar aquí (no marcamos invite como aceptada)
            throw e;
        }
    } // si existe, seguimos sin tocarlo (update prohibido por rules)

    // 3) Marcar la invitación como aceptada (rules lo permiten si seguía pending y no vencida)
    try {
        await updateDoc(invRef, {
            status: "accepted",
            acceptedBy: user.uid,
            acceptedAt: serverTimestamp(),
        });
    } catch (e: any) {
        console.log("invite update error:", e?.code ?? e);
        // Si esto falla, dejamos la membresía creada; informamos el error igual
        throw e;
    }

    // 4) Índice plano para Home (rules: create si uid == userId)
    try {
        await setDoc(
            doc(collection(db, "projectMembersFlat"), `${projectId}_${user.uid}`),
            {
                projectId,
                uid: user.uid,
                role: "member",
                joinedAt: serverTimestamp(),
            },
            { merge: true }
        );
    } catch (e: any) {
        console.log("flat set error:", e?.code ?? e);
        // no interrumpimos el flujo por esto; el Home RT igual va a aparecer por /projects
    }

    return projectId;
}
