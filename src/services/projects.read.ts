// src/services/projects.read.ts
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export type ProjectListItem = {
  id: string;
  name: string;
  currency: string;
  role: 'owner' | 'member';     
};

export function subscribeOwnedProjectsByUid(
  uid: string,
  onChange: (items: ProjectListItem[]) => void
) {
  const q = query(collection(db, 'projects'), where('ownerUid', '==', uid));

  return onSnapshot(
    q,
    (snap) => {
      const data: ProjectListItem[] = snap.docs.map((d) => {
        const v = d.data() as any;
        return {
          id: d.id,
          name: v.name ?? 'Proyecto',
          currency: v.currency ?? 'ARS',
          role: 'owner',                        // <- agregar
        };
      });
      onChange(data);
    },
    (err) => console.log('onSnapshot error (projects):', err)
  );
}

export async function fetchOwnedProjectsOnce(uid: string): Promise<ProjectListItem[]> {
  const q = query(collection(db, 'projects'), where('ownerUid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const v = d.data() as any;
    return {
      id: d.id,
      name: v.name ?? 'Proyecto',
      currency: v.currency ?? 'ARS',
      role: 'owner',                            // <- agregar
    } as ProjectListItem;
  });
}
