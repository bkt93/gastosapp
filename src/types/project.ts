// src/types/project.ts
import type { Timestamp } from 'firebase/firestore';

export type ProjectStatus = 'active' | 'archived';
export type MemberRole = 'owner' | 'member';
export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface Project {
  id: string;
  ownerUid: string;
  name: string;
  currency: string; // 'ARS' | 'USD' | etc.
  status: ProjectStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  iconEmoji?: string;
}

export interface ProjectMember {
  uid: string;
  role: MemberRole;
  joinedAt: Timestamp;
  displayName?: string | null;
}

export interface Invite {
  id: string;
  projectId: string;
  code: string;       
  createdBy: string;  
  status: InviteStatus;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  acceptedBy?: string | null;
  acceptedAt?: Timestamp | null;
}
