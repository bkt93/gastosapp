// src/services/projects.members.flat.read.ts
import {
    collection, doc, getDoc, getDocs, onSnapshot, query, Unsubscribe, where
} from "firebase/firestore";
import { db } from "../firebase";
import type { ProjectListItem } from "./projects.read";

export function subscribeSharedProjectsByUidFlat(
    uid: string,
    onChange: (items: ProjectListItem[]) => void
): Unsubscribe {
    const q = query(collection(db, "projectMembersFlat"), where("uid", "==", uid));

    // Nos suscribimos al índice plano y por cada fila escuchamos el proyecto
    const projUnsubs = new Map<string, Unsubscribe>();
    const projects = new Map<string, ProjectListItem>();

    const emit = () => onChange(Array.from(projects.values()));

    const unsub = onSnapshot(q, (snap) => {
        const nextIds = new Set<string>();
        snap.forEach(d => {
            const v = d.data() as any;
            if (!v?.projectId) return;
            nextIds.add(v.projectId);
        });

        // limpiar listeners que ya no correspondan
        for (const id of Array.from(projUnsubs.keys())) {
            if (!nextIds.has(id)) {
                projUnsubs.get(id)?.();
                projUnsubs.delete(id);
                projects.delete(id);
            }
        }

        // agregar listeners nuevos
        nextIds.forEach((id) => {
            if (projUnsubs.has(id)) return;
            const u = onSnapshot(doc(db, "projects", id), (ps) => {
                const d = ps.data() as any;
                if (!d || (d.status && d.status !== "active")) {
                    projects.delete(id); emit(); return;
                }
                projects.set(id, {
                    id,
                    name: d.name ?? "Proyecto",
                    currency: d.currency ?? "ARS",
                    role: "member",
                    iconEmoji: d.iconEmoji ?? undefined,
                });
                emit();
            }, (err) => {
                console.log("project doc error(flat):", id, err?.code ?? err);
            });
            projUnsubs.set(id, u);
        });

        emit();
    }, (err) => {
        console.log("flat members error:", err?.code ?? err);
    });

    return () => {
        unsub();
        projUnsubs.forEach(u => { try { u(); } catch { } });
        projUnsubs.clear();
        projects.clear();
    };
}

export async function fetchSharedProjectsOnceFlat(uid: string): Promise<ProjectListItem[]> {
    const q = query(collection(db, "projectMembersFlat"), where("uid", "==", uid));
    const snap = await getDocs(q);
    const rows: ProjectListItem[] = [];
    for (const d of snap.docs) {
        const v = d.data() as any;
        if (!v?.projectId) continue;
        const ps = await getDoc(doc(db, "projects", v.projectId));
        const p = ps.data() as any;
        if (!p || (p.status && p.status !== "active")) continue;
        rows.push({
            id: ps.id,
            name: p.name ?? "Proyecto",
            currency: p.currency ?? "ARS",
            role: "member",
            iconEmoji: p.iconEmoji ?? undefined,
        });
    }
    return rows;
}
