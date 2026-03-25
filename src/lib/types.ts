import { Timestamp } from "firebase/firestore";
import { z } from 'zod';

export type ProductVariant = {
  sku: string;
  weight: string;
  price: number;
  stock: number;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  variants?: ProductVariant[]; 
  imageId: string;
  storeId: string;
  category?: string;
  imageUrl?: string;
  imageHint?: string;
  matchedAlias?: string;
  isAiAssisted?: boolean;
  isMenuItem?: boolean;
  price?: number;
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

export type Ingredient = {
  name: string;
  baseQuantity?: number;
  quantity: string;
  unit?: string;
  cost?: number;
};

export type InstructionStep = {
    title: string;
    actions: string[];
}

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
  recipeSnapshot?: { name: string; qty: number; unit: string; cost?: number; }[];
  selectedCustomizations?: Record<string, CustomizationOption[]>;
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
  orderDate: Timestamp | Date | string;
  phone: string;
  email: string;
  translatedList?: string;
  store?: Store; 
  deliveryPartnerId?: string | null;
  tableNumber?: string | null;
  sessionId?: string;
  paidAt?: Timestamp;
  paymentMode?: string;
  updatedAt?: any;
  zoneId?: string;
  isActive?: boolean;
  appointmentTime?: string;
  needsService?: boolean;
  serviceType?: string;
  deviceId?: string;
};

export type SalarySlip = {
    id: string;
    employeeId: string;
    storeId: string;
    periodStart: string;
    periodEnd: string;
    baseSalary: number;
    overtimeHours: number;
    overtimePay: number;
    deductions: number;
    netPay: number;
    generatedAt: any;
};

export type DeliveryPartner = {
  userId: string;
  totalEarnings: number;
  lastPayoutDate?: Timestamp;
  payoutsEnabled: boolean;
  payoutMethod?: 'bank' | 'upi';
  upiId?: string;
  bankDetails?: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
  };
  zoneId?: string;
};

export type Payout = {
  id: string;
  partnerId: string;
  amount: number;
  requestDate: Timestamp | Date | string;
  completionDate?: Timestamp;
  status: 'pending' | 'completed' | 'failed';
  payoutMethod: 'bank' | 'upi';
  payoutDetails: any;
};

export type ProductPrice = {
    productName: string;
    variants: ProductVariant[];
}

export type VoiceAliasGroup = {
    id: string;
    type: 'product' | 'store' | 'command';
    [key: string]: any; 
};

export interface GetIngredientsOutput {
    isSuccess: boolean;
    itemType: 'food' | 'service' | 'product';
    title: string;
    components: Ingredient[];
    steps: InstructionStep[];
    nutrition?: {
        calories: number;
        protein: number;
    };
}

export type ReportData = {
  totalSales: number;
  totalItems: number;
  totalOrders: number;
  topProducts: { name: string; count: number }[];
  ingredientCost: number;
  orders: Order[]; 
};

export type NluExtractedSentence = {
    id: string;
    rawText: string;
    extractedNumbers: any[]; 
    confidence: number;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: any;
};

export type SiteConfig = {
  id: string;
  storeId: string;
  businessName?: string;
  ownerName?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  logoUrl?: string;
  currency?: string;
  timezone?: string;
  liveVideoUrl?: string;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
};

export interface CreateVoiceprintInput {
  userId: string;
  audioDataUri: string;
}

export interface CreateVoiceprintOutput {
  isSuccess: boolean;
  enrollmentCount: number;
  error?: string;
}

export interface VerifyVoiceprintInput {
  userId: string;
  audioDataUri: string;
}

export interface VerifyVoiceprintOutput {
    isMatch: boolean;
    confidence: number;
    error?: string;
}

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

declare global {
  interface Window {
      SpeechRecognition: any;
      webkitSpeechRecognition: any;
      deferredInstallPrompt: any;
  }
}
