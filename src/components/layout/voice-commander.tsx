

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, errorEmitter } from '@/firebase';
import type { Store, Product, ProductPrice, CartItem, User, FailedVoiceCommand } from '@/lib/types';
import { calculateSimilarity } from '@/lib/calculate-similarity';
import { useCart } from '@/lib/cart';
import { useAppStore, useProfileFormStore } from '@/lib/store';
import { ProfileFormValues } from '@/app/dashboard/customer/my-profile/page';
import { useCheckoutStore } from '@/app/checkout/page';
import { getCommands } from '@/app/actions';
import { t, getAllAliases } from '@/lib/locales';
import { doc, getDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import groceryData from '@/lib/grocery-data.json';


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

// Model C: Hybrid AI - Category keywords for fast, targeted search
const CATEGORY_KEYWORDS: Record<string, string[]> = groceryData.categories.reduce((acc, cat) => {
    const key = cat.categoryName;
    // Add aliases from locales.json for each category
    const catSlug = key.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
    const aliases = getAllAliases(catSlug);
    const allTerms = [key.toLowerCase(), ...Object.values(aliases).flat().map(a => a.toLowerCase())];
    acc[key] = [...new Set(allTerms)]; // Ensure unique keywords
    return acc;
}, {} as Record<string, string[]>);


export function VoiceCommander({
  enabled,
  onStatusUpdate,
  onSuggestions,
  onOpenCart,
  onCloseCart,
  isCartOpen,
  cartItems: cartItemsProp,
  voiceTrigger,
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
    setShouldPlaceOrderDirectly,
    setHomeAddress 
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
             // Also handle cases where keyword is the whole command e.g., "Home" or "naaku"
            if (lowerText === keyword) {
                 setCurrentLanguage(lang.lang);
                 return {
                    lang: lang.lang,
                    command: lowerText // Keep the command to match aliases
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

  const runCheckoutPrompt = useCallback(() => {
    if (pathname !== '/checkout' || !hasMounted || !enabled || isSpeakingRef.current) {
      return;
    }

    if (hasSpokenCheckoutPrompt.current) return;

    const addressInput = typeof document !== 'undefined' ? (document.querySelector('input[name="deliveryAddress"]') as HTMLInputElement) : null;
    const currentAddress = addressInput?.value || '';

    if (isWaitingForQuickOrderConfirmation) {
        speak(t('confirm-the-quick-order-speech', currentLanguage), currentLanguage);
    } else if (cartItemsProp.length === 0) {
        speak(t('your-cart-is-empty-speech', currentLanguage), currentLanguage);
    } else if (!currentAddress || currentAddress.length < 10) {
        speak(t('should-i-deliver-to-home-or-current-speech', currentLanguage), currentLanguage);
        setIsWaitingForAddressType(true);
    } else if (!activeStoreId) {
        speak(t('which-store-should-fulfill-speech', currentLanguage), currentLanguage);
        setIsWaitingForStoreName(true);
    } else {
        const speech = t('everything-is-ready-speech', currentLanguage).replace('{address}', currentAddress);
        speak(speech, currentLanguage);
    }
    
    hasSpokenCheckoutPrompt.current = true;
  }, [
    pathname, hasMounted, enabled, isSpeakingRef.current, isWaitingForQuickOrderConfirmation, 
    cartItemsProp.length, activeStoreId, currentLanguage, speak, setIsWaitingForAddressType, setIsWaitingForStoreName
  ]);
  
  useEffect(() => {
      hasSpokenCheckoutPrompt.current = false;
  }, [pathname]);

  // This effect runs when the page loads, or when the voice is triggered manually
  useEffect(() => {
    if (pathname === '/checkout' && hasMounted && enabled) {
        // Reset the flag whenever the trigger fires to allow re-prompting
        hasSpokenCheckoutPrompt.current = false;
        const timeoutId = setTimeout(() => {
            runCheckoutPrompt();
        }, 1000); // Add a small delay to allow page to settle
        return () => clearTimeout(timeoutId);
    }
  }, [pathname, hasMounted, enabled, voiceTrigger, runCheckoutPrompt]);


  useEffect(() => {
    if (pathname !== '/dashboard/customer/my-profile' || !hasMounted || !enabled) {
      hasSpokenCheckoutPrompt.current = false;
      formFieldToFillRef.current = null;
      return;
    }
    let speakTimeout: NodeJS.Timeout | null = null;
    if (!hasSpokenCheckoutPrompt.current && profileForm) {
      speakTimeout = setTimeout(() => {
        handleProfileFormInteraction();
        hasSpokenCheckoutPrompt.current = true;
      }, 1500);
    }
    return () => {
      if (speakTimeout) {
        clearTimeout(speakTimeout);
      }
    };
  }, [pathname, hasMounted, enabled, profileForm, handleProfileFormInteraction]);

  const findProductAndVariant = useCallback(async (phrase: string): Promise<{ product: Product | null; variant: ProductPrice['variants'][0] | null; requestedQty: number; remainingPhrase: string; }> => {
    const lowerPhrase = phrase.toLowerCase();
    let bestMatch: { product: Product, alias: string, similarity: number } | null = null;
    
    let productsToSearch = masterProducts;

    // 1. Find best product match
    for (const p of productsToSearch) {
        if (!p.name) continue;
        const aliases = [p.name.toLowerCase(), ...Object.values(getAllAliases(p.name.toLowerCase().replace(/ /g, '-'))).flat().map(a => a.toLowerCase())];
        for (const alias of [...new Set(aliases)]) {
            if (lowerPhrase.includes(alias)) {
                const similarity = calculateSimilarity(lowerPhrase, alias);
                if (!bestMatch || similarity > bestMatch.similarity) {
                    bestMatch = { product: p, alias, similarity };
                }
            }
        }
    }
    
    if (!bestMatch) return { product: null, variant: null, requestedQty: 1, remainingPhrase: phrase };

    const productMatch = bestMatch.product;
    let remainingPhrase = lowerPhrase.replace(bestMatch.alias, '').trim();

    // 2. Fetch price data if needed
    let priceData = productPrices[productMatch.name.toLowerCase()];
    if (priceData === undefined && firestore) {
        await fetchProductPrices(firestore, [productMatch.name]);
        priceData = useAppStore.getState().productPrices[productMatch.name.toLowerCase()];
    }
    
    if (!priceData?.variants?.length) return { product: productMatch, variant: null, requestedQty: 1, remainingPhrase };

    // 3. Determine quantity and weight
    const numberWords: Record<string, number> = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'ఒకటి': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'ఐదు': 5, 'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9, 'పది': 10, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10 };
    const weightRegex = new RegExp(`(${Object.keys(numberWords).join('|')}|\\d+)\\s*(kg|kilo|kilos|కేజీ|కిలో|gm|g|grams|గ్రాములు|pc|piece|pack|ప్యాక్)`, 'i');
    const weightMatch = remainingPhrase.match(weightRegex);

    let requestedQty = 1;
    let desiredWeightInGrams = 0;
    
    if (weightMatch) {
      const numStr = weightMatch[1].toLowerCase();
      const quantity = numberWords[numStr] || parseInt(numStr, 10);
      const unit = weightMatch[2].toLowerCase();

      const isKilo = ['kg', 'kilo', 'kilos', 'కేజీ', 'కిలో'].includes(unit);
      const isGram = ['gm', 'g', 'grams', 'గ్రాములు'].includes(unit);
      
      if(isKilo) {
        desiredWeightInGrams = quantity * 1000;
      } else if (isGram) {
        desiredWeightInGrams = quantity;
      } else { // It's a quantity of a pack/piece
        requestedQty = quantity;
      }
      remainingPhrase = remainingPhrase.replace(weightMatch[0], '').trim();
    } else if (['kilo', 'kg', 'కేజీ'].some(k => remainingPhrase.includes(k))) {
      desiredWeightInGrams = 1000; // Default to 1kg if unit is mentioned without number
    }
    
    // 4. Find best variant
    let chosenVariant: ProductPrice['variants'][0] | null = null;
    if (priceData.variants) {
      if (desiredWeightInGrams > 0) {
        let bestVariantMatch: { variant: ProductVariant, diff: number } | null = null;
        for (const v of priceData.variants) {
          const variantWeightMatch = v.weight.match(/(\d+)(kg|gm|g)/);
          if (variantWeightMatch) {
            const variantWeightNum = parseInt(variantWeightMatch[1]);
            const variantUnit = variantWeightMatch[2];
            const variantWeightInGrams = variantUnit.startsWith('k') ? variantWeightNum * 1000 : variantWeightNum;
            const diff = Math.abs(desiredWeightInGrams - variantWeightInGrams);
            if (!bestVariantMatch || diff < bestVariantMatch.diff) {
              bestVariantMatch = { variant: v, diff };
            }
          }
        }
        if (bestVariantMatch) {
          chosenVariant = bestVariantMatch.variant;
          // Adjust quantity if a larger pack was chosen for a smaller weight
          const chosenWeightInGrams = parseInt(chosenVariant.weight.replace(/[^0-9]/g, '')) * (chosenVariant.weight.includes('kg') ? 1000 : 1);
          requestedQty = Math.max(1, Math.round(desiredWeightInGrams / chosenWeightInGrams));
        }
      }
      
      // Default fallback
      if (!chosenVariant) {
        chosenVariant = priceData.variants.find(v => v.weight === '1kg') || priceData.variants.find(v => v.weight === '1 pc') || priceData.variants[0];
      }
    }
    
    return { product: productMatch, variant: chosenVariant, requestedQty, remainingPhrase };
  }, [firestore, masterProducts, productPrices, fetchProductPrices]);

  const handleCommand = useCallback(async (commandText: string) => {
    onStatusUpdate(`Processing: "${commandText}"`);
    try {
      if (!firestore || !user) return;
      
      let { lang, command: strippedCommand } = detectLanguage(commandText);
      
      if (lang !== currentLanguage) {
          setCurrentLanguage(lang);
          updateRecognitionLanguage(lang);
          const isJustLangKeyword = ['naaku', 'naku', 'నాకు', 'mujhe', 'मुझे'].includes(commandText.toLowerCase());
          if (isJustLangKeyword) {
              speak(t('telugu-welcome-speech', lang), lang);
              resetAllContext();
              return;
          }
      }
      
      const commandLower = strippedCommand.toLowerCase();

      // --- Contextual High-Priority Commands ---
      if (pathname === '/checkout') {
          const placeOrderAliases = [t('placeOrder', lang), ...Object.values(getAllAliases('placeOrder')).flat()];
          for (const alias of [...new Set(placeOrderAliases)]) {
              if (calculateSimilarity(commandLower, alias) > 0.8 || commandText.toLowerCase() === alias) {
                  commandActionsRef.current.placeOrder({ lang });
                  resetAllContext();
                  return;
              }
          }
      }


      // --- PRIORITY 1: High-priority global navigation ---
      const highPriorityCommands = ["home", "stores", "dashboard", "cart", "orders", "deliveries", "myStore", "refresh"];
      for (const key of highPriorityCommands) {
          const cmdGroup = fileCommandsRef.current[key];
          if (!cmdGroup) continue;
          
          const allAliases = [t(key, lang), ...Object.values(getAllAliases(key)).flat(), ...(cmdGroup.aliases || [])];

          for (const alias of [...new Set(allAliases)]) {
               if (calculateSimilarity(commandLower, alias) > 0.8 || commandText.toLowerCase() === alias) {
                   const action = commandActionsRef.current[key];
                   if (action) {
                       action({ lang });
                   }
                   resetAllContext();
                   return;
              }
          }
      }
      
      // PRIORITY 1.5: Checkout is special because it needs to speak before navigating
      const checkoutAliases = [t('checkout', lang), ...Object.values(getAllAliases('checkout')).flat()];
      for (const alias of [...new Set(checkoutAliases)]) {
          if (calculateSimilarity(commandLower, alias) > 0.8 || commandText.toLowerCase() === alias) {
              await commandActionsRef.current.checkout({ lang });
              resetAllContext();
              return;
          }
      }

       // --- PRIORITY 2: Smart Order command (isolated check) ---
      const actionKeywords = ['order', 'send', 'buy', 'get', 'want', 'need'];
      const locationKeywords = ['from', 'to'];
      const hasAction = actionKeywords.some(kw => commandLower.startsWith(kw));
      const hasLocation = locationKeywords.some(kw => commandLower.includes(kw));

      if (hasAction && hasLocation) {
          await commandActionsRef.current.smartOrder(commandLower, lang, commandText);
          resetAllContext();
          return;
      }

      // --- PRIORITY 3: CONTEXTUAL REPLIES (Checkout, Forms, etc.) ---
      if (isWaitingForAddressType) {
        const cmd = commandLower;
        const homeKeywords = ['home', 'address', 'గృహ', 'మనె', 'घर', 'पता'];
        const locationKeywords = ['current', 'location', 'ప్రస్తుత', 'స్థానం', 'वर्तमान', 'स्थान'];
        
        let actionTaken = false;
        if (homeKeywords.some(keyword => cmd.includes(keyword))) {
          homeAddressBtnRef?.current?.click();
          speak(t('setting-delivery-to-home-speech', lang), lang);
          actionTaken = true;
        } else if (locationKeywords.some(keyword => cmd.includes(keyword))) {
          currentLocationBtnRef?.current?.click();
          speak(t('using-current-location-speech', lang), lang);
           actionTaken = true;
        } else {
          speak(t('did-not-understand-address-type-speech', lang), lang);
        }
        
        if (actionTaken) {
            setIsWaitingForAddressType(false);
            // Re-trigger the prompt after a short delay to allow page to settle
            setTimeout(() => {
                hasSpokenCheckoutPrompt.current = false;
                runCheckoutPrompt();
            }, 1500);
        }
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
          let bestMatch: { store: Store, similarity: number } | null = null;

          for (const store of stores) {
              const storeKey = store.name.toLowerCase().replace(/ /g, '-');
              const aliases = getAllAliases(storeKey);
              
              const termsToSearch = [store.name.toLowerCase()];
              if (store.teluguName) termsToSearch.push(store.teluguName.toLowerCase());
              if (aliases.en) termsToSearch.push(...aliases.en.map(a => a.toLowerCase()));
              if (aliases.te) termsToSearch.push(...aliases.te.map(a => a.toLowerCase()));

              for (const term of [...new Set(termsToSearch)]) {
                  const similarity = calculateSimilarity(spokenStoreName, term);
                  if (!bestMatch || similarity > bestMatch.similarity) {
                      bestMatch = { store, similarity };
                  }
              }
          }

          if (bestMatch && bestMatch.similarity > 0.6) {
              speak(t('okay-ordering-from-speech', lang).replace('{storeName}', bestMatch.store.name), lang, () => {
                setActiveStoreId(bestMatch.store.id);
                // Re-trigger the prompt after a short delay to allow page to settle
                setTimeout(() => {
                  hasSpokenCheckoutPrompt.current = false;
                  runCheckoutPrompt();
                }, 1500);
              });
          } else {
              speak(t('could-not-find-store-speech', lang).replace('{storeName}', commandText), lang);
          }
          setIsWaitingForStoreName(false);
          return;
      }

      if (formFieldToFillRef.current && profileForm) {
        profileForm.setValue(formFieldToFillRef.current, commandText, { shouldValidate: true });
        formFieldToFillRef.current = null;
        handleProfileFormInteraction();
        return;
      }
      
      // --- PRIORITY 4: Multi-Item Order ---
      const multiItemSeparators = / and | , | and then | then /i;
      if (commandLower.match(multiItemSeparators)) {
          const items = commandLower.split(multiItemSeparators);
          await commandActionsRef.current.orderMultipleItems(items, lang, commandText);
          return;
      }

      // --- PRIORITY 5: General Commands & Single Item Fallback ---
      const allCommands = [...commandsRef.current];
      for (const key in fileCommandsRef.current) {
        const cmdGroup = fileCommandsRef.current[key];
        const action = commandActionsRef.current[key];
        if (action) {
            const allAliases = [t(key, lang), ...Object.values(getAllAliases(key)).flat(), ...(cmdGroup.aliases || [])];
             (allAliases || []).forEach((alias: string) => {
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
        if (!cmd.command) continue;
        const similarity = calculateSimilarity(commandLower, cmd.command);
        if (!bestCommand || similarity > bestCommand.similarity) {
          bestCommand = { command: cmd, similarity };
        }
      }
      
      if (bestCommand && bestCommand.similarity > 0.7) {
        const action = bestCommand.command.action;
        if(action) action({lang: lang});
        if(bestCommand.command.reply){
            speak(t(bestCommand.command.reply, lang), lang);
        }
        resetAllContext();
      } else {
          // Fallback to single order item logic
          await commandActionsRef.current.orderItem({ phrase: commandLower, lang, originalText: commandText });
      }

    } catch(e) {
      console.error("Voice command execution failed:", e);
      onStatusUpdate(`⚠️ Action failed. Please try again.`);
      speak("Sorry, I couldn't do that. Please check your connection and try again.", 'en-IN');
      onSuggestions([]);
    }
  }, [
    firestore, user, detectLanguage, updateRecognitionLanguage, currentLanguage, speak, onStatusUpdate, onSuggestions, resetAllContext,
    isWaitingForAddressType, homeAddressBtnRef, currentLocationBtnRef, isWaitingForVoiceOrder, 
    isWaitingForQuickOrderConfirmation, placeOrderBtnRef, clearCart, router, isWaitingForQuantity, 
    updateQuantity, isWaitingForStoreName, pathname, stores, setActiveStoreId, profileForm, 
    handleProfileFormInteraction, findProductAndVariant, cartItemsProp, commandActionsRef, runCheckoutPrompt
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
      home: (params) => speak(t('navigating-to-home', params.lang), params.lang, () => router.push('/')),
      stores: (params) => speak(t('navigating-to-stores', params.lang), params.lang, () => router.push('/stores')),
      dashboard: (params) => speak(t('navigating-to-dashboard', params.lang), params.lang, () => router.push('/dashboard')),
      cart: (params) => speak(t('navigating-to-cart', params.lang), params.lang, () => router.push('/cart')),
      orders: (params) => speak(t('navigating-to-orders', params.lang), params.lang, () => router.push('/dashboard/customer/my-orders')),
      deliveries: (params) => speak(t('navigating-to-deliveries', params.lang), params.lang, () => router.push('/dashboard/delivery/deliveries')),
      myStore: (params) => speak(t('navigating-to-my-store', params.lang), params.lang, () => router.push('/dashboard/owner/my-store')),
      checkout: (params: { lang: string }) => {
        const lang = params.lang || currentLanguage;
        console.log('Checkout command - Using language:', lang, 'Params lang:', params.lang, 'Current lang:', currentLanguage);
        const total = cartTotal + 30; // Assuming 30 is delivery fee
        onCloseCart();
        if (cartTotal > 0) {
            const speechText = t('your-total-is-speech', lang).replace('{total}', `₹${total.toFixed(2)}`);
            console.log('Speaking checkout total:', speechText, 'in language:', lang);
            speak(speechText, lang, () => {
                router.push('/checkout')
            });
        } else {
            speak(t('your-cart-is-empty-speech', lang), lang);
        }
      },
      homeAddress: ({lang}) => {
        if(pathname === '/checkout' && homeAddressBtnRef?.current) {
          homeAddressBtnRef.current.click();
        }
      },
      currentLocation: ({lang}) => {
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
          } else {
            speak(t('complete-checkout-steps-speech', lang), lang);
          }
          return;
        }
        
        if (cartItemsProp.length > 0) {
          const total = cartTotal + 30; // Assuming 30 is delivery fee
          speak(t('your-total-is-speech', lang).replace('{total}', `₹${total.toFixed(2)}`), lang, () => router.push('/checkout'));
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
      orderItem: async ({ phrase, lang, originalText }: { phrase?: string; lang: string, originalText: string }) => {
        if (!phrase) return;

        const { product, variant, requestedQty } = await findProductAndVariant(phrase);

        if (product && variant) {
            const speech = t('adding-item-speech', lang)
                .replace('{quantity}', `${requestedQty}`)
                .replace('{productName}', product.name);
            speak(speech, lang);
            addItemToCart(product, variant, requestedQty);
            onOpenCart();
        } else if (product && !variant) {
            speak(`Sorry, I found ${product.name} but could not determine a price or size.`, lang);
            if (firestore && user) {
                const failedCommandData: Omit<FailedVoiceCommand, 'id' | 'timestamp'> = {
                    userId: user.uid,
                    commandText: originalText,
                    language: lang,
                    reason: `Product found, but no matching variant/price for "${phrase}"`
                };
                addDoc(collection(firestore, 'failedCommands'), { ...failedCommandData, timestamp: serverTimestamp() }).catch(e => console.error("Could not log failed command:", e));
            }
        } else {
             speak(t('sorry-i-didnt-understand-that', lang), lang);
             if (firestore && user) {
                const failedCommandData: Omit<FailedVoiceCommand, 'id' | 'timestamp'> = {
                    userId: user.uid,
                    commandText: originalText,
                    language: lang,
                    reason: 'No matching product or command alias found'
                };
                addDoc(collection(firestore, 'failedCommands'), { ...failedCommandData, timestamp: serverTimestamp() }).catch(e => console.error("Could not log failed command:", e));
             }
        }
        resetAllContext();
    },
    orderMultipleItems: async (phrases: string[], lang: string, originalText: string) => {
        let addedItems: string[] = [];
        let failedItems: string[] = [];

        for (const phrase of phrases) {
            if (!phrase.trim()) continue;
            const { product, variant, requestedQty } = await findProductAndVariant(phrase);
            if (product && variant) {
                addItemToCart(product, variant, requestedQty);
                addedItems.push(`${requestedQty} ${product.name}`);
            } else {
                failedItems.push(phrase);
            }
        }

        let speech = "";
        if (addedItems.length > 0) {
            speech += t('ive-added-to-your-cart', lang).replace('{items}', addedItems.join(', '));
            onOpenCart();
        }
        if (failedItems.length > 0) {
            if (speech) speech += " ";
            speech += t('but-i-couldnt-find', lang).replace('{items}', failedItems.join(', '));
        }
        if (!speech) {
            speech = t('sorry-i-couldnt-find-any-items', lang);
             if (firestore && user) {
                addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: originalText, language: lang, reason: 'Multi-item match failed', timestamp: serverTimestamp() });
            }
        }
        speak(speech, lang);
        resetAllContext();
    },
    smartOrder: async (command: string, lang: string, originalText: string) => {
        let remainingCommand = command.toLowerCase();

        // 1. Find Store
        let bestStoreMatch: { store: Store, similarity: number, term: string } | null = null;
        for (const store of stores) {
            const storeNameLower = store.name.toLowerCase();
            const teluguNameLower = store.teluguName?.toLowerCase();
            const storeKey = store.name.toLowerCase().replace(/ /g, '-');
            const aliases = getAllAliases(storeKey);
              
            const termsToSearch = [storeNameLower];
            if (teluguNameLower) termsToSearch.push(teluguNameLower);
            if (aliases.en) termsToSearch.push(...aliases.en.map(a => a.toLowerCase()));
            if (aliases.te) termsToSearch.push(...aliases.te.map(a => a.toLowerCase()));

            for (const term of [...new Set(termsToSearch)]) {
                if (remainingCommand.includes(term)) {
                    const similarity = calculateSimilarity(remainingCommand, term);
                    if (!bestStoreMatch || similarity > bestStoreMatch.similarity) {
                        bestStoreMatch = { store, similarity, term };
                    }
                }
            }
        }
        if (bestStoreMatch) {
            remainingCommand = remainingCommand.replace("from " + bestStoreMatch.term, '').trim();
        }

        // 2. Find Destination
        let destination: 'home' | null = null;
        const homeKeywords = ['to home', 'at home', 'my home', 'to my house'];
        const homeMatch = homeKeywords.find(kw => remainingCommand.includes(kw));
        if (homeMatch) {
            destination = 'home';
            remainingCommand = remainingCommand.replace(homeMatch, '').trim();
        }

        // 3. Find Product and Variant (from the remaining text)
        const { product, variant, requestedQty } = await findProductAndVariant(remainingCommand.replace(/^(order|buy|get|send|need|want)/, '').trim());

        // 4. Validate and Execute
        if (!product || !variant) {
            speak(t('could-not-find-product-in-order-speech', lang), lang);
            if(firestore && user) addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: originalText, language: lang, reason: `Smart order: product not found in "${remainingCommand}"`, timestamp: serverTimestamp() });
            return;
        }
        if (!bestStoreMatch) {
            speak(t('could-not-identify-store-speech', lang), lang);
             if(firestore && user) addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: originalText, language: lang, reason: 'Smart order: store not found', timestamp: serverTimestamp() });
            return;
        }
        if (destination === 'home' && (!userProfileRef.current || !userProfileRef.current.address)) {
            speak(t('cannot-deliver-home-no-address-speech', lang), lang, () => {
              router.push('/dashboard/customer/my-profile');
            });
            return;
        }

        // --- Optimistic UI Flow ---
        const speech = t('preparing-order-speech', lang)
            .replace('{qty}', `${requestedQty}`)
            .replace('{productName}', product.name)
            .replace('{storeName}', bestStoreMatch.store.name);
        speak(speech, lang);

        clearCart();
        addItemToCart(product, variant, requestedQty);
        setActiveStoreId(bestStoreMatch.store.id);

        if (destination === 'home' && userProfileRef.current?.address) {
            setHomeAddress(userProfileRef.current.address);
        } else {
             setHomeAddress(null);
        }

        setShouldPlaceOrderDirectly(true);
        router.push('/checkout');
    },
    };

    if (firestore && user) {
        const userDocRef = doc(firestore, 'users', user.uid);
        getDoc(userDocRef).then(docSnap => {
            if (docSnap.exists()) userProfileRef.current = docSnap.data() as User;
        });
        
        getCommands().then((fileCommands) => {
            if (fileCommands) {
                fileCommandsRef.current = fileCommands;
            }
        }).catch(console.error);
    }


    return () => {
      if (recognition) {
        recognition.onend = null;
        recognition.abort();
      }
    };
  }, [handleCommand, cartTotal, cartItemsProp, pathname]);

  useEffect(() => {
    console.log('Current language changed to:', currentLanguage);
  }, [currentLanguage]);

  return null;
}
