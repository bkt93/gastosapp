// src/services/projects.members.read.debug.ts
import { collectionGroup, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
export async function debugLogMembersCG(uid: string) {
  const q = query(collectionGroup(db, 'members'), where('uid', '==', uid));
  const snap = await getDocs(q);
  console.log('members CG count:', snap.size, snap.docs.map(d => d.ref.path));
}
