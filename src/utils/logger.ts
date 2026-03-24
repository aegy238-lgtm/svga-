import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ActivityLog, UserRecord } from '../types';

export const logActivity = async (
  user: UserRecord,
  action: string,
  details: string,
  exportFormat?: string | any
) => {
  try {
    // Ensure exportFormat is a string or undefined to prevent passing Event objects
    const safeExportFormat = (typeof exportFormat === 'string') ? exportFormat : undefined;

    const log: Omit<ActivityLog, 'id'> = {
      userId: user.id,
      userName: user.name,
      action: action as any,
      details,
      timestamp: Timestamp.now(),
      ...(safeExportFormat ? { exportFormat: safeExportFormat } : {})
    };
    await addDoc(collection(db, 'activityLogs'), log);
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};
