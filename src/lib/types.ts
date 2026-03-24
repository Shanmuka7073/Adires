
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
  tables?: string[]; // For restaurant table numbers
  liveVideoUrl?: string; // URL for live kitchen stream
  upiId?: string; // NEW: The UPI ID for receiving payments
  businessType?: 'restaurant' | 'salon' | 'grocery'; // NEW: Business categorization
};

export type User = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    address: string;
    phoneNumber: string;
    accountType?: 'groceries' | 'restaurant' | 'employee';
    storeId?: string; // For employees, the store they belong to.
    imageUrl?: string;
    latitude?: number;
    longitude?: number;
    fcmToken?: string;
}

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

export type CartItem = {
  product: Product; // The base product
  variant: ProductVariant; // The specific variant chosen
  quantity: number;
  tableNumber?: string;
  sessionId?: string;
  selectedCustomizations?: Record<string, CustomizationOption[]>; // Track chosen options per group
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
  menuItemId: string; // Reference to the original menu item for robust cost calculation and analytics
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
  sessionId?: string; // To group all orders for a single table session
  paidAt?: Timestamp;
  paymentMode?: string;
  updatedAt?: any;
  zoneId?: string; // Geographic partition ID derived from pincode
  isActive?: boolean; // NEW: Flag for Operational Indexing optimization
  appointmentTime?: string; // NEW: For salons
  needsService?: boolean; // NEW: Waiter call flag
  serviceType?: string; // NEW: Reason for waiter call
  deviceId?: string; // For persistent device-level activity
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
    status: 'present' | 'absent' | 'partially_present' | 'pending_approval' | 'approved' | 'rejected';
    workHours: number;
    rejectionCount?: number;
    reasonHistory?: ReasonEntry[];
};

export type EmployeeProfile = {
    userId: string;
    storeId: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    role: string;
    hireDate: string;
    salaryRate: number;
    salaryType: 'hourly' | 'monthly';
    payoutMethod: 'bank' | 'upi';
    upiId?: string | null;
    bankDetails?: {
        accountHolderName: string;
        accountNumber: string;
        ifscCode: string;
    } | null;
    reportingTo?: string | null;
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
  userId: string; // The user's UID
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
  zoneId?: string; // Geographic partition ID derived from pincode
};

export type Payout = {
  id: string;
  partnerId: string;
  amount: number;
  requestDate: Timestamp | Date | string;
  completionDate?: Timestamp;
  status: 'pending' | 'completed' | 'failed';
  payoutMethod: 'bank' | 'upi';
  payoutDetails: any; // upiId or bankDetails
};

// Represents the canonical pricing for a product, managed by the admin.
export type ProductPrice = {
    productName: string; // The unique name of the product, matches the document ID.
    variants: ProductVariant[];
}

export type FailedVoiceCommand = {
    id: string;
    userId: string;
    commandText: string;
    language: string;
    timestamp: Timestamp | Date | string;
    reason: string;
    status?: 'new' | 'no_suggestion'; // Status for processing
}

export type VoiceAliasGroup = {
    id: string; // The canonical key, e.g., 'tomatoes'
    type: 'product' | 'store' | 'command';
    [key: string]: any; // To allow for language codes as keys (en, te, hi, etc.)
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

export type Voiceprint = {
  userId: string; 
  enrollments: number[][]; 
  voiceprint: number[]; 
  createdAt: string;
  lastUpdatedAt: string;
};

export const CreateVoiceprintInputSchema = z.object({
  userId: z.string().describe('The unique ID of the user.'),
  audioDataUri: z
    .string()
    .describe(
      "A recording of the user's voice as a data URI. Must include a MIME type and use Base64 encoding. E.g., 'data:audio/webm;base64,...'"
    ),
});
export type CreateVoiceprintInput = z.infer<typeof CreateVoiceprintInputSchema>;

export const CreateVoiceprintOutputSchema = z.object({
  isSuccess: z.boolean().describe('Whether the voiceprint was successfully saved.'),
  enrollmentCount: z.number().describe('The total number of enrollments the user now has.'),
  error: z.string().optional().describe('An error message if the process failed.'),
});
export type CreateVoiceprintOutput = z.infer<typeof CreateVoiceprintOutputSchema>;

export const VerifyVoiceprintInputSchema = z.object({
  userId: z.string().describe('The unique ID of the user to verify against.'),
  audioDataUri: z.string().describe("A new voice recording to compare against the stored voiceprint."),
});
export type VerifyVoiceprintInput = z.infer<typeof VerifyVoiceprintInputSchema>;

export const VerifyVoiceprintOutputSchema = z.object({
    isMatch: z.boolean().describe('Whether the new recording matches the stored voiceprint.'),
    confidence: z.number().describe('A score from 0 to 1 indicating the similarity.'),
    error: z.string().optional().describe('An error message if verification failed.'),
});
export type VerifyVoiceprintOutput = z.infer<typeof VerifyVoiceprintOutputSchema>;

export type CachedRecipe = {
    id: string;
    dishName: string;
    itemType: 'food' | 'service' | 'product';
    components: Ingredient[];
    steps: InstructionStep[];
    nutrition?: {
        calories: number;
        protein: number;
    };
    createdAt: any; // Allow serverTimestamp
}

export type CachedAIResponse = {
    id: string;
    question: string;
    answer: string;
    createdAt: any; // Allow serverTimestamp
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

export type SiteConfig = {
    liveVideoUrl?: string;
    isPackGeneratorEnabled?: boolean;
    isRecipeApiEnabled?: boolean;
    isGeneralQuestionApiEnabled?: boolean;
    isOrderVideoEnabled?: boolean;
    isAliasSuggesterEnabled?: boolean;
};

export type ChatMessage = {
  id?: string;
  role: 'user' | 'model';
  text: string;
  proposedCode?: string; // NEW: Code suggested by Asha for direct application
  targetPath?: string; // NEW: File to be edited
  timestamp?: any;
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

export type NluExtractedSentence = {
    id: string;
    rawText: string;
    extractedNumbers: any[]; 
    confidence: number;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: any;
};

export type GenerateBreakfastPackOutput = {
  packName: string;
  schedule: DayPlan[];
  shoppingList: {
    itemName: string;
    quantity: string;
  }[];
  estimatedCost: number;
};

// Restaurant Menu Types
export type MenuItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  ingredients?: Ingredient[];
  imageUrl?: string; // URL for AI-generated dish image
  dietary?: 'veg' | 'non-veg'; // NEW: Dietary indicator
  isAvailable: boolean; // NEW: Stock toggle
  customizations?: CustomizationGroup[];
  recommendations?: string[]; // IDs of related items
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

export type UnidentifiedCartItem = {
    id: string;
    term: string;
    status: 'pending' | 'failed' | 'identified';
};

// Type for Restaurant Inventory
export type RestaurantIngredient = {
  id: string;
  name: string;
  unit: string; // e.g., 'kg', 'litre', 'pc'
  cost: number; // The purchase cost per unit
};

export type ReportData = {
  totalSales: number;
  totalItems: number;
  totalOrders: number;
  topProducts: { name: string; count: number }[];
  topProfitableProducts: { name: string; totalProfit: number; profitPerUnit: number; count: number }[];
  ingredientCost: number;
  costDrivers: { name: string; cost: number; percentage: number }[];
  optimizationHint: string | null;
  salesByTable: { 
    tableNumber: string; 
    totalSales: number; 
    orderCount: number; 
    totalCost: number;
    profitPerOrder: number;
    grossProfit: number;
    profitPercentage: number;
  }[];
  orders: Order[]; 
};

declare global {
  interface Window {
      SpeechRecognition: any;
      webkitSpeechRecognition: any;
      deferredInstallPrompt: any;
  }
}
