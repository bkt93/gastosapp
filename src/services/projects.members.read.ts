// src/services/projects.members.read.ts
import {
    collectionGroup, doc, getDoc, getDocs, onSnapshot, query, Unsubscribe, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { ProjectListItem } from './projects.read';

export function subscribeSharedProjectsByUid(
    uid: string,
    onChange: (items: ProjectListItem[]) => void
): Unsubscribe {
    const q = query(collectionGroup(db, 'members'), where('uid', '==', uid));

    const projectUnsubs = new Map<string, Unsubscribe>();
    const projects = new Map<string, ProjectListItem>();
    const emit = () => onChange(Array.from(projects.values()));

    const unsubMembers = onSnapshot(
        q,
        (snap) => {
            const nextIds = new Set<string>();
            snap.forEach((d) => {
                const projectRef = d.ref.parent.parent; // projects/{projectId}
                if (projectRef) nextIds.add(projectRef.id);
            });

            // limpiar listeners viejos
            for (const id of Array.from(projectUnsubs.keys())) {
                if (!nextIds.has(id)) {
                    projectUnsubs.get(id)!();
                    projectUnsubs.delete(id);
                    projects.delete(id);
                }
            }

            // agregar listeners nuevos
            nextIds.forEach((id) => {
                if (projectUnsubs.has(id)) return;
                const unsub = onSnapshot(doc(db, 'projects', id), (ps) => {
                    const v = ps.data() as any;
                    if (!v) { projects.delete(id); emit(); return; }
                    projects.set(id, {
                        id,
                        name: v.name ?? 'Proyecto',
                        currency: v.currency ?? 'ARS',
                        role: 'member',
                        iconEmoji: v.iconEmoji ?? undefined,
                    });
                    emit();
                });
                projectUnsubs.set(id, unsub);
            });

            emit();
        },
        (err) => console.log('members CG error:', err)
    );

    return () => {
        unsubMembers();
        projectUnsubs.forEach((u) => u());
    };
}

export async function fetchSharedProjectsOnce(uid: string): Promise<ProjectListItem[]> {
    const qs = await getDocs(query(collectionGroup(db, "members"), where("uid", "==", uid)));
    const rows: ProjectListItem[] = [];
    for (const m of qs.docs) {
        const projRef = m.ref.parent.parent; // /projects/{id}
        if (!projRef) continue;
        const ps = await getDoc(doc(db, "projects", projRef.id));
        const v = ps.data() as any;
        if (!v) continue;
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
