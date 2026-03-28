import { Timestamp } from "firebase/firestore";
import { z } from 'zod';

export type ProductVariant = {
  sku: string; // Unique identifier for the variant, e.g., 'prod-potatoes-1kg'
  weight: string; // e.g., '500gm', '1kg', '2kg'
  price: number;
  stock: number; // The available quantity
};

export type Product = {
  id: string;
  name: string; // Base name, e.g., 'Potatoes'
  description: string;
  variants?: ProductVariant[]; 
  imageId: string;
  storeId: string;
  category?: string;
  imageUrl?: string;
  imageHint?: string;
  matchedAlias?: boolean;
  isMenuItem?: boolean;
  price?: number;
};

export type CanonicalProduct = {
  id: string;
  name: string;
  category: string;
  imageUrl?: string;
  description?: string;
};

export type MenuTheme = {
    backgroundColor: string;
    primaryColor: string;
    textColor: string;
};

export type CustomizationOption = {
    name: string;
    price: number;
};

export type CustomizationGroup = {
    title: string;
    required?: boolean;
    multiSelect?: boolean;
    options: CustomizationOption[];
};

export type MenuItem = {
    id: string;
    name: string;
    description?: string;
    price: number;
    category: string;
    dietary?: 'veg' | 'non-veg' | '';
    imageUrl?: string;
    isAvailable?: boolean;
    duration?: number;
    customizations?: CustomizationGroup[];
};

export type Menu = {
    id: string;
    storeId: string;
    items: MenuItem[];
    theme?: MenuTheme;
};

export type Store = {
  id: string;
  name:string;
  teluguName?: string;
  description: string;
  address: string;
  imageId: string;
  imageUrl?: string;
  ownerId: string;
  latitude: number;
  longitude: number;
  distance?: number;
  isClosed?: boolean;
  tables?: string[];
  liveVideoUrl?: string;
  upiId?: string;
  businessType?: 'restaurant' | 'salon' | 'grocery';
  workingHours?: {
      start: string;
      end: string;
  };
};

export type User = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    address: string;
    phoneNumber: string;
    accountType?: 'groceries' | 'restaurant' | 'employee';
    storeId?: string;
    imageUrl?: string;
    latitude?: number;
    longitude?: number;
    fcmToken?: string;
}

export type CartItem = {
  product: Product;
  variant: ProductVariant;
  quantity: number;
  tableNumber?: string;
  sessionId?: string;
  selectedCustomizations?: Record<string, CustomizationOption[]>;
};

export type UnidentifiedCartItem = {
    id: string;
    term: string;
    status: 'pending' | 'failed' | 'identified';
};

export type Booking = {
    id: string;
    storeId: string;
    userId: string;
    deviceId: string;
    serviceId: string;
    serviceName: string;
    price: number;
    duration: number;
    customerName: string;
    phone: string;
    notes?: string;
    date: string;
    time: string;
    status: 'Booked' | 'In Progress' | 'Completed' | 'Cancelled';
    createdAt: any;
    updatedAt: any;
    store?: Store;
};

export type CallSession = {
    id: string;
    callerId: string;
    callerName: string;
    callerImageUrl?: string;
    type: 'audio' | 'video';
    status: 'ringing' | 'accepted' | 'active' | 'ended';
    offer?: any;
    answer?: any;
    startedAt: any;
};

export type Chat = {
    id: string;
    participants: string[]; 
    customerUid: string;
    lastMessage: string;
    lastSenderId: string;
    updatedAt: any;
    storeId: string;
    storeName: string;
    customerName: string;
    customerImageUrl?: string;
    unreadCount: Record<string, number>;
    activeCallId?: string | null;
};

export type Message = {
    id: string;
    chatId: string;
    senderId: string;
    text: string;
    type: 'text' | 'voice' | 'system';
    audioUrl?: string;
    duration?: number;
    createdAt: any;
};

export type CommandGroup = {
  display: string;
  reply: {
    en: string;
    te?: string;
    hi?: string;
    en_audio?: string;
    te_audio?: string;
    hi_audio?: string;
  };
};

export type FailedVoiceCommand = {
    id: string;
    text: string;
    lang: string;
    timestamp: any;
    storeId?: string;
    userId?: string;
    status: 'new' | 'resolved' | 'ignored';
    suggestion?: string;
};

export type VoiceAliasGroup = {
    id: string;
    en: string[];
    te: string[];
    hi: string[];
    category?: string;
    updatedAt: any;
    [key: string]: any;
};

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  menuItemId: string;
  productName: string;
  variantSku: string;
  variantWeight: string;
  quantity: number;
  price: number;
}

export type Order = {
  id:string;
  userId: string;
  storeId: string;
  customerName: string;
  deliveryAddress: string;
  deliveryLat: number;
  deliveryLng: number;
  items: OrderItem[];
  totalAmount: number;
  status: 'Pending' | 'Processing' | 'Out for Delivery' | 'Delivered' | 'Cancelled' | 'Completed' | 'Billed' | 'Draft';
  orderType: 'dine-in' | 'takeaway' | 'delivery' | 'counter';
  orderDate: any;
  phone: string;
  email: string;
  store?: Store; 
  deliveryPartnerId?: string | null;
  tableNumber?: string | null;
  sessionId?: string;
  updatedAt?: any;
  isActive?: boolean;
  needsService?: boolean;
  serviceType?: string;
  deviceId?: string;
};

declare global {
  interface Window {
      SpeechRecognition: any;
      webkitSpeechRecognition: any;
      deferredInstallPrompt: any;
  }
}