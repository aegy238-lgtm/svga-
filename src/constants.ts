import { StoreProduct } from './types';

export const MOCK_PRODUCTS: StoreProduct[] = [
  {
    id: 'prod_1',
    name: 'Quantum Intro',
    description: 'A futuristic intro animation.',
    price: 50,
    category: 'Intros',
    imageUrl: 'https://picsum.photos/seed/quantum/800/450',
    videoUrl: '',
    supportedFormats: ['MP4', 'WEBM'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'prod_2',
    name: 'Neon Lower Third',
    description: 'Stylish lower third for streamers.',
    price: 30,
    category: 'Overlays',
    imageUrl: 'https://picsum.photos/seed/neon/800/450',
    videoUrl: '',
    supportedFormats: ['MOV', 'WEBM'],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];
