
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, errorEmitter } from '@/firebase';
import type { Store, Product, ProductPrice, ProductVariant, CartItem, User } from '@/lib/types';
import { calculateSimilarity } from '@/lib/calculate-similarity';
import { useCart } from '@/lib/cart';
import { useAppStore, useProfileFormStore } from '@/lib/store';
import { ProfileFormValues } from '@/app/dashboard/customer/my-profile/page';
import { useCheckoutStore } from '@/app/checkout/page';
import { getCommands } from '@/app/actions';
import { t, getAllAliases } from '@/lib/locales';
import { doc, getDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';

export interface Command {
  command: string;
  action: (params?: any) => void;
  display: string;
  reply: string;
}

interface VoiceCommanderProps {
  enabled: boolean;
  onStatusUpdate: (status: string) => void;
  onSuggestions: (suggestions: Command[]) => void;
  onOpenCart: () => void;
  onCloseCart: () => void;
  isCartOpen: boolean;
  cartItems: CartItem[];
  voiceTrigger: number;
}

let recognition: SpeechRecognition | null = null;
if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
}

export function VoiceCommander({
  enabled,
  onStatusUpdate,
  onSuggestions,
  onOpenCart,
  onCloseCart,
  isCartOpen,
  cartItems,
  voiceTrigger
}: VoiceCommanderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const { clearCart, addItem: addItemToCart, updateQuantity, activeStoreId, setActiveStoreId, cartTotal } = useCart();

  const { stores, masterProducts, productPrices, fetchInitialData, fetchProductPrices, getProductName } = useAppStore();

  const { form: profileForm } = useProfileFormStore();
  const { 
    placeOrderBtnRef, 
    setIsWaitingForQuickOrderConfirmation, 
    isWaitingForQuickOrderConfirmation, 
    homeAddressBtnRef, 
    currentLocationBtnRef, 
    shouldPlaceOrderDirectly, 
    setShouldPlaceOrderDirectly 
  } = useCheckoutStore();


  const isSpeakingRef = useRef(false);
  const isEnabledRef = useRef(enabled);
  const commandsRef = useRef<Command[]>([]);
  const commandActionsRef = useRef<any>({});
  const fileCommandsRef = useRef<any>({});

  const formFieldToFillRef = useRef<keyof ProfileFormValues | null>(null);
  const [isWaitingForStoreName, setIsWaitingForStoreName] = useState(false);
  const [isWaitingForVoiceOrder, setIsWaitingForVoiceOrder] = useState(false);
  const [clarificationStores, setClarificationStores] = useState<Store[]>([]);
  const hasSpokenCheckoutPrompt = useRef(false);
  const [isWaitingForAddressType, setIsWaitingForAddressType] = useState(false);

  const [isWaitingForQuantity, setIsWaitingForQuantity] = useState(false);
  const itemToUpdateSkuRef = useRef<string | null>(null);

  const userProfileRef = useRef<User | null>(null);

  const [hasMounted, setHasMounted] = useState(false);

  const [speechSynthesisVoices, setSpeechSynthesisVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentLanguage, setCurrentLanguage] = useState('en-IN');
  
  // Track checkout state
  const [checkoutReady, setCheckoutReady] = useState(false);
  const addressValueRef = useRef<string>('');
  
  const resetAllContext = useCallback(() => {
    setIsWaitingForQuantity(false);
    itemToUpdateSkuRef.current = null;
    setIsWaitingForStoreName(false);
    setClarificationStores([]);
    onSuggestions([]);
    setIsWaitingForQuickOrderConfirmation(false);
    setIsWaitingForVoiceOrder(false);
    setIsWaitingForAddressType(false);
    hasSpokenCheckoutPrompt.current = false;
    formFieldToFillRef.current = null;
    setShouldPlaceOrderDirectly(false);
  }, [onSuggestions, setIsWaitingForQuickOrderConfirmation, setShouldPlaceOrderDirectly]);


  // Language detection and switching
  const detectLanguage = useCallback((text: string): { lang: string, command: string } => {
    const lowerText = text.toLowerCase();

    const langKeywords = [
        { lang: 'te-IN', keywords: ['naku', 'naaku', 'నాకు'] },
        { lang: 'hi-IN', keywords: ['mujhe', 'मुझे'] },
        { lang: 'en-IN', keywords: ['i want', 'i need', 'get me', 'add', 'get', 'buy', 'order', 'send', 'go', 'open', 'i'] }
    ];

    for (const lang of langKeywords) {
        for (const keyword of lang.keywords) {
            if (lowerText.startsWith(keyword + ' ')) {
                 setCurrentLanguage(lang.lang);
                return {
                    lang: lang.lang,
                    command: lowerText.substring(keyword.length).trim()
                };
            }
             // Also handle cases where keyword is the whole command e.g., "Home"
            if (lowerText === keyword) {
                 setCurrentLanguage(lang.lang);
                 return {
                    lang: lang.lang,
                    command: '' // The command is just the keyword, which is handled elsewhere
                };
            }
        }
    }
    
    // Default case if no keyword is found, use the current sticky language
    return { lang: currentLanguage, command: text };
  }, [currentLanguage]);

  // Update recognition language dynamically
  const updateRecognitionLanguage = useCallback((newLang: string) => {
    if (recognition && recognition.lang !== newLang) {
      console.log('Switching recognition language to:', newLang);
      recognition.lang = newLang;
      // No need to set currentLanguage state here, it's set in detectLanguage
    }
  }, []);

  useEffect(() => {
    if(pathname !== '/checkout') {
      resetAllContext();
    }
  }, [pathname, resetAllContext]);


  useEffect(() => {
    setHasMounted(true);
    if(firestore) {
      fetchInitialData(firestore);
    }
    const getVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      if (allVoices.length > 0) {
        setSpeechSynthesisVoices(allVoices);
      }
    };

    if ('onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = getVoices;
    }
    getVoices();

    return () => {
      if ('onvoiceschanged' in window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [firestore, fetchInitialData]);

  useEffect(() => {
    isEnabledRef.current = enabled;
    if (recognition) {
      if (enabled) {
        // Set initial language from the sticky state
        recognition.lang = currentLanguage;
        try {
          recognition.start();
        } catch (e) {
          // Already started
        }
      } else {
        recognition.abort();
      }
    }
  }, [enabled, currentLanguage]);

  const speak = useCallback((text: string, lang: string, onEndCallback?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      if (onEndCallback) onEndCallback();
      return;
    }

    window.speechSynthesis.cancel();
    isSpeakingRef.current = false;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1;
    utterance.rate = 1.1;
    utterance.lang = lang; // Use the dynamically detected language

    const desiredVoice = speechSynthesisVoices.find(voice => 
      voice.lang === lang && voice.localService
    );
    
    if (desiredVoice) {
      utterance.voice = desiredVoice;
    } else {
      // Fallback to any voice that supports the language
      const langCode = lang.split('-')[0];
      const langVoices = speechSynthesisVoices.filter(v => v.lang.startsWith(langCode));
      if (langVoices.length > 0) {
        utterance.voice = langVoices[0];
      }
    }

    utterance.onend = () => {
      isSpeakingRef.current = false;
      if (onEndCallback) onEndCallback();
      if (isEnabledRef.current) {
        try {
          recognition?.start();
        } catch(e) {
          // ignore if already started
        }
      }
    };

    utterance.onerror = (e) => {
      if (e.error === 'interrupted') {
        console.log('Speech was interrupted.');
      } else {
        console.error("Speech synthesis error:", e.error || 'Unknown speech error');
      }
      isSpeakingRef.current = false;
      if (onEndCallback) onEndCallback();
      if (isEnabledRef.current) {
        try {
          recognition?.start();
        } catch(e) {}
      }
    };

    isSpeakingRef.current = true;
    recognition?.stop();
    window.speechSynthesis.speak(utterance);
  }, [speechSynthesisVoices]);

  const handleProfileFormInteraction = useCallback(() => {
    if (!profileForm) {
      speak("I can't seem to access the profile form right now.", 'en-IN');
      return;
    }
    const fields: { name: keyof ProfileFormValues; label: string }[] = [
      { name: 'firstName', label: 'first name' },
      { name: 'lastName', label: 'last name' },
      { name: 'phone', label: 'phone number' },
      { name: 'address', label: 'full address' },
    ];
    const formValues = profileForm.getValues();
    const firstEmptyField = fields.find(f => !formValues[f.name]);

    if (firstEmptyField) {
      formFieldToFillRef.current = firstEmptyField.name;
      speak(`What is your ${firstEmptyField.label}?`, 'en-IN');
    } else {
      formFieldToFillRef.current = null;
      speak("Your profile looks complete! You can say 'save changes' to submit.", 'en-IN');
    }
  }, [profileForm, speak]);

  // Monitor checkout conditions - This function now only runs on the client.
  const checkCheckoutConditions = useCallback(() => {
    if (typeof document === 'undefined' || pathname !== '/checkout') return false;

    const addressInput = document.querySelector('input[name="deliveryAddress"]') as HTMLInputElement;
    const currentAddress = addressInput?.value || '';
    addressValueRef.current = currentAddress;

    const hasValidAddress = currentAddress && currentAddress.length >= 10;
    const hasStore = !!activeStoreId;
    const hasCartItems = cartItems.length > 0;

    return hasValidAddress && hasStore && hasCartItems;
  }, [pathname, activeStoreId, cartItems.length]);

  // Enhanced checkout prompt function
  const runCheckoutPrompt = useCallback(() => {
    if (pathname !== '/checkout' || !hasMounted || !enabled || isSpeakingRef.current) {
      return;
    }

    // Don't speak if we're already in a confirmation state
    if (isWaitingForQuickOrderConfirmation) {
      if (!hasSpokenCheckoutPrompt.current) {
        speak(t('confirm-the-quick-order-speech', currentLanguage), currentLanguage);
        hasSpokenCheckoutPrompt.current = true;
      }
      return;
    }

    // Check if all conditions are met for final step
    const isCheckoutReady = checkCheckoutConditions();
    
    if (isCheckoutReady && !hasSpokenCheckoutPrompt.current) {
      console.log('All checkout conditions met - prompting for place order');
       const speech = t('everything-is-ready-speech', currentLanguage).replace('{address}', addressValueRef.current.substring(0, 30));
      speak(speech, currentLanguage);
      hasSpokenCheckoutPrompt.current = true;
      setCheckoutReady(true);
      return;
    }

    // If not ready, guide through steps
    if (!hasSpokenCheckoutPrompt.current) {
      if (typeof document !== 'undefined') {
        const addressInput = document.querySelector('input[name="deliveryAddress"]') as HTMLInputElement;
        const currentAddress = addressInput?.value || '';

        if (!currentAddress || currentAddress.length < 10) {
            speak(t('should-i-deliver-to-home-or-current-speech', currentLanguage), currentLanguage);
            setIsWaitingForAddressType(true);
            hasSpokenCheckoutPrompt.current = true;
            return;
        }
      }

      if (!activeStoreId) {
        speak(t('which-store-should-fulfill-speech', currentLanguage), currentLanguage);
        setIsWaitingForStoreName(true);
        hasSpokenCheckoutPrompt.current = true;
        return;
      }

      if (cartItems.length === 0) {
        speak(t('your-cart-is-empty-speech', currentLanguage), currentLanguage);
        hasSpokenCheckoutPrompt.current = true;
        return;
      }
    }
  }, [pathname, hasMounted, enabled, isWaitingForQuickOrderConfirmation, checkCheckoutConditions, speak, activeStoreId, cartItems.length, currentLanguage]);

  // Effect to monitor checkout state changes, now safely client-side
  useEffect(() => {
    if (pathname === '/checkout' && hasMounted) {
      const interval = setInterval(() => {
        const isReady = checkCheckoutConditions();
        if (isReady && !hasSpokenCheckoutPrompt.current && !isSpeakingRef.current) {
          console.log('Checkout conditions now met - triggering prompt');
          hasSpokenCheckoutPrompt.current = false;
          setTimeout(runCheckoutPrompt, 1000);
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [pathname, hasMounted, checkCheckoutConditions, runCheckoutPrompt]);

  // Effect to run checkout prompt on voice trigger
  useEffect(() => {
    if (pathname === '/checkout' && hasMounted) {
      const timeout = setTimeout(() => {
        hasSpokenCheckoutPrompt.current = false;
        runCheckoutPrompt();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [voiceTrigger, pathname, hasMounted, runCheckoutPrompt]);

  // Effect to reset prompt when relevant states change
  useEffect(() => {
    if (pathname === '/checkout' && hasMounted) {
      hasSpokenCheckoutPrompt.current = false;
      const timeout = setTimeout(runCheckoutPrompt, 500);
      return () => clearTimeout(timeout);
    }
  }, [cartItems.length, activeStoreId, pathname, hasMounted, runCheckoutPrompt]);

  // Proactive prompt on profile page
  useEffect(() => {
    if (pathname !== '/dashboard/customer/my-profile' || !hasMounted || !enabled) {
      hasSpokenCheckoutPrompt.current = false;
      formFieldToFillRef.current = null;
      return;
    }

    if (!hasSpokenCheckoutPrompt.current && profileForm) {
      const speakTimeout = setTimeout(() => {
        handleProfileFormInteraction();
        hasSpokenCheckoutPrompt.current = true;
      }, 1500);

      return () => clearTimeout(speakTimeout);
    }
  }, [pathname, hasMounted, enabled, profileForm, handleProfileFormInteraction]);

  const findProductAndVariant = useCallback(async (phrase: string): Promise<{ product: Product | null, variant: ProductVariant | null, remainingPhrase: string }> => {
    const lowerPhrase = phrase.toLowerCase();

    let bestMatch: { product: Product, alias: string, similarity: number } | null = null;

    for (const p of masterProducts) {
      if (!p.name) continue;
      const aliasesToCheck = [p.name.toLowerCase(), ...Object.values(getAllAliases(p.name.toLowerCase().replace(/ /g, '-'))).flat().map(name => name.toLowerCase())];
      const uniqueAliases = [...new Set(aliasesToCheck)];

      for (const alias of uniqueAliases) {
        if (lowerPhrase.includes(alias)) {
          const similarity = calculateSimilarity(lowerPhrase, alias);
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { product: p, alias: alias, similarity: similarity };
          }
        }
      }
    }

    if (!bestMatch) return { product: null, variant: null, remainingPhrase: phrase };

    const productMatch = bestMatch.product;
    const remainingPhrase = lowerPhrase.replace(bestMatch.alias, '').trim();

    let priceData = productPrices[productMatch.name.toLowerCase()];
    if (priceData === undefined && firestore) {
      await fetchProductPrices(firestore, [productMatch.name]);
      priceData = useAppStore.getState().productPrices[productMatch.name.toLowerCase()];
    }

    if (!priceData || !priceData.variants || priceData.variants.length === 0) {
      return { product: productMatch, variant: null, remainingPhrase: phrase };
    }

    const weightRegex = /(\d+)\s?(kg|kilo|kilos|g|gm|gram|grams)/i;
    const weightMatch = lowerPhrase.match(weightRegex);

    if (weightMatch) {
      const number = parseInt(weightMatch[1], 10);
      const unit = weightMatch[2].toLowerCase();
      
      let desiredWeightStr = `${number}${unit.startsWith('k') ? 'kg' : 'gm'}`;

      const variantMatch = priceData.variants.find(v => v.weight.replace(/\s/g, '').toLowerCase() === desiredWeightStr);
      if (variantMatch) {
        return { product: productMatch, variant: variantMatch, remainingPhrase };
      }
    }

    const defaultVariant = 
      priceData.variants.find(v => v.weight === '1kg') ||
      priceData.variants.find(v => v.weight.includes('pack')) ||
      priceData.variants.find(v => v.weight.includes('pc')) ||
      priceData.variants[0];

    return { product: productMatch, variant: defaultVariant, remainingPhrase };
  }, [firestore, masterProducts, productPrices, fetchProductPrices]);

  useEffect(() => {
    if (pathname !== '/checkout') {
      hasSpokenCheckoutPrompt.current = false;
      setCheckoutReady(false);
    }
  }, [pathname]);

  // This is the auto-submit logic for direct quick orders
  const areAllDetailsReady = checkCheckoutConditions();
  useEffect(() => {
    if (shouldPlaceOrderDirectly && areAllDetailsReady && placeOrderBtnRef.current) {
        console.log("Direct order conditions met. Clicking place order.");
        placeOrderBtnRef.current.click();
        setShouldPlaceOrderDirectly(false); // Reset after action
    }
  }, [shouldPlaceOrderDirectly, areAllDetailsReady, placeOrderBtnRef, setShouldPlaceOrderDirectly]);

  const handleCommand = useCallback(async (commandText: string) => {
    onStatusUpdate(`Processing: "${commandText}"`);
    try {
      if (!firestore || !user) return;
      
      const { lang, command: strippedCommand } = detectLanguage(commandText);
      updateRecognitionLanguage(lang);
      
      const commandLower = strippedCommand.toLowerCase();

      // --- PRIORITY 1: High-priority global navigation ---
      const highPriorityCommands = ["home", "stores", "dashboard", "cart", "orders", "deliveries", "myStore", "checkout", "refresh"];
      for (const key of highPriorityCommands) {
          const cmdGroup = fileCommandsRef.current[key];
          if (!cmdGroup) continue;
          
          const allAliases = [t(key, lang), ...cmdGroup.aliases, ...(getAllAliases(key)[lang] || [])];
          for (const alias of [...new Set(allAliases)]) {
               if (calculateSimilarity(commandLower, alias) > 0.8 || commandText.toLowerCase() === alias) {
                   speak(t(cmdGroup.reply, lang), lang, () => commandActionsRef.current[key]({ lang }));
                   resetAllContext();
                   return;
              }
          }
      }
      
      // --- PRIORITY 2: Smart Order command (isolated check) ---
      const actionKeywords = ['order', 'send', 'buy', 'get'];
      const locationKeywords = ['from', 'to'];
      const hasAction = actionKeywords.some(kw => commandLower.includes(kw));
      const hasLocation = locationKeywords.some(kw => commandLower.includes(kw));

      if (hasAction && hasLocation) {
          await commandActionsRef.current.smartOrder(commandLower, lang);
          resetAllContext();
          return;
      }

      // --- PRIORITY 3: CONTEXTUAL REPLIES (Checkout, Forms, etc.) ---
      if (isWaitingForAddressType) {
        const cmd = commandLower;
        const homeKeywords = ['home', 'address', 'గృహ', 'మనె', 'घर', 'पता'];
        const locationKeywords = ['current', 'location', 'ప్రస్తుత', 'స్థానం', 'वर्तमान', 'स्थान'];
        
        if (homeKeywords.some(keyword => cmd.includes(keyword))) {
          homeAddressBtnRef?.current?.click();
          speak(t('setting-delivery-to-home-speech', lang), lang);
        } else if (locationKeywords.some(keyword => cmd.includes(keyword))) {
          currentLocationBtnRef?.current?.click();
          speak(t('using-current-location-speech', lang), lang);
        } else {
          speak(t('did-not-understand-address-type-speech', lang), lang);
        }
        resetAllContext();
        return;
      }

      if (isWaitingForVoiceOrder) {
        await commandActionsRef.current.createVoiceOrder(commandLower, lang);
        resetAllContext();
        return;
      }

      if (isWaitingForQuickOrderConfirmation) {
        const confirmKeywords = ['confirm', 'confirm order', 'place order', 'yes', 'అవును', 'సమర్థించు', 'हाँ', 'पुष्टि'];
        if (confirmKeywords.some(keyword => commandLower.includes(keyword))) {
          placeOrderBtnRef?.current?.click();
          speak(t('placing-your-order-now-speech', lang), lang);
        } else {
          speak(t('cancelling-the-order-speech', lang), lang);
          clearCart();
          router.push('/stores');
        }
        resetAllContext();
        return;
      }

      if (isWaitingForQuantity && itemToUpdateSkuRef.current) {
        const numberWords: Record<string, number> = { 
          'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
          'ఒకటి': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'ఐదు': 5, 'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9, 'పది': 10,
          'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10
        };
        const parts = commandLower.split(' ');
        let quantity: number | null = null;
        const firstWordAsNum = numberWords[parts[0]];
        if (firstWordAsNum) {
          quantity = firstWordAsNum;
        } else {
          const parsedNum = parseInt(commandLower.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(parsedNum)) {
            quantity = parsedNum;
          }
        }

        if (quantity !== null && quantity > 0) {
          updateQuantity(itemToUpdateSkuRef.current, quantity);
          speak(t('okay-updated-to-quantity-speech', lang).replace('{quantity}', `${quantity}`), lang);
        } else {
          speak(t('did-not-catch-quantity-speech', lang), lang);
        }
        
        resetAllContext();
        return;
      }

      if (isWaitingForStoreName && pathname === '/checkout') {
        const spokenStoreName = commandLower;
        const bestMatch = stores
          .map(store => ({ 
              store, 
              engSim: calculateSimilarity(spokenStoreName, store.name.toLowerCase()),
              teluguSim: store.teluguName ? calculateSimilarity(spokenStoreName, store.teluguName.toLowerCase()) : 0
            }))
          .sort((a, b) => Math.max(b.engSim, b.teluguSim) - Math.max(a.engSim, a.teluguSim))[0];

        if (bestMatch && Math.max(bestMatch.engSim, bestMatch.teluguSim) > 0.6) {
          speak(t('okay-ordering-from-speech', lang).replace('{storeName}', bestMatch.store.name), lang);
          setActiveStoreId(bestMatch.store.id);
        } else {
          speak(t('could-not-find-store-speech', lang).replace('{storeName}', commandText), lang);
        }
        resetAllContext();
        return;
      }

      if (formFieldToFillRef.current && profileForm) {
        profileForm.setValue(formFieldToFillRef.current, commandText, { shouldValidate: true });
        formFieldToFillRef.current = null;
        handleProfileFormInteraction();
        return;
      }
      
      // --- PRIORITY 4: General Commands & Fallbacks ---
      
      const allCommands = [...commandsRef.current];
      for (const key in fileCommandsRef.current) {
        const cmdGroup = fileCommandsRef.current[key];
        const action = commandActionsRef.current[key];
        if (action) {
          cmdGroup.aliases.forEach((alias: string) => {
            allCommands.push({
              command: alias,
              action: action,
              display: cmdGroup.display,
              reply: cmdGroup.reply
            });
          });
        }
      }
      
      let bestCommand: { command: Command, similarity: number } | null = null;

      for (const cmd of allCommands) {
        const similarity = calculateSimilarity(commandLower, cmd.command);
        if (!bestCommand || similarity > bestCommand.similarity) {
          bestCommand = { command: cmd, similarity };
        }
      }
      
      const isOrderItemCommand = fileCommandsRef.current.orderItem.aliases.some(alias => {
        const placeholderRegex = /{\w+}/g;
        const simplifiedAlias = alias.replace(placeholderRegex, '').trim();
        const simplifiedCommandText = commandLower.replace(/\d+\s*(kg|kilo|kilos|g|gm|gram|grams)?/i, '').trim();
        return calculateSimilarity(simplifiedCommandText, simplifiedAlias) > 0.6;
      });

      if (bestCommand && bestCommand.similarity > 0.7) {
        speak(t(bestCommand.command.reply, lang), lang, () => bestCommand!.command.action({lang: lang}));
        resetAllContext();
      } else {
          // New logic: Check if it's an item order even without a direct command match
          if (isOrderItemCommand) {
              await commandActionsRef.current.orderItem({ phrase: commandLower, lang });
          } else {
              const { product } = await findProductAndVariant(commandLower);
              if (product) {
                  await commandActionsRef.current.orderItem({ phrase: commandLower, lang });
              } else {
                  speak(t('sorry-i-didnt-understand-that', lang), lang);
              }
          }
          resetAllContext();
      }

    } catch(e) {
      console.error("Voice command execution failed:", e);
      onStatusUpdate(`⚠️ Action failed. Please try again.`);
      speak("Sorry, I couldn't do that. Please check your connection and try again.", 'en-IN');
      onSuggestions([]);
    }
  }, [
    firestore, user, detectLanguage, updateRecognitionLanguage, speak, onStatusUpdate, onSuggestions, resetAllContext,
    isWaitingForAddressType, homeAddressBtnRef, currentLocationBtnRef, isWaitingForVoiceOrder, 
    isWaitingForQuickOrderConfirmation, placeOrderBtnRef, clearCart, router, isWaitingForQuantity, 
    updateQuantity, isWaitingForStoreName, pathname, stores, setActiveStoreId, profileForm, 
    handleProfileFormInteraction, findProductAndVariant, 
  ]);


  useEffect(() => {
    if (!recognition) {
      onStatusUpdate("Speech recognition not supported by this browser.");
      return;
    }

    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      onStatusUpdate(`Listening... (${currentLanguage})`);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      console.log('Recognized:', transcript, 'Language:', currentLanguage);
      handleCommand(transcript);
    };

    recognition.onerror = (event) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech' && event.error !== 'not-allowed') {
        console.error('Speech recognition error', event.error);
        onStatusUpdate(`⚠️ Error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (isEnabledRef.current && !isSpeakingRef.current) {
        setTimeout(() => {
          if(isEnabledRef.current && !isSpeakingRef.current) {
            try {
              recognition?.start();
            } catch (e) {
              console.warn("Recognition restart failed, possibly due to rapid succession.", e);
            }
          }
        }, 250);
      }
    };

    commandActionsRef.current = {
      home: () => router.push('/'),
      stores: () => router.push('/stores'),
      dashboard: () => router.push('/dashboard'),
      cart: () => router.push('/cart'),
      orders: () => router.push('/dashboard/customer/my-orders'),
      deliveries: () => router.push('/dashboard/delivery/deliveries'),
      myStore: () => router.push('/dashboard/owner/my-store'),
      checkout: (params: { lang: string }) => {
        const lang = params.lang || currentLanguage;
        if (cartItems.length > 0) {
           const speech = t('your-total-is-speech', lang).replace('{total}', `₹${cartTotal.toFixed(2)}`);
          speak(speech, lang, () => {
            onCloseCart();
            router.push('/checkout');
          });
        } else {
          speak(t('your-cart-is-empty-speech', lang), lang);
        }
      },
      homeAddress: () => {
        if(pathname === '/checkout' && homeAddressBtnRef?.current) {
          homeAddressBtnRef.current.click();
        }
      },
      currentLocation: () => {
        if(pathname === '/checkout' && currentLocationBtnRef?.current) {
          currentLocationBtnRef.current.click();
        }
      },
      recordOrder: (params: {lang: string}) => {
        const lang = params.lang || currentLanguage;
        speak(t('im-ready-for-order-speech', lang), lang);
        setIsWaitingForVoiceOrder(true);
      },
      createVoiceOrder: async (list: string, lang: string) => {
        if (!firestore || !user || !userProfileRef.current) {
          speak(t('cannot-create-order-no-profile-speech', lang), lang);
          return;
        }

        const voiceOrderData = {
          userId: user.uid,
          orderDate: serverTimestamp(),
          status: 'Pending' as 'Pending',
          deliveryAddress: userProfileRef.current.address,
          translatedList: list,
          customerName: `${userProfileRef.current.firstName} ${userProfileRef.current.lastName}`,
          phone: userProfileRef.current.phoneNumber,
          email: user.email,
          totalAmount: 0,
          items: [],
        };
        
        try {
          const colRef = collection(firestore, 'orders');
          await addDoc(colRef, voiceOrderData);
          speak(t('sent-list-to-stores-speech', lang), lang, () => {
            router.push('/dashboard/customer/my-orders');
          });
        } catch (e) {
          console.error("Error creating voice order:", e);
          speak(t('failed-to-create-voice-order-speech', lang), lang);
          const permissionError = new FirestorePermissionError({
            path: 'orders',
            operation: 'create',
            requestResourceData: voiceOrderData,
          });
          errorEmitter.emit('permission-error', permissionError);
        }
      },
      placeOrder: (params) => {
        const lang = params?.lang || currentLanguage;
        if (pathname === '/checkout') {
          if (placeOrderBtnRef?.current) {
            placeOrderBtnRef.current.click();
            speak(t('placing-your-order-now-speech', lang), lang);
          } else if (checkoutReady) {
            speak(t('trying-to-place-order-speech', lang), lang);
          } else {
            speak(t('complete-checkout-steps-speech', lang), lang);
          }
          return;
        }
        
        if (cartItems.length > 0) {
          speak(t('taking-you-to-checkout-speech', lang), lang, () => router.push('/checkout'));
          return;
        }
        
        speak(t('your-cart-is-empty-speech', lang), lang);
      },
      saveChanges: (params) => {
        const lang = params?.lang || currentLanguage;
        if (pathname === '/dashboard/customer/my-profile' && profileForm) {
            if (typeof document !== 'undefined') {
                const formElement = document.querySelector('form');
                if (formElement) formElement.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
        } else {
          speak(t('no-changes-to-save-speech', lang), lang);
        }
      },
      refresh: (params) => {
        const lang = params?.lang || currentLanguage;
        speak(t('refreshing-speech', lang), lang, () => window.location.reload());
      },
      orderItem: async ({ phrase, lang }: { phrase?: string; lang: string }) => {
        if (!phrase) return;

        let mutablePhrase = phrase.toLowerCase();
        const addedItems: string[] = [];
        const notFoundItems: string[] = [];
        let shouldContinue = true;

        while(shouldContinue) {
            shouldContinue = false;
            let bestMatch: { product: Product, variant: ProductVariant, alias: string } | null = null;
            let bestMatchLength = 0;

            for (const product of masterProducts) {
                if (!product.name) continue;
                const aliases = [product.name.toLowerCase(), ...Object.values(getAllAliases(product.name.toLowerCase().replace(/ /g, '-'))).flat().map(name => name.toLowerCase())];
                
                for (const alias of [...new Set(aliases)]) {
                    if (mutablePhrase.includes(alias) && alias.length > bestMatchLength) {
                        const { variant } = await findProductAndVariant(alias);
                        if (variant) {
                            bestMatch = { product, variant, alias };
                            bestMatchLength = alias.length;
                        }
                    }
                }
            }

            if (bestMatch) {
                const { product, variant, alias } = bestMatch;
                addItemToCart(product, variant, 1);
                const productName = t(product.name.toLowerCase().replace(/ /g, '-'), lang);
                addedItems.push(productName);
                
                mutablePhrase = mutablePhrase.replace(alias, '').trim();
                if(mutablePhrase.length > 0) {
                    shouldContinue = true;
                }
            }
        }

        const remainingWords = mutablePhrase.split(/,?\s+(?:and|మరియు|और)\s+|,|\s+/).filter(s => s.trim().length > 0);
        if (remainingWords.length > 0) {
            notFoundItems.push(...remainingWords);
        }

        let messageParts: string[] = [];
        if (addedItems.length > 0) {
            messageParts.push(t('ive-added-to-your-cart', lang).replace('{items}', addedItems.join(', ')));
            onOpenCart();
        }
        if (notFoundItems.length > 0) {
            messageParts.push(t('but-i-couldnt-find', lang).replace('{items}', notFoundItems.join(', ')));
        }
        
        if (messageParts.length > 0) {
            const message = addedItems.length > 0 && notFoundItems.length > 0 
                ? messageParts.join(' ') 
                : messageParts[0];
            speak(message, lang);
        } else if (phrase) {
             speak(t('sorry-i-couldnt-find-any-items', lang), lang);
        }
    },
    smartOrder: async (command: string, lang: string) => {
        let remainingCommand = command.toLowerCase();

        // Check if it's an explicit "order" command
        const isDirectOrder = ['order', 'buy'].some(kw => remainingCommand.startsWith(kw));

        // 1. Find Store
        let bestStoreMatch: { store: Store, similarity: number } | null = null;
        for (const store of stores) {
            const storeNameLower = store.name.toLowerCase();
            const teluguNameLower = store.teluguName?.toLowerCase();

            if (remainingCommand.includes(storeNameLower)) {
                const similarity = calculateSimilarity(remainingCommand, storeNameLower);
                if (!bestStoreMatch || similarity > bestStoreMatch.similarity) {
                    bestStoreMatch = { store, similarity };
                }
            }
            if (teluguNameLower && remainingCommand.includes(teluguNameLower)) {
                 const similarity = calculateSimilarity(remainingCommand, teluguNameLower);
                if (!bestStoreMatch || similarity > bestStoreMatch.similarity) {
                    bestStoreMatch = { store, similarity };
                }
            }
        }
        if (bestStoreMatch) {
            const nameToRemove = bestStoreMatch.store.teluguName && remainingCommand.includes(bestStoreMatch.store.teluguName.toLowerCase()) 
                ? bestStoreMatch.store.teluguName.toLowerCase() 
                : bestStoreMatch.store.name.toLowerCase();
            remainingCommand = remainingCommand.replace(nameToRemove, '').trim();
        }

        // 2. Find Destination ("to home")
        let destination: 'home' | null = null;
        const homeKeywords = ['to home', 'at home', 'home address'];
        if (homeKeywords.some(kw => remainingCommand.includes(kw))) {
            destination = 'home';
            homeKeywords.forEach(kw => {
                remainingCommand = remainingCommand.replace(kw, '');
            });
        }

        // 3. Find Product and Variant (from the remaining text)
        const { product, variant } = await findProductAndVariant(remainingCommand);

        // 4. Validate and Execute
        if (!product || !variant) {
            speak(t('could-not-find-product-in-order-speech', lang), lang);
            return;
        }
        if (!bestStoreMatch) {
            speak(t('could-not-identify-store-speech', lang), lang);
            return;
        }
        if (destination === 'home' && (!userProfileRef.current || !userProfileRef.current.address)) {
            speak(t('cannot-deliver-home-no-address-speech', lang), lang, () => {
              router.push('/dashboard/customer/my-profile');
            });
            return;
        }

        // --- Optimistic UI Flow ---
        const qty = remainingCommand.match(/\d+/)?.[0] || '1';
        const translatedProductName = getProductName(product);
        const speech = t('preparing-order-speech', lang)
            .replace('{qty}', qty)
            .replace('{productName}', translatedProductName)
            .replace('{storeName}', bestStoreMatch.store.name);
        speak(speech, lang);

        clearCart();
        addItemToCart(product, variant, 1);
        setActiveStoreId(bestStoreMatch.store.id);

        if (destination === 'home' && userProfileRef.current?.address) {
            useCheckoutStore.getState().setHomeAddress(userProfileRef.current.address);
        } else {
             useCheckoutStore.getState().setHomeAddress(null);
        }

        // Set state based on command type
        if (isDirectOrder) {
            setShouldPlaceOrderDirectly(true);
        } else {
            setIsWaitingForQuickOrderConfirmation(true);
        }

        router.push('/checkout');
    },
    };

    if (firestore && user) {
        const userDocRef = doc(firestore, 'users', user.uid);
        getDoc(userDocRef).then(docSnap => {
            if (docSnap.exists()) userProfileRef.current = docSnap.data() as User;
        });
        
        getCommands().then((fileCommands) => {
            fileCommandsRef.current = fileCommands;
        }).catch(console.error);
    }


    return () => {
      if (recognition) {
        recognition.onend = null;
        recognition.abort();
      }
    };
  }, [handleCommand]);

  return null;
}

    