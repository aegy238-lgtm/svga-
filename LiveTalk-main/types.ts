export enum UserLevel {
  NEW = 'جديد',
  BRONZE = 'برونزي',
  SILVER = 'فضي',
  GOLD = 'ذهبي',
  DIAMOND = 'ماسي',
  VIP = 'VIP'
}

export type ItemType = 'frame' | 'bubble' | 'entry' | 'badge' | 'extra';

export interface StoreItem {
  id: string;
  name: string;
  type: ItemType;
  price: number;
  url: string; // للمقاطع أو الصور الأصلية
  thumbnailUrl?: string; // صورة المعاينة في المتجر
}

// Added VIPPackage interface to fix export errors across the application
export interface VIPPackage {
  id?: string;
  level: number;
  name: string;
  cost: number;
  color: string;
  frameUrl: string;
  nameStyle: string;
}

export interface InventoryItem {
  giftId: string;
  count: number;
  name: string;
  icon: string;
}

export interface CPPartner {
  id: string;
  name: string;
  avatar: string;
  type: 'cp' | 'friend';
  level?: number;
}

export interface HostAgency {
  id: string;
  name: string;
  agentId: string;
  agentName: string;
  createdAt: any;
  totalProduction: number;
}

export interface User {
  id: string;
  customId: any; 
  name: string;
  avatar: string;
  level: UserLevel;
  wealthLevel?: number;
  rechargeLevel?: number;
  rechargePoints?: number;
  frame?: string;
  activeBubble?: string;
  activeEntry?: string; // الدخولية النشطة
  badge?: string;
  achievements?: string[];
  cover?: string;
  coins: any;
  diamonds: any; 
  wealth: any;
  charm: any;
  isVip: boolean;
  vipLevel?: number;
  nameStyle?: string;
  idColor?: string; 
  bio?: string;
  location?: string;
  gender?: 'male' | 'female';
  stats?: {
    likes: number;
    visitors: number;
    following: number;
    followers: number;
  };
  ownedItems?: string[];
  inventory?: InventoryItem[]; 
  isFollowing?: boolean;
  isMuted?: boolean;
  isSpecialId?: boolean;
  isAdmin?: boolean;
  isSystemModerator?: boolean; // مشرف نظام (لوحة التحكم)
  moderatorPermissions?: string[]; // مصفوفة الـ IDs للأقسام المسموحة
  isAgency?: boolean; 
  agencyBalance?: number;
  isHostAgent?: boolean; 
  hostAgencyId?: string; 
  isHost?: boolean; 
  hostProduction?: number; 
  isBanned?: boolean;
  banUntil?: string;
  deviceId?: string; // بصمة الجهاز
  lastIp?: string;   // آخر IP
  seatIndex?: number;
  status?: string;
  activeEmoji?: string; 
  cpPartner?: CPPartner | null;
  friendPartner?: CPPartner | null; 
  loginPassword?: string; 
  email?: string;
  authPassword?: string;
  roomTemplate?: {
    title: string;
    category: string;
    thumbnail: string;
    background: string;
    isLocked: boolean;
    password?: string;
  };
}

export interface BlacklistEntry {
  id: string;
  type: 'device' | 'ip';
  value: string;
  reason?: string;
  bannedUserId: string;
  timestamp: any;
}

export interface LuckyBag {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  roomId: string;
  roomTitle: string;
  totalAmount: number;
  remainingAmount: number;
  recipientsLimit: number;
  claimedBy: string[]; 
  createdAt: any;
  expiresAt: any;
}

export interface GlobalAnnouncement {
  id: string;
  senderName: string;
  recipientName: string;
  giftName: string;
  giftIcon: string;
  roomTitle: string;
  roomId: string;
  type: 'gift' | 'lucky_win' | 'lucky_bag' | 'bomb_drop';
  amount: number;
  timestamp: any;
}

export type GiftAnimationType = 'pop' | 'fly' | 'full-screen' | 'shake' | 'glow' | 'bounce' | 'rotate' | 'slide-up' | 'none';
export type GiftDisplaySize = 'small' | 'medium' | 'large' | 'full' | 'max';

export interface Gift {
  id: string;
  name: string;
  icon: string; 
  catalogIcon?: string; 
  cost: number;
  animationType: GiftAnimationType;
  displaySize?: GiftDisplaySize; 
  duration?: number; 
  isLucky?: boolean;
  category?: 'popular' | 'exclusive' | 'lucky' | 'celebrity' | 'trend';
}

export interface Room {
  id: string;
  title: string;
  category: 'ترفيه' | 'ألعاب' | 'شعر' | 'تعارف';
  hostId: string;
  hostCustomId?: any; 
  listeners: number;
  thumbnail: string;
  speakers: User[];
  background: string;
  isLocked?: boolean;
  password?: string;
  micCount?: number; 
  moderators?: string[]; 
  kickedUsers?: string[]; 
  sessionCoins?: number; 
  lastBombLevel?: number; 
}

export interface LuckyMultiplier {
  label: string;
  value: number;
  chance: number; 
}

export interface GameSettings {
  slotsWinRate: number;
  wheelWinRate: number;
  lionWinRate: number;
  luckyGiftWinRate: number;
  luckyGiftRefundPercent: number;
  luckyXEnabled: boolean;
  luckyMultipliers: LuckyMultiplier[];
  wheelJackpotX: number; 
  wheelNormalX: number;   
  slotsSevenX: number;    
  slotsFruitX: number;    
  availableEmojis?: string[]; 
  emojiDuration?: number;
  wheelChips?: number[];
  slotsChips?: number[];
  lionChips?: number[];
  cpGiftId?: string;
  friendGiftId?: string;
  cpGiftUrl?: string;
  cpGiftPrice?: number;
  friendGiftUrl?: string;
  friendGiftPrice?: number;
}

export interface WheelItem {
  id: string;
  label: string;
  color: string;
  icon: string;
  multiplier: number;
  probability: number;
}

export interface SlotItem {
  id: string;
  icon: string;
  multiplier: number;
}

export type GameType = 'wheel' | 'slots' | 'lion';