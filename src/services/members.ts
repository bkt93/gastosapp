import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export async function addMemberFlat(projectId: string, uid: string, role: 'owner' | 'member', joinedAt: any) {
  const flatCol = collection(db, 'projectMembersFlat');
  const id = `${projectId}_${uid}`;
  await setDoc(doc(flatCol, id), { projectId, uid, role, joinedAt });
}

export async function ensureSelfMembership(projectId: string) {
  const me = auth.currentUser;
  if (!me) return;
  const ref = doc(db, 'projects', projectId, 'members', me.uid);
  const snap = await getDoc(ref);

  const patch: any = { uid: me.uid };
  if (!snap.exists() || !snap.data()?.displayName) {
    patch.displayName = me.displayName ?? me.email?.split('@')[0] ?? 'Sin nombre';
  }
  await setDoc(ref, patch, { merge: true });
}
