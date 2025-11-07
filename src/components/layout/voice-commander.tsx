
'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, errorEmitter } from '@/firebase';
import type { Store, Product, ProductPrice, CartItem, User, FailedVoiceCommand, ProductVariant } from '@/lib/types';
import { calculateSimilarity } from '@/lib/calculate-similarity';
import { useCart } from '@/lib/cart';
import { useAppStore, useProfileFormStore, useMyStorePageStore } from '@/lib/store';
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

type ProductAliasMap = Map<string, Product>;
type StoreAliasMap = Map<string, Store>;

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

  const { stores, masterProducts, productPrices, fetchInitialData, fetchProductPrices, getProductName, language, setLanguage } = useAppStore();

  const { form: profileForm } = useProfileFormStore();
  const { saveInventoryBtnRef } = useMyStorePageStore();
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
  
    // --- Performance Optimization: Memoized Alias Maps ---
  const productAliasMap = useMemo<ProductAliasMap>(() => {
    const map: ProductAliasMap = new Map();
    if (!masterProducts) return map;

    for (const p of masterProducts) {
      if (!p.name) continue;
      const productSlug = p.name.toLowerCase().replace(/ /g, '-');
      const aliases = getAllAliases(productSlug);
      const allTerms = [
        p.name.toLowerCase(),
        ...Object.values(aliases).flat().map(a => a.toLowerCase()),
      ];
      for (const term of [...new Set(allTerms)]) {
        if (term) map.set(term, p);
      }
    }
    return map;
  }, [masterProducts]);

  const storeAliasMap = useMemo<StoreAliasMap>(() => {
    const map: StoreAliasMap = new Map();
    if (!stores) return map;

    for (const s of stores) {
      const storeSlug = s.name.toLowerCase().replace(/ /g, '-');
      const aliases = getAllAliases(storeSlug);
      const allTerms = [
        s.name.toLowerCase(),
        ...(s.teluguName ? [s.teluguName.toLowerCase()] : []),
        ...Object.values(aliases).flat().map(a => a.toLowerCase()),
      ];
      for (const term of [...new Set(allTerms)]) {
        if (term) map.set(term, s);
      }
    }
    return map;
  }, [stores]);


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
  const detectLanguage = useCallback((text: string): { lang: string, command: string, languageSwitched: boolean } => {
    const lowerText = text.toLowerCase();
    const previousLang = language;

    // Specific keywords to force a language switch
    if (['english', 'in english', 'switch to english'].some(kw => lowerText.includes(kw))) {
        setLanguage('en');
        return { lang: 'en', command: lowerText, languageSwitched: previousLang !== 'en' };
    }
    if (['telugu', 'తెలుగు', 'తెలుగులో'].some(kw => lowerText.includes(kw))) {
        setLanguage('te');
        return { lang: 'te', command: lowerText, languageSwitched: previousLang !== 'te' };
    }


    const langKeywords = [
        { lang: 'te', keywords: ['naku', 'naaku', 'నాకు', 'కావాలి'] },
        { lang: 'hi', keywords: ['mujhe', 'मुझे'] },
        { lang: 'en', keywords: ['i want', 'i need', 'get me', 'add', 'get', 'buy', 'order', 'send', 'go', 'open', 'i'] }
    ];

    for (const lang of langKeywords) {
        if (lang.keywords.some(keyword => lowerText.includes(keyword))) {
            if (language !== lang.lang) {
                setLanguage(lang.lang);
            }
            return { lang: lang.lang, command: lowerText, languageSwitched: previousLang !== lang.lang };
        }
    }
    
    // Default case if no keyword is found, use the global language
    return { lang: language, command: lowerText, languageSwitched: false };
  }, [language, setLanguage]);

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
        recognition.lang = language === 'te' ? 'te-IN' : 'en-IN';
        recognition.continuous = true;
        try {
          recognition.start();
        } catch (e) {
          // Already started
        }
      } else {
        recognition.abort();
      }
    }
  }, [enabled, language]);

  const speak = useCallback((text: string, lang: string, onEndCallback?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      if (onEndCallback) onEndCallback();
      return;
    }

    window.speechSynthesis.cancel();
    isSpeakingRef.current = false;

    const langCode = lang.split('-')[0]; // 'en' from 'en-IN'
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
        speak(t('confirm-the-quick-order-speech', language), language);
    } else if (cartItemsProp.length === 0) {
        speak(t('your-cart-is-empty-speech', language), language);
    } else if (!currentAddress || currentAddress.length < 10) {
        speak(t('should-i-deliver-to-home-or-current-speech', language), language);
        setIsWaitingForAddressType(true);
    } else if (!activeStoreId) {
        speak(t('which-store-should-fulfill-speech', language), language);
        setIsWaitingForStoreName(true);
    } else {
        const total = cartTotal + 30; // Assuming 30 is delivery fee
        const speech = t('your-total-is-speech', language).replace('{total}', `₹${total.toFixed(2)}`);
        speak(speech, language);
    }
    
    hasSpokenCheckoutPrompt.current = true;
  }, [
    pathname, hasMounted, enabled, isWaitingForQuickOrderConfirmation, 
    cartItemsProp.length, activeStoreId, language, speak, setIsWaitingForAddressType, setIsWaitingForStoreName, cartTotal
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

  const findProductAndVariant = useCallback(async (phrase: string): Promise<{ product: Product | null; variant: ProductVariant | null; requestedQty: number; remainingPhrase: string; }> => {
    const lowerPhrase = phrase.toLowerCase();
    let bestMatch: { product: Product, alias: string, similarity: number } | null = null;
    
    for (const [alias, product] of productAliasMap.entries()) {
        if (lowerPhrase.includes(alias)) {
             const similarity = calculateSimilarity(lowerPhrase, alias);
             if (!bestMatch || similarity > bestMatch.similarity) {
                bestMatch = { product, alias, similarity };
            }
        }
    }
    
    if (!bestMatch) return { product: null, variant: null, requestedQty: 1, remainingPhrase: phrase };

    const productMatch = bestMatch.product;
    let remainingPhrase = lowerPhrase.replace(bestMatch.alias, '').trim();

    let priceData = productPrices[productMatch.name.toLowerCase()];
    if (priceData === undefined && firestore) {
        await fetchProductPrices(firestore, [productMatch.name]);
        priceData = useAppStore.getState().productPrices[productMatch.name.toLowerCase()];
    }
    
    if (!priceData?.variants?.length) return { product: productMatch, variant: null, requestedQty: 1, remainingPhrase };
    
    const numberWords: Record<string, number> = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'ఒకటి': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'ఐదు': 5, 'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9, 'పది': 10, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10 };
    const weightRegex = new RegExp(`(${Object.keys(numberWords).join('|')}|\\d+)\\s*(kg|kilo|kilos|కేజీ|కిలో|gm|g|grams|గ్రాములు|pc|piece|pack|ప్యాక్)`, 'i');
    
    const numPart = (phrase.match(/(\d+)/) || [])[0];
    const wordNumPart = (phrase.match(new RegExp(`\\b(${Object.keys(numberWords).join('|')})\\b`, 'i')) || [])[0];
    let quantity = 1;
    if(numPart) {
      quantity = parseInt(numPart, 10);
    } else if (wordNumPart) {
      quantity = numberWords[wordNumPart.toLowerCase()];
    }

    let chosenVariant: ProductVariant | null = null;
    if (priceData.variants) {
      let bestVariantMatch: { variant: ProductVariant, diff: number } | null = null;

      const unitMatch = phrase.match(/(kg|kilo|gm|g|gram|pack|pc|piece)/i);
      const unit = unitMatch ? unitMatch[0].toLowerCase() : null;

      let desiredWeightInGrams = 0;
      if (unit && ['kg', 'kilo'].includes(unit)) desiredWeightInGrams = quantity * 1000;
      else if (unit && ['gm', 'g', 'gram'].includes(unit)) desiredWeightInGrams = quantity;

      if (desiredWeightInGrams > 0) {
        for (const v of priceData.variants) {
          const variantWeightMatch = v.weight.match(/(\d+)(kg|gm|g)/);
          if (variantWeightMatch) {
            const variantWeightNum = parseInt(variantWeightMatch[1]);
            const variantUnit = variantWeightMatch[2].toLowerCase();
            const variantWeightInGrams = variantUnit.startsWith('k') ? variantWeightNum * 1000 : variantWeightNum;
            const diff = Math.abs(desiredWeightInGrams - variantWeightInGrams);
            if (!bestVariantMatch || diff < bestVariantMatch.diff) {
              bestVariantMatch = { variant: v, diff: diff };
            }
          }
        }
        if (bestVariantMatch) {
          chosenVariant = bestVariantMatch.variant;
          const chosenWeightInGrams = parseInt(chosenVariant.weight.replace(/[^0-9]/g, '')) * (chosenVariant.weight.includes('kg') ? 1000 : 1);
          quantity = Math.max(1, Math.round(desiredWeightInGrams / chosenWeightInGrams));
        }
      }
      
      if (!chosenVariant) {
        chosenVariant = priceData.variants.find(v => v.weight.includes('kg')) || priceData.variants.find(v => v.weight.includes('pc')) || priceData.variants[0];
      }
    }
    
    return { product: productMatch, variant: chosenVariant, requestedQty: quantity, remainingPhrase };

  }, [firestore, productPrices, fetchProductPrices, productAliasMap]);

  const handleCommand = useCallback(async (commandText: string) => {
    onStatusUpdate(`Processing: "${commandText}"`);
    if (!firestore || !user) {
        speak("I can't process commands without being connected. Please log in.", 'en-IN');
        return;
    }

    const { lang, command: strippedCommand, languageSwitched } = detectLanguage(commandText);
    const langWithRegion = lang === 'en' ? 'en-IN' : `${lang}-IN`;
    
    if (lang !== language) {
        updateRecognitionLanguage(langWithRegion);
    }
    
    // PRIORITY 0: Handle language switch feedback
    if (languageSwitched && lang === 'te') {
        speak(t('telugu-welcome-speech', 'te'), 'te-IN');
        return;
    }

    const commandLower = strippedCommand.toLowerCase();
    
    // --- PRIORITY 1: High-priority global navigation & language switching ("Reflexes") ---
    const highPriorityCommands = ["home", "stores", "dashboard", "cart", "orders", "deliveries", "myStore", "refresh", "checkout"];
    for (const key of highPriorityCommands) {
        const cmdGroup = fileCommandsRef.current[key];
        if (!cmdGroup) continue;

        const allAliases = [t(key, lang), ...Object.values(getAllAliases(key)).flat(), ...(cmdGroup.aliases || [])];
        for (const alias of [...new Set(allAliases)]) {
             if (calculateSimilarity(commandLower, alias) > 0.8 || commandText.toLowerCase() === alias) {
                const action = commandActionsRef.current[key];
                if (action) {
                    if (key === 'checkout' && cartItemsProp.length > 0) {
                        commandActionsRef.current.checkout({ lang });
                    } else {
                        speak(cmdGroup.reply, langWithRegion, () => action({ lang }));
                    }
                }
                resetAllContext();
                return;
            }
        }
    }
    
    // --- PRIORITY 2: Context-aware commands ("Situational Awareness") ---
    if (pathname === '/checkout') {
        const placeOrderAliases = [t('placeOrder', lang), ...Object.values(getAllAliases('placeOrder')).flat()];
        if (placeOrderAliases.some(alias => calculateSimilarity(commandLower, alias) > 0.8)) {
            await commandActionsRef.current.placeOrder({ lang });
            resetAllContext();
            return;
        }
    }
    
    if (pathname === '/dashboard/owner/my-store') {
        const saveAliases = [t('saveChanges', lang), ...Object.values(getAllAliases('saveChanges')).flat()];
        if (saveAliases.some(alias => calculateSimilarity(commandLower, alias) > 0.8)) {
            commandActionsRef.current.saveChanges({ lang });
            resetAllContext();
            return;
        }
        const { product } = await findProductAndVariant(commandLower);
        if (product && product.id) {
            const checkbox = document.getElementById(product.id) as HTMLInputElement | null;
            if (checkbox) {
                checkbox.click();
                const reply = t('adding-item-speech', lang).replace('{quantity}', '').replace('{productName}', getProductName(product));
                speak(reply, langWithRegion);
            } else {
                speak(`I found ${getProductName(product)} but couldn't find its checkbox on the page.`, langWithRegion);
            }
            resetAllContext();
            return;
        }
    }

    if (pathname === '/dashboard/delivery/deliveries') {
      const acceptJobAliases = ["accept job", "accept this job", "take this job", "accept group", "i'll take it"];
      if (acceptJobAliases.some(alias => calculateSimilarity(commandLower, alias) > 0.8)) {
          commandActionsRef.current.acceptDeliveryJob({ lang });
          resetAllContext();
          return;
      }
    }


    // --- PRIORITY 3: Contextual Replies & Information Gathering ---
    if (isWaitingForAddressType) {
        const homeKeywords = ['home', 'address', ...Object.values(getAllAliases('homeAddress')).flat()];
        const locationKeywords = ['current', 'location', ...Object.values(getAllAliases('currentLocation')).flat()];
        
        if (homeKeywords.some(keyword => commandLower.includes(keyword))) {
            homeAddressBtnRef?.current?.click();
            speak(t('setting-delivery-to-home-speech', lang), langWithRegion);
        } else if (locationKeywords.some(keyword => commandLower.includes(keyword))) {
            currentLocationBtnRef?.current?.click();
            speak(t('using-current-location-speech', lang), langWithRegion);
        } else {
            speak(t('did-not-understand-address-type-speech', lang), langWithRegion);
            resetAllContext();
            return;
        }
        
        setIsWaitingForAddressType(false);
        setTimeout(() => {
            hasSpokenCheckoutPrompt.current = false;
            runCheckoutPrompt();
        }, 1500);
        return;
    }

    if (isWaitingForStoreName) {
         let bestMatch: { store: Store, similarity: number, term: string } | null = null;
         for (const [alias, store] of storeAliasMap.entries()) {
             if (commandLower.includes(alias)) {
                 const similarity = calculateSimilarity(commandLower, alias);
                 if (!bestMatch || similarity > bestMatch.similarity) {
                     bestMatch = { store, similarity: similarity, term: alias };
                 }
             }
         }

        if (bestMatch && bestMatch.similarity > 0.6) {
            const store = bestMatch.store;
            speak(t('okay-ordering-from-speech', lang).replace('{storeName}', store.name), langWithRegion, () => {
                setActiveStoreId(store.id);
                if(pathname === '/checkout') {
                  setTimeout(() => {
                      hasSpokenCheckoutPrompt.current = false;
                      runCheckoutPrompt();
                  }, 1500);
                }
            });
        } else {
            speak(t('could-not-find-store-speech', lang).replace('{storeName}', commandText), langWithRegion);
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
    
    // --- PRIORITY 4: Core Order Processing Logic ---
    const actionKeywords = ['order', 'send', 'buy', 'get', 'want', 'need'];
    const locationKeywords = ['from', 'to'];
    const hasAction = actionKeywords.some(kw => commandLower.startsWith(kw));
    const hasLocation = locationKeywords.some(kw => commandLower.includes(kw));

    if (hasAction && hasLocation) {
        await commandActionsRef.current.smartOrder(commandLower, lang, commandText);
        resetAllContext();
        return;
    }

    const multiItemSeparators = / and | , | and then | then /i;
    if (commandLower.match(multiItemSeparators)) {
        await commandActionsRef.current.orderMultipleItems(commandLower.split(multiItemSeparators), lang, commandText);
        resetAllContext();
        return;
    }
    
    const openStoreAliases = ['open', 'show', 'go to', 'go'];
    if (openStoreAliases.some(alias => commandLower.startsWith(alias))) {
        const storeName = openStoreAliases.reduce((acc, alias) => acc.replace(alias, ''), commandLower).trim();
        const store = storeAliasMap.get(storeName);
        if (store) {
             commandActionsRef.current.goToStore({ store, lang });
             resetAllContext();
             return;
        }
    }

    // --- PRIORITY 5: Fallback to Single Item Order or Failure ---
    await commandActionsRef.current.orderItem({ phrase: commandLower, lang, originalText: commandText });
    resetAllContext();

  }, [firestore, user, language, detectLanguage, updateRecognitionLanguage, speak, onStatusUpdate, resetAllContext, pathname, findProductAndVariant, storeAliasMap, homeAddressBtnRef, currentLocationBtnRef, placeOrderBtnRef, profileForm, saveInventoryBtnRef, setActiveStoreId, isWaitingForAddressType, isWaitingForStoreName, handleProfileFormInteraction, runCheckoutPrompt, getProductName, cartItemsProp.length]);


  useEffect(() => {
    if (!recognition) {
      onStatusUpdate("Speech recognition not supported by this browser.");
      return;
    }

    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      onStatusUpdate(`Listening... (${language}-IN)`);
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
      home: (params) => router.push('/'),
      stores: (params) => router.push('/stores'),
      dashboard: (params) => router.push('/dashboard'),
      cart: (params) => router.push('/cart'),
      orders: (params) => router.push('/dashboard/customer/my-orders'),
      deliveries: (params) => router.push('/dashboard/delivery/deliveries'),
      myStore: (params) => router.push('/dashboard/owner/my-store'),
      checkout: (params: { lang: string }) => {
        const lang = params.lang || language;
        const total = cartTotal + 30; // Assuming 30 is delivery fee
        onCloseCart();
        if (cartTotal > 0) {
            const speechText = t('your-total-is-speech', lang).replace('{total}', `₹${total.toFixed(2)}`);
             if (pathname !== '/checkout') {
                speak(speechText, lang + '-IN', () => router.push('/checkout'));
            } else {
                speak(speechText, lang + '-IN');
            }
        } else {
            speak(t('your-cart-is-empty-speech', lang), lang + '-IN');
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
        const lang = params.lang || language;
        speak(t('im-ready-for-order-speech', lang), lang + '-IN');
        setIsWaitingForVoiceOrder(true);
      },
      createVoiceOrder: async (list: string, lang: string) => {
        if (!firestore || !user || !userProfileRef.current) {
          speak(t('cannot-create-order-no-profile-speech', lang), lang + '-IN');
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
          speak(t('sent-list-to-stores-speech', lang), lang + '-IN', () => {
            router.push('/dashboard/customer/my-orders');
          });
        } catch (e) {
          console.error("Error creating voice order:", e);
          speak(t('failed-to-create-voice-order-speech', lang), lang + '-IN');
          const permissionError = new FirestorePermissionError({
            path: 'orders',
            operation: 'create',
            requestResourceData: voiceOrderData,
          });
          errorEmitter.emit('permission-error', permissionError);
        }
      },
      placeOrder: (params) => {
        const lang = params?.lang || language;
        if (pathname === '/checkout' && placeOrderBtnRef?.current) {
          speak(t('placing-your-order-now-speech', lang), lang + '-IN');
          placeOrderBtnRef.current.click();
        } else if (cartItemsProp.length > 0) {
          commandActionsRef.current.checkout({ lang });
        } else {
          speak(t('your-cart-is-empty-speech', lang), lang + '-IN');
        }
      },
      saveChanges: (params) => {
        const lang = params?.lang || language;
        if (pathname === '/dashboard/owner/my-store' && saveInventoryBtnRef?.current) {
          saveInventoryBtnRef.current.click();
          speak(t('saving-changes', lang), lang + '-IN');
        } else if (pathname === '/dashboard/customer/my-profile' && profileForm) {
            if (typeof document !== 'undefined') {
                const formElement = document.querySelector('form');
                if (formElement) formElement.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                speak(t('saving-changes', lang), lang + '-IN');
            }
        } else {
          speak(t('no-changes-to-save-speech', lang), lang + '-IN');
        }
      },
      acceptDeliveryJob: ({ lang }) => {
          if (pathname === '/dashboard/delivery/deliveries' && typeof document !== 'undefined') {
              const acceptButton = document.querySelector('.accordion-content button') as HTMLButtonElement | null;
              if (acceptButton) {
                  speak("Okay, accepting the first available job group.", lang + '-IN');
                  acceptButton.click();
              } else {
                  speak("There are no available jobs to accept right now.", lang + '-IN');
              }
          } else {
              speak("You can only accept jobs from the deliveries page.", lang + '-IN');
          }
      },
      refresh: (params) => {
         window.location.reload();
      },
      goToStore: ({ store, lang }) => {
        const langWithRegion = lang === 'en' ? 'en-IN' : `${lang}-IN`;
        speak(`Okay, opening ${store.name}.`, langWithRegion); // Speak immediately
        router.push(`/stores/${store.id}`); // Navigate immediately
      },
      orderItem: async ({ phrase, lang, originalText }: { phrase?: string; lang: string, originalText: string }) => {
        if (!phrase) return;

        const { product, variant, requestedQty } = await findProductAndVariant(phrase);

        if (product && variant) {
            const speech = t('adding-item-speech', lang)
                .replace('{quantity}', `${requestedQty}`)
                .replace('{productName}', product.name);
            speak(speech, lang + '-IN');
            addItemToCart(product, variant, requestedQty);
            onOpenCart();
        } else if (product && !variant) {
            const reason = `Product found ("${product.name}"), but no matching variant/price for phrase: "${phrase}"`;
            speak(`Sorry, I found ${product.name} but could not determine a price or size.`, lang + '-IN');
             if (firestore && user) {
                addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: originalText, language: lang, reason, timestamp: serverTimestamp() });
             }
        } else {
             speak(t('sorry-i-didnt-understand-that', lang), lang + '-IN');
             if (firestore && user) {
                addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: originalText, language: lang, reason: 'No matching product found.', timestamp: serverTimestamp() });
             }
        }
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
            if (firestore && user) {
               addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: originalText, language: lang, reason: `Multi-item match failed for: "${failedItems.join(', ')}"`, timestamp: serverTimestamp() });
            }
        }
        if (!speech) {
            speech = t('sorry-i-couldnt-find-any-items', lang);
             if (firestore && user) {
                addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: originalText, language: lang, reason: 'Multi-item match failed for all items', timestamp: serverTimestamp() });
            }
        }
        speak(speech, lang + '-IN');
    },
    smartOrder: async (command: string, lang: string, originalText: string) => {
        let remainingCommand = command.toLowerCase();
        const multiItemSeparators = / and | , | and then | then /i;

        let bestStoreMatch: { store: Store, similarity: number, term: string } | null = null;
        for (const [alias, store] of storeAliasMap.entries()) {
             if (remainingCommand.includes(alias)) {
                const similarity = calculateSimilarity(remainingCommand, alias);
                if (!bestStoreMatch || similarity > bestStoreMatch.similarity) {
                    bestStoreMatch = { store, similarity: similarity, term: alias };
                }
            }
        }
        if (bestStoreMatch) {
            remainingCommand = remainingCommand.replace("from " + bestStoreMatch.term, '').trim();
        }

        let destination: 'home' | null = null;
        const homeKeywords = ['to home', 'at home', 'my home', 'to my house', 'intiki', 'naa intiki'];
        const homeMatch = homeKeywords.find(kw => remainingCommand.includes(kw));
        if (homeMatch) {
            destination = 'home';
            remainingCommand = remainingCommand.replace(homeMatch, '').trim();
        }

        const productPhrase = remainingCommand.replace(/^(order|buy|get|send|need|want)/, '').trim();
        const productPhrases = productPhrase.split(multiItemSeparators);
        
        let addedItems: string[] = [];
        let failedItems: string[] = [];

        for (const phrase of productPhrases) {
            if (!phrase.trim()) continue;
            const { product, variant, requestedQty } = await findProductAndVariant(phrase);
            if (product && variant) {
                addItemToCart(product, variant, requestedQty);
                addedItems.push(`${requestedQty} ${product.name}`);
            } else {
                failedItems.push(phrase);
            }
        }

        if (addedItems.length === 0) {
            speak(t('could-not-find-product-in-order-speech', lang), lang + '-IN');
            if(firestore && user) addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: originalText, language: lang, reason: `Smart order: no products found in "${productPhrase}"`, timestamp: serverTimestamp() });
            return;
        }

        if (!bestStoreMatch) {
            speak(t('could-not-identify-store-speech', lang), lang + '-IN');
             if(firestore && user) addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: originalText, language: lang, reason: 'Smart order: store not found', timestamp: serverTimestamp() });
            return;
        }
        if (destination === 'home' && (!userProfileRef.current || !userProfileRef.current.address)) {
            speak(t('cannot-deliver-home-no-address-speech', lang), lang + '-IN', () => {
              router.push('/dashboard/customer/my-profile');
            });
            return;
        }

        const speech = t('preparing-order-speech', lang)
            .replace('{qty}', '') // Quantity is plural, so we remove it
            .replace('{productName}', addedItems.join(', '))
            .replace('{storeName}', bestStoreMatch.store.name);
        speak(speech, lang + '-IN');

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
    console.log('Current language changed to:', language);
  }, [language]);

  return null;
}
