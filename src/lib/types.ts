
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

/* ---------------- CHAT & CALL TYPES ---------------- */

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

/* ---------------- REST OF TYPES ---------------- */

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

export type EmployeeProfile = {
    userId: string;
    storeId: string;
    employeeId: string;
    role: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    hireDate: string;
    salaryRate: number;
    salaryType: 'monthly' | 'hourly';
    payoutMethod: 'bank' | 'upi';
    upiId?: string | null;
    bankDetails?: {
        accountHolderName: string;
        accountNumber: string;
        ifscCode: string;
    } | null;
    reportingTo?: string;
};

export type ReasonEntry = {
    text: string;
    timestamp: any;
    status: 'submitted' | 'approved' | 'rejected';
    rejectionReason?: string;
};

export type AttendanceRecord = {
    id: string;
    employeeId: string;
    storeId: string;
    workDate: any;
    workDateStr: string;
    punchInTime: any;
    punchOutTime: any;
    status: 'present' | 'partially_present' | 'approved' | 'pending_approval' | 'rejected';
    workHours: number;
    rejectionCount?: number;
    reasonHistory?: ReasonEntry[];
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
    attendance?: any;
};

export type DeliveryPartner = {
  userId: string; 
  totalEarnings: number;
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
  requestDate: any;
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

export type InstructionStep = {
    title: string;
    actions: string[];
};

export interface GetIngredientsOutput {
    isSuccess: boolean;
    itemType: 'food' | 'service' | 'product';
    title: string;
    components: any[];
    steps: InstructionStep[];
    nutrition?: {
        calories: number;
        protein: number;
    };
}

export type CachedRecipe = {
    id: string;
    name: string;
    itemType: 'food' | 'service' | 'product';
    components: any[];
    steps: InstructionStep[];
    nutrition?: {
        calories: number;
        protein: number;
    };
    createdAt: any;
};

export type ReportData = {
  totalSales: number;
  totalOrders: number;
  topProducts: { name: string; count: number }[];
  ingredientCost?: number;
};

export type MonthlyPackage = {
    id: string;
    storeId: string;
    name: string;
    memberCount: number;
    price: number;
    items: {
        name: string;
        quantity: string;
    }[];
    schedule?: {
        day: number;
        mainItem: string;
        sideItem: string;
    }[];
};

export type SiteConfig = {
    liveVideoUrl?: string;
    isPackGeneratorEnabled?: boolean;
    isMaintenance?: boolean;
};

declare global {
  interface Window {
      SpeechRecognition: any;
      webkitSpeechRecognition: any;
      deferredInstallPrompt: any;
  }
}
