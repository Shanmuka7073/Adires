
'use client';

import { create } from 'zustand';
import { RefObject } from 'react';

// State store for the checkout page, allowing the VoiceCommander to interact with it.
interface CheckoutState {
  placeOrderBtnRef: RefObject<HTMLButtonElement> | null;
  setPlaceOrderBtnRef: (ref: RefObject<HTMLButtonElement> | null) => void;
  isWaitingForQuickOrderConfirmation: boolean;
  setIsWaitingForQuickOrderConfirmation: (isWaiting: boolean) => void;
  shouldPlaceOrderDirectly: boolean;
  setShouldPlaceOrderDirectly: (shouldPlace: boolean) => void;
  setHomeAddress: (address: string | null) => void;
  setShouldUseCurrentLocation: (shouldUse: boolean) => void;
  // Handlers for voice commands to call directly
  handleUseHomeAddress: () => void;
  handleUseCurrentLocation: () => void;
  setAddressHandlers: (homeHandler: () => void, currentHandler: () => void) => void;
}

export const useCheckoutStore = create<CheckoutState>((set) => ({
  placeOrderBtnRef: null,
  setPlaceOrderBtnRef: (placeOrderBtnRef) => set({ placeOrderBtnRef }),
  isWaitingForQuickOrderConfirmation: false,
  setIsWaitingForQuickOrderConfirmation: (isWaiting) => set({ isWaitingForQuickOrderConfirmation: isWaiting }),
  shouldPlaceOrderDirectly: false,
  setShouldPlaceOrderDirectly: (shouldPlace) => set({ shouldPlaceOrderDirectly: shouldPlace }),
  setHomeAddress: (address) => {
    set(state => ({ ...state })); 
  },
  setShouldUseCurrentLocation: (shouldUse) => {
     set(state => ({ ...state }));
  },
  handleUseHomeAddress: () => {},
  handleUseCurrentLocation: () => {},
  setAddressHandlers: (homeHandler, currentHandler) => set({ handleUseHomeAddress: homeHandler, handleUseCurrentLocation: currentHandler }),
}));
