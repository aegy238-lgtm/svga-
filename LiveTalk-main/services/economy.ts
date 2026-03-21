import { db } from './firebase';
import { doc, updateDoc, increment, writeBatch, arrayUnion } from 'firebase/firestore';

/**
 * محرك الاقتصاد الموحد - لايف توك (النسخة الاحترافية الموثوقة)
 * تم الربط بشكل عميق مع Firestore لضمان عدم ضياع أي بيانات
 */

export const EconomyEngine = {
  
  // 1. صرف كوينز (هدايا، ألعاب، متجر) مع تحديث الثروة
  spendCoins: async (userId: string, currentCoins: any, currentWealth: any, amount: any, currentOwnedItems: string[], itemId: string | null, updateLocalState: (data: any) => void) => {
    const coins = Number(currentCoins || 0);
    const wealth = Number(currentWealth || 0);
    const cost = Number(amount || 0);

    if (cost <= 0 || coins < cost) {
      console.error("EconomyEngine: الرصيد غير كافٍ");
      return false;
    }
    
    // تحديث محلي سريع لضمان تجربة مستخدم سلسة
    const updateData: any = {
      coins: coins - cost,
      wealth: wealth + cost
    };
    if (itemId && !currentOwnedItems.includes(itemId)) {
      updateData.ownedItems = [...(currentOwnedItems || []), itemId];
    }
    updateLocalState(updateData);

    try {
      const batch = writeBatch(db);
      const userRef = doc(db, 'users', userId);
      
      const remoteUpdate: any = {
        coins: increment(-cost),
        wealth: increment(cost)
      };
      if (itemId) remoteUpdate.ownedItems = arrayUnion(itemId);
      
      batch.update(userRef, remoteUpdate);
      await batch.commit();
      return true;
    } catch (e) {
      console.error("Background Sync Error (Spend):", e);
      return false;
    }
  },

  // 2. شراء رتبة VIP وحفظ الإطار فوراً
  buyVIP: async (userId: string, currentCoins: any, currentWealth: any, vip: any, updateLocalState: (data: any) => void) => {
    const coins = Number(currentCoins || 0);
    const cost = Number(vip.cost || 0);

    if (coins < cost) return false;

    // تحديث محلي فوري لإشعار المستخدم بالنجاح
    const updateData = {
      isVip: true,
      vipLevel: vip.level,
      coins: coins - cost,
      wealth: Number(currentWealth || 0) + cost,
      frame: vip.frameUrl
    };
    updateLocalState(updateData);

    try {
      const userRef = doc(db, 'users', userId);
      // استخدام updateDoc مع increment لضمان دقة الرصيد حتى في حالة ضعف الإنترنت
      await updateDoc(userRef, {
        isVip: true,
        vipLevel: vip.level,
        coins: increment(-cost),
        wealth: increment(cost),
        frame: vip.frameUrl
      });
      return true;
    } catch (e) {
      console.error("Background Sync Error (VIP Purchase):", e);
      return false;
    }
  },

  // 3. تحويل الألماس لكوينز
  exchangeDiamonds: async (userId: string, currentCoins: any, currentDiamonds: any, amount: any, updateLocalState: (data: any) => void) => {
    const cost = Number(amount || 0);
    const diamonds = Number(currentDiamonds || 0);

    if (cost <= 0 || diamonds < cost) return false;
    
    const coinsGained = Math.floor(cost * 0.5);
    updateLocalState({
      coins: Number(currentCoins || 0) + coinsGained,
      diamonds: diamonds - cost
    });

    try {
      await updateDoc(doc(db, 'users', userId), {
        coins: increment(coinsGained),
        diamonds: increment(-cost)
      });
      return true;
    } catch (e) {
      console.error("Background Sync Error (Exchange):", e);
      return false;
    }
  },

  // 4. شحن الوكالات
  agencyTransfer: async (agentId: string, currentAgentBalance: any, targetId: string, currentTargetCoins: any, currentTargetPoints: any, amount: any, updateLocalState: (agentData: any, targetData: any) => void) => {
    const transferAmt = Number(amount || 0);
    const agentBalance = Number(currentAgentBalance || 0);

    if (transferAmt <= 0 || agentBalance < transferAmt) return false;

    updateLocalState(
      { agencyBalance: agentBalance - transferAmt },
      { coins: Number(currentTargetCoins || 0) + transferAmt, rechargePoints: Number(currentTargetPoints || 0) + transferAmt }
    );

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', agentId), { agencyBalance: increment(-transferAmt) });
      batch.update(doc(db, 'users', targetId), { 
        coins: increment(transferAmt), 
        rechargePoints: increment(transferAmt) 
      });
      await batch.commit();
      return true;
    } catch (e) {
      console.error("Background Sync Error (Agency Transfer):", e);
      return false;
    }
  }
};