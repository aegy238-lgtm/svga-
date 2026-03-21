
import { Gift, VIPPackage, StoreItem, WheelItem, SlotItem } from './types';

// قيم افتراضية أولية للمتجر - سيتم تحديثها من قاعدة البيانات
export const DEFAULT_STORE_ITEMS: StoreItem[] = [
  { id: 'f_neon', name: 'إطار نيون', type: 'frame', price: 500, url: 'https://cdn-icons-png.flaticon.com/512/4325/4325969.png' },
  { id: 'f_fire', name: 'إطار ناري', type: 'frame', price: 1200, url: 'https://cdn-icons-png.flaticon.com/512/9446/9446696.png' },
  { id: 'b_blue', name: 'فقاعة زرقاء', type: 'bubble', price: 200, url: 'https://img.freepik.com/free-vector/gradient-blue-background_23-2149332560.jpg' },
];

export const WHEEL_ITEMS: WheelItem[] = [
  { id: 'watermelon', label: 'بطيخ', color: '#10b981', icon: '🍉', multiplier: 2, probability: 45 },
  { id: 'grape', label: 'برقوق', color: '#8b5cf6', icon: '🍇', multiplier: 2, probability: 45 },
  { id: '777', label: 'Jackpot', color: '#f59e0b', icon: '💎', multiplier: 8, probability: 10 },
  { id: 'apple', label: 'تفاح', color: '#ef4444', icon: '🍎', multiplier: 5, probability: 20 },
];

export const SLOT_ITEMS: SlotItem[] = [
   { id: 'cherry', icon: '🍒', multiplier: 2 },
   { id: 'lemon', icon: '🍋', multiplier: 3 },
   { id: 'diamond', icon: '💎', multiplier: 10 },
   { id: 'seven', icon: '7️⃣', multiplier: 20 },
];

export const DEFAULT_VIP_LEVELS: VIPPackage[] = [
  { level: 1, name: 'فارس', cost: 1000, color: 'text-slate-300', frameUrl: 'https://cdn-icons-png.flaticon.com/512/763/763328.png', nameStyle: 'text-slate-200 font-bold' },
  { level: 5, name: 'ماركيز', cost: 20000, color: 'text-purple-400', frameUrl: 'https://cdn-icons-png.flaticon.com/512/5407/5407986.png', nameStyle: 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 font-bold' },
  { level: 10, name: 'أسطورة', cost: 600000, color: 'text-amber-400', frameUrl: 'https://cdn-icons-png.flaticon.com/512/2618/2618413.png', nameStyle: 'text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 font-black animate-[pulse_2s_infinite]' },
  { level: 12, name: 'إلهي', cost: 2500000, color: 'text-white', frameUrl: 'https://cdn-icons-png.flaticon.com/512/2165/2165039.png', nameStyle: 'text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 font-black' },
];

export const DEFAULT_GIFTS: Gift[] = [
  { id: '1', name: 'وردة', icon: '🌹', cost: 10, animationType: 'pop', category: 'popular' },
  { id: '5', name: 'تنين', icon: '🐉', cost: 5000, animationType: 'full-screen', category: 'exclusive' },
  { id: 'lucky_1', name: 'صندوق الحظ', icon: '🎁', cost: 500, animationType: 'pop', isLucky: true, category: 'lucky' },
  { id: 'star_1', name: 'نجم مشهور', icon: '⭐', cost: 1000, animationType: 'fly', category: 'celebrity' },
  { id: 'fire_1', name: 'ترند نار', icon: '🔥', cost: 2500, animationType: 'full-screen', category: 'trend' },
];
