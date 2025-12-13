

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
  // Variants are no longer stored on the store-specific product document.
  // They are fetched from the central productPrices collection.
  variants?: ProductVariant[]; 
  imageId: string;
  storeId: string;
  category?: string;
  imageUrl?: string; // Data URI for AI-generated image
  imageHint?: string;
  matchedAlias?: string; // The alias the user spoke
  isAiAssisted?: boolean; // Flag to show if AI identified this item
  isMenuItem?: boolean;
  price?: number;
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
  tables?: string[]; // NEW: For restaurant table management
};

// WebAuthn types
export type Authenticator = {
  credentialID: string; // This is a Base64URL-encoded string
  credentialPublicKey: string; // This is now a Base64URL-encoded string
  counter: number;
  transports?: AuthenticatorTransport[];
};

export type User = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    address: string;
    phoneNumber: string;
    latitude?: number;
    longitude?: number;
    fcmToken?: string;
    authenticators?: Authenticator[];
    currentChallenge?: string | null; // Can be null
}

export type CartItem = {
  product: Product; // The base product
  variant: ProductVariant; // The specific variant chosen
  quantity: number;
  tableNumber?: string; // For restaurant orders
};

export type OrderItem = {
  productId: string;
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
  storeOwnerId?: string; // Denormalized for security rules, optional for backwards compatibility
  customerName: string;
  deliveryAddress: string;
  deliveryLat: number;
  deliveryLng: number;
  items: OrderItem[];
  totalAmount: number;
  status: 'Pending' | 'Processing' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
  orderDate: Timestamp; 
  phone: string;
  email: string;
  tableNumber?: string; // For restaurant orders
  translatedList?: string; // Bilingual translated list
  store?: Store; // Optional: Denormalized or joined store data
  deliveryPartnerId?: string | null; // ID of the user who is delivering
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

export interface Ingredient {
    name: string;
    quantity: string;
    baseQuantity?: number;
    unit?: string;
}

// NEW: Structured instruction step
export interface InstructionStep {
    title: string;
    actions: string[];
}

export interface GetIngredientsOutput {
    isSuccess: boolean;
    title: string;
    ingredients: Ingredient[];
    instructions: InstructionStep[];
    nutrition: {
        calories: number;
        protein: number;
    }
}

export type CachedRecipe = {
    id: string;
    dishName: string;
    ingredients: Ingredient[];
    instructions: InstructionStep[];
    nutrition: {
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
    isAliasSuggesterEnabled?: boolean;
};

// Type for conversational history
export type ChatMessage = {
  id?: string;
  role: 'user' | 'model';
  text: string;
  timestamp?: any;
};

// --- Voice ID Types ---

export type Voiceprint = {
  userId: string; // Document ID should be the user's UID
  enrollments: number[][]; // Array of raw feature vectors from each enrollment
  voiceprint: number[]; // The final, averaged feature vector
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

export type Locales = Record<string, VoiceAliasGroup>;

// NLU Training Dashboard Types
export type NluExtractedSentence = {
    id: string;
    rawText: string;
    extractedNumbers: any[]; // Consider defining a more specific type for extracted numbers later
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
    name: string;
    description?: string;
    price: number;
    category: string;
};

export type Menu = {
    id: string;
    storeId: string;
    items: MenuItem[];
};
