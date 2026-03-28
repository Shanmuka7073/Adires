
import { Timestamp } from "firebase/firestore";

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
  imageUrl?: string;
  category?: string;
  businessType?: string;
  discoveredAt?: any;
  discoveredInStoreId?: string;
  updatedAt?: any;
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

export type UnidentifiedCartItem = {
    id: string;
    term: string;
    status: 'pending' | 'failed' | 'identified';
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

export type MenuTheme = {
    backgroundColor: string;
    primaryColor: string;
    textColor: string;
};

export type Menu = {
    id: string;
    storeId: string;
    items: MenuItem[];
    theme?: MenuTheme;
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
    id: string;
    en: string[];
    te: string[];
    hi: string[];
    updatedAt: any;
    [key: string]: any;
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

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  menuItemId?: string;
  productName: string;
  variantSku: string;
  variantWeight: string;
  quantity: number;
  price: number;
};

export type Order = {
  id: string;
  userId: string;
  storeId: string;
  customerName?: string;
  phone?: string;
  email?: string;
  deliveryAddress?: string;
  deliveryLat: number;
  deliveryLng: number;
  items: OrderItem[];
  totalAmount: number;
  status: 'Pending' | 'Processing' | 'Out for Delivery' | 'Delivered' | 'Cancelled' | 'Completed' | 'Billed';
  orderDate: any;
  updatedAt?: any;
  isActive?: boolean;
  orderType?: 'delivery' | 'dine-in' | 'takeaway' | 'counter';
  sessionId?: string;
  tableNumber?: string | null;
  needsService?: boolean;
  serviceType?: string | null;
  store?: Store;
  deliveryPartnerId?: string | null;
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

export type DeliveryPartner = {
  userId: string;
  totalEarnings: number;
  lastPayoutDate?: Timestamp;
  payoutsEnabled: boolean;
  payoutMethod?: 'bank' | 'upi';
  upiId?: string;
  zoneId?: string;
  bankDetails?: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
  };
};

export type ProductPrice = {
    productName: string;
    variants: ProductVariant[];
}

export type FailedVoiceCommand = {
    id: string;
    userId: string;
    text: string;
    lang: string;
    timestamp: any;
    storeId?: string;
    status: 'new' | 'resolved' | 'ignored';
    suggestion?: string;
}

export interface InstructionStep {
    title: string;
    actions: string[];
}

export interface Ingredient {
    name: string;
    quantity: string;
}

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

export type CachedRecipe = {
    id: string;
    name: string;
    itemType: 'food' | 'service' | 'product';
    components: Ingredient[];
    steps: InstructionStep[];
    nutrition?: {
        calories: number;
        protein: number;
    };
    createdAt: any; 
}

export type CachedAIResponse = {
    id: string;
    question: string;
    answer: string;
    createdAt: any;
}

export type DayPlan = {
  day: number;
  mainItem: string;
  sideItem: string;
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
    schedule?: DayPlan[];
};

export type ReportData = {
    totalSales: number;
    totalOrders: number;
    topProducts: { name: string; count: number }[];
    ingredientCost?: number;
};

declare global {
  interface Window {
      SpeechRecognition: any;
      webkitSpeechRecognition: any;
      deferredInstallPrompt: any;
  }
}
