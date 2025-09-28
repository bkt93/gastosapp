import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export async function addMemberFlat(projectId: string, uid: string, role: 'owner' | 'member', joinedAt: any) {
  const flatCol = collection(db, 'projectMembersFlat');
  const id = `${projectId}_${uid}`;
  await setDoc(doc(flatCol, id), { projectId, uid, role, joinedAt });
}

export async function ensureSelfMembershipUid(projectId: string) {
  const me = auth.currentUser?.uid;
  if (!me) return;
  const ref = doc(db, 'projects', projectId, 'members', me);
  const snap = await getDoc(ref);
  if (snap.exists() && !snap.data()?.uid) {
    await setDoc(ref, { uid: me }, { merge: true });
  }
}
