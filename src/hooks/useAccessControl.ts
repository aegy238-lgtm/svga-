
import { UserRecord } from '../types';

export const useAccessControl = () => {
  const checkAccess = async (featureName: string): Promise<{ allowed: boolean; reason?: 'subscription' | 'trial_ended' }> => {
    return { allowed: true };
  };

  const logActivity = async (user: UserRecord, feature: string, details: string) => {
    // No-op or console log
    console.log(`Activity: ${feature} - ${details}`);
  };

  return { checkAccess, logActivity };
};
