
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc, increment, addDoc, collection } from 'firebase/firestore';
import { AppSettings, UserRecord } from '../types';

export const useAccessControl = () => {
  const { currentUser } = useAuth();

  const checkAccess = async (featureName: string): Promise<{ allowed: boolean; reason?: 'subscription' | 'trial_ended' }> => {
    if (!currentUser) return { allowed: false, reason: 'subscription' };

    // 1. Check VIP/Subscription
    if (currentUser.isVIP) {
      await logActivity(currentUser, featureName, 'VIP Access');
      return { allowed: true };
    }

    // 2. Check Subscription Expiry (if not marked VIP but has expiry date)
    if (currentUser.subscriptionExpiry) {
       const expiryDate = currentUser.subscriptionExpiry.toDate ? currentUser.subscriptionExpiry.toDate() : new Date(currentUser.subscriptionExpiry);
       if (expiryDate > new Date()) {
          await logActivity(currentUser, featureName, 'Active Subscription');
          return { allowed: true };
       }
    }

    // 3. Check Free Attempts
    if (currentUser.freeAttempts > 0) {
      try {
        // Decrement free attempts
        const userRef = doc(db, 'users', currentUser.id);
        await updateDoc(userRef, {
          freeAttempts: increment(-1)
        });
        await logActivity(currentUser, featureName, `Free Trial (${currentUser.freeAttempts - 1} remaining)`);
        return { allowed: true };
      } catch (e) {
        console.error("Error updating free attempts:", e);
        // If update fails, we might still allow if we want to be lenient, or block. 
        // Let's block to be safe against abuse.
        return { allowed: false, reason: 'trial_ended' };
      }
    }

    return { allowed: false, reason: 'trial_ended' };
  };

  const logActivity = async (user: UserRecord, feature: string, details: string) => {
    try {
      await addDoc(collection(db, 'activityLogs'), {
        userId: user.id,
        userName: user.name,
        action: 'feature_usage',
        details: `${feature} - ${details}`,
        timestamp: new Date()
      });
    } catch (e) {
      console.error("Logging failed", e);
    }
  };

  return { checkAccess };
};
