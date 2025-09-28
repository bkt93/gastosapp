import { collection, onSnapshot, orderBy, query, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';

export type ProjectMember = {
    uid: string;
    role: 'owner' | 'member';
    joinedAt?: Date | null;
};

export function subscribeProjectMembers(
    projectId: string,
    onChange: (rows: ProjectMember[]) => void
): Unsubscribe {
    const q = query(
        collection(db, 'projects', projectId, 'members'),
        orderBy('joinedAt', 'asc')
    );
    return onSnapshot(q, (snap) => {
        const rows: ProjectMember[] = snap.docs.map((d) => {
            const v = d.data() as any;
            return {
                uid: d.id,
                role: (v.role as 'owner' | 'member') ?? 'member',
                joinedAt: typeof v.joinedAt?.toDate === 'function' ? v.joinedAt.toDate() : null,
            };
        });
        onChange(rows);
    });
}
