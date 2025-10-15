// src/services/projects.members.read.ts
import {
    collectionGroup,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    Unsubscribe,
    where,
} from "firebase/firestore";
import { db } from "../firebase";
import type { ProjectListItem } from "./projects.read";

const MEMBERS_CG = "members";
const FIELD_UID = "uid";

export function subscribeSharedProjectsByUid(
    uid: string,
    onChange: (items: ProjectListItem[]) => void
): Unsubscribe {
    // 👇 CG por uid (importante: que el doc members tenga el campo { uid })
    const q = query(collectionGroup(db, MEMBERS_CG), where(FIELD_UID, "==", uid));

    const projectUnsubs = new Map<string, Unsubscribe>();
    const projects = new Map<string, ProjectListItem>();
    let primed = false; // evita emitir vacío al primer tick

    const emit = () => onChange(Array.from(projects.values()));

    const unsubMembers = onSnapshot(
        q,
        (snap) => {
            const nextIds = new Set<string>();
            snap.forEach((d) => {
                const projectRef = d.ref.parent.parent; // .../projects/{projectId}
                if (projectRef) nextIds.add(projectRef.id);
            });

            // limpiar listeners que ya no correspondan
            for (const id of Array.from(projectUnsubs.keys())) {
                if (!nextIds.has(id)) {
                    try {
                        projectUnsubs.get(id)?.();
                    } catch (_) { }
                    projectUnsubs.delete(id);
                    projects.delete(id);
                }
            }

            // agregar listeners nuevos
            nextIds.forEach((id) => {
                if (projectUnsubs.has(id)) return;

                const unsub = onSnapshot(
                    doc(db, "projects", id),
                    (ps) => {
                        const v = ps.data() as any;
                        if (!v) {
                            // miembro existe pero el proyecto no (borrado/permiso)
                            projects.delete(id);
                            if (primed) emit();
                            return;
                        }
                        // (opcional) filtrar por estado
                        if (v.status && v.status !== "active") {
                            projects.delete(id);
                            if (primed) emit();
                            return;
                        }
                        projects.set(id, {
                            id,
                            name: v.name ?? "Proyecto",
                            currency: v.currency ?? "ARS",
                            role: "member",
                            iconEmoji: v.iconEmoji ?? undefined,
                        });
                        if (primed) emit();
                    },
                    (err) => {
                        console.log("projects doc error:", id, err?.code ?? err);
                    }
                );

                projectUnsubs.set(id, unsub);
            });

            primed = true;
            emit();
        },
        (err) => {
            console.log("members CG error:", err?.code ?? err);
        }
    );

    return () => {
        unsubMembers();
        projectUnsubs.forEach((u) => {
            try {
                u();
            } catch (_) { }
        });
        projectUnsubs.clear();
        projects.clear();
    };
}

export async function fetchSharedProjectsOnce(uid: string): Promise<ProjectListItem[]> {
    const qs = await getDocs(query(collectionGroup(db, MEMBERS_CG), where(FIELD_UID, "==", uid)));
    const rows: ProjectListItem[] = [];

    for (const m of qs.docs) {
        const projRef = m.ref.parent.parent; // /projects/{id}
        if (!projRef) continue;
        const ps = await getDoc(doc(db, "projects", projRef.id));
        const v = ps.data() as any;
        if (!v) continue;
        if (v.status && v.status !== "active") continue; // (opcional) solo activos
        rows.push({
            id: ps.id,
            name: v.name ?? "Proyecto",
            currency: v.currency ?? "ARS",
            role: "member",
            iconEmoji: v.iconEmoji ?? undefined,
        });
    }
    return rows;
}
