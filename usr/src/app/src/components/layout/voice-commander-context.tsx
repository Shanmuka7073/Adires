
'use client';

import { createContext, useContext } from 'react';
import type { Product, ProductPrice, ProductVariant } from '@/lib/types';

export interface PriceCheckInfo {
  product: Product;
  priceData: ProductPrice;
  recommendedProducts: Product[];
}

export interface VoiceCommandContextType {
  triggerVoicePrompt: () => void;
  retryCommand?: (command: string) => void;
  showPriceCheck: (info: PriceCheckInfo) => void;
  hidePriceCheck: () => void;
  onCartOpenChange: (open: boolean) => void;
  isCartOpen: boolean;
  voiceEnabled: boolean;
  voiceStatus: string;
  onToggleVoice: () => void;
}

export const VoiceCommandContext = createContext<VoiceCommandContextType | undefined>(undefined);

export function useVoiceCommanderContext() {
  const context = useContext(VoiceCommandContext);
  if (!context) {
    throw new Error('useVoiceCommanderContext must be used within a VoiceCommandProvider (MainLayout)');
  }
  return context;
}
