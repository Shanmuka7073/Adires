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
  imageUrl?: string; // Data URI for AI-generated image
  imageHint?: string;
  matchedAlias?: string; // The alias the user spoke
  isAiAssisted?: boolean; // Flag to show if AI identified this item
  isMenuItem?: boolean; // Flag to identify a restaurant menu item
  price?: number; // Direct price for menu items
};

export type Store = {
  id: string;
  name: string;
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
    theme?: {
        backgroundColor: string;
        primaryColor: string;
        textColor: string;
    };
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

export type EmployeeProfile = {
    userId: string;
    storeId: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    address: string;
    employeeId: string;
    role: string;
    hireDate: string;
    salaryRate: number;
    salaryType: 'hourly' | 'monthly';
    payoutMethod: 'bank' | 'upi';
    reportingTo?: string;
    upiId?: string | null;
    bankDetails?: {
        accountHolderName: string;
        accountNumber: string;
        ifscCode: string;
    } | null;
};

export type ReasonEntry = {
    text: string;
    timestamp: Date | Timestamp;
    status: 'submitted' | 'approved' | 'rejected';
    rejectionReason?: string;
};

export type AttendanceRecord = {
    id: string;
    employeeId: string;
    storeId: string;
    workDate: Timestamp;
    workDateStr: string;
    punchInTime: Timestamp | null;
    punchOutTime: Timestamp | null;
    status: 'present' | 'partially_present' | 'pending_approval' | 'approved' | 'rejected';
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
    netPay: number;
    generatedAt: Timestamp;
    attendance?: any;
};

export type SiteConfig = {
    liveVideoUrl?: string;
    isPackGeneratorEnabled?: boolean;
    isRecipeApiEnabled?: boolean;
    isGeneralQuestionApiEnabled?: boolean;
    isAliasSuggesterEnabled?: boolean;
};

export type VoiceAliasGroup = {
    id: string; // The canonical key, e.g., 'tomatoes'
    en: string[];
    te: string[];
    hi: string[];
    updatedAt: any;
    [key: string]: any;
};

export type CallSession = {
    id: string;
    callerId: string;
    callerName: string;
    callerImageUrl?: string;
    type: 'audio';
    status: 'ringing' | 'active' | 'ended' | 'missed';
    startedAt: any;
    offer?: any;
    answer?: any;
}

export type Chat = {
    id: string;
    participants: string[];
    customerUid: string;
    customerName: string;
    customerImageUrl: string;
    storeId: string;
    storeName: string;
    lastMessage: string;
    lastSenderId: string;
    updatedAt: any;
    unreadCount: Record<string, number>;
    activeCallId?: string | null;
}

export type Message = {
    id: string;
    chatId: string;
    senderId: string;
    text: string;
    type: 'text' | 'voice' | 'image';
    audioUrl?: string;
    imageUrl?: string;
    createdAt: any;
}

declare global {
  interface Window {
      SpeechRecognition: any;
      webkitSpeechRecognition: any;
      deferredInstallPrompt: any;
  }
}
