import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { ActivityLog, UserRecord } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (!auth.currentUser) {
    console.warn('Firestore operation failed and user is not authenticated. Skipping error handling.');
    return;
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const logActivity = async (
  user: UserRecord,
  action: string,
  details: string,
  exportFormat?: string | any
) => {
  if (!auth.currentUser) return;
  const path = 'activityLogs';
  try {
    // Ensure exportFormat is a string or undefined to prevent passing Event objects
    const safeExportFormat = (typeof exportFormat === 'string') ? exportFormat : undefined;

    const log: Omit<ActivityLog, 'id'> = {
      userId: auth.currentUser?.uid || user.id,
      userName: user.name,
      action: action as any,
      details,
      timestamp: Timestamp.now(),
      ...(safeExportFormat ? { exportFormat: safeExportFormat } : {})
    };
    await addDoc(collection(db, path), log);
  } catch (error) {
    console.error("Failed to log activity:", error);
    try {
      handleFirestoreError(error, OperationType.CREATE, path);
    } catch (e) {
      // Re-throw or handle as needed
    }
  }
};
