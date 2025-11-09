

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
import { getCommands, getLocales } from '@/app/actions';
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

type AliasToProductMap = Map<string, { product: Product; lang: string }>;


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
  const allAliasesRef = useRef<Record<string, Record<string, string[]>>>({});

  const formFieldToFillRef = useRef<keyof ProfileFormValues | null>(null);
  const [isWaitingForStoreName, setIsWaitingForStoreName] = useState(false);
  const [isWaitingForVoiceOrder, setIsWaitingForVoiceOrder] = useState(false);
  const [clarificationStores, setClarificationStores] = useState<Store[]>([]);
  const [isWaitingForAddressType, setIsWaitingForAddressType] = useState(false);

  const [isWaitingForQuantity, setIsWaitingForQuantity] = useState(false);
  const itemToUpdateSkuRef = useRef<string | null>(null);

  const userProfileRef = useRef<User | null>(null);

  const [hasMounted, setHasMounted] = useState(false);

  const [speechSynthesisVoices, setSpeechSynthesisVoices] = useState<SpeechSynthesisVoice[]>([]);
  
    // --- Performance Optimization: Memoized Alias Maps ---
  const universalProductAliasMap = useMemo<AliasToProductMap>(() => {
    const map: AliasToProductMap = new Map();
    if (!masterProducts) return map;

    for (const p of masterProducts) {
      if (!p.name) continue;
      const productSlug = p.name.toLowerCase().replace(/ /g, '-');
      const productAliasesByLang = getAllAliases(productSlug);
      
      // Add the canonical name itself, both with and without spaces
      const normalizedCanonicalName = p.name.toLowerCase();
      map.set(normalizedCanonicalName, { product: p, lang: 'en' });
      map.set(normalizedCanonicalName.replace(/\s+/g, ''), { product: p, lang: 'en' });


      // Add all aliases from locales.json
      for (const lang in productAliasesByLang) {
        for (const alias of productAliasesByLang[lang]) {
          const normalizedAlias = alias.toLowerCase();
          map.set(normalizedAlias, { product: p, lang: lang });
          map.set(normalizedAlias.replace(/\s+/g, ''), { product: p, lang: lang });
        }
      }
    }
    return map;
  }, [masterProducts]);

  const storeAliasMap = useMemo(() => {
    const map = new Map<string, Store>();
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
         if (term) {
            const normalizedTerm = term.toLowerCase();
            map.set(normalizedTerm, s);
            map.set(normalizedTerm.replace(/\s+/g, ''), s);
        }
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
    formFieldToFillRef.current = null;
    setShouldPlaceOrderDirectly(false);
  }, [onSuggestions, setIsWaitingForQuickOrderConfirmation, setShouldPlaceOrderDirectly]);


  // Determine the language of a phrase without changing the app's state
  const determinePhraseLanguage = useCallback((text: string): string => {
    const lowerText = text.toLowerCase();
    
    // --- Priority 1: Check for transliterated English greetings ---
    const transliteratedGreetings = ['హై', 'హలో'];
    if (transliteratedGreetings.some(greeting => lowerText.includes(greeting))) {
      return 'en'; // Treat these as English commands for greetings.
    }

    // --- Priority 2: Check for core language keywords ---
    const langKeywords = [
        { lang: 'te', keywords: ['నాకు', 'కావాలి', 'naku', 'naaku', 'kavali'] },
        { lang: 'hi', keywords: ['मुझे', 'चाहिए', 'mujhe', 'chahiye'] },
        { lang: 'en', keywords: ['i want', 'i need', 'get me', 'add', 'get', 'buy', 'order', 'send', 'go', 'open', 'what is', 'how'] }
    ];
     for (const langInfo of langKeywords) {
        if (langInfo.keywords.some(keyword => lowerText.includes(keyword))) {
            return langInfo.lang;
        }
    }

    // --- Priority 3: Check all aliases for a match ---
    for (const key in allAliasesRef.current) {
        const langAliases = allAliasesRef.current[key];
        for (const lang in langAliases) {
            if (langAliases[lang].some(alias => lowerText.includes(alias.toLowerCase()))) {
                if (lang !== 'en') return lang; // Return if we find a non-English alias match
            }
        }
    }

    return language; // Default to the current app language if no strong hint is found
  }, [language]);


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
    // Pre-fetch all commands and locales and store them in a ref for the detector.
    getLocales().then(locales => {
        const aliasMap: Record<string, Record<string, string[]>> = {};
        for(const key in locales) {
            aliasMap[key] = {};
            for(const lang in locales[key]) {
                const value = locales[key][lang];
                aliasMap[key][lang] = Array.isArray(value) ? value : [value];
            }
        }
        allAliasesRef.current = aliasMap;
    });

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
            recognition.lang = language === 'te' ? 'te-IN' : 'en-IN';
            recognition.continuous = true;
            recognition.interimResults = false;
            try {
                recognition.start();
            } catch (e) {
                 if (! (e instanceof DOMException && e.name === 'InvalidStateError')) {
                    console.error("Could not start recognition:", e);
                }
            }
        } else {
            recognition.onend = null; // Prevent restart on manual disable
            recognition.stop();
        }
    }
}, [enabled, language]);

  const speak = useCallback((text: string, lang: string, onEndCallback?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      if (onEndCallback) onEndCallback();
      return;
    }

    window.speechSynthesis.cancel();
    isSpeakingRef.current = true; // Set speaking flag
    
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
       // After speaking, check if recognition should be restarted.
      if (isEnabledRef.current && recognition) {
        try {
            recognition.start();
        } catch(e) {
            // Can happen if it's already starting. Safe to ignore.
        }
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted') {
          console.error("Speech synthesis error:", e.error || 'Unknown speech error');
      }
      isSpeakingRef.current = false;
      if (onEndCallback) onEndCallback();
      if (isEnabledRef.current && recognition) {
          try {
              recognition.start();
          } catch(e) {}
      }
    };
    
    if(recognition) recognition.stop();
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

    const detectedLang = language; // Use the app's current UI language for the prompt
    const addressInput = typeof document !== 'undefined' ? (document.querySelector('input[name="deliveryAddress"]') as HTMLInputElement) : null;
    const currentAddress = addressInput?.value || '';

    if (isWaitingForQuickOrderConfirmation) {
        speak(t('confirm-the-quick-order-speech', detectedLang), detectedLang + '-IN');
    } else if (cartItemsProp.length === 0) {
        speak(t('your-cart-is-empty-speech', detectedLang), detectedLang + '-IN');
    } else if (!currentAddress || currentAddress.length < 10) {
        speak(t('should-i-deliver-to-home-or-current-speech', detectedLang), detectedLang + '-IN');
        setIsWaitingForAddressType(true);
    } else if (!activeStoreId) {
        speak(t('which-store-should-fulfill-speech', detectedLang), detectedLang + '-IN');
        setIsWaitingForStoreName(true);
    } else {
        const total = cartTotal + 30; // Assuming 30 is delivery fee
        const speech = t('finalConfirmPrompt', detectedLang).replace('{total}', `₹${total.toFixed(2)}`);
        speak(speech, detectedLang + '-IN');
    }
}, [
    pathname, hasMounted, enabled, isWaitingForQuickOrderConfirmation,
    cartItemsProp.length, activeStoreId, language, speak,
    setIsWaitingForAddressType, setIsWaitingForStoreName, cartTotal, t
]);
  
  // Proactive trigger for the checkout page based on a state change
  useEffect(() => {
      if (pathname === '/checkout' && hasMounted && enabled && voiceTrigger > 0) {
          const timeoutId = setTimeout(() => {
              runCheckoutPrompt();
          }, 1000); 
          return () => clearTimeout(timeoutId);
      }
  }, [voiceTrigger, pathname, hasMounted, enabled, runCheckoutPrompt]);

  // New Proactive trigger for checkout page based on address/store changes
  useEffect(() => {
    if (pathname !== '/checkout' || !enabled || isSpeakingRef.current) return;
    
    // Give React time to update state before triggering the prompt.
    const handler = setTimeout(() => {
      runCheckoutPrompt();
    }, 500);

    return () => clearTimeout(handler);
  }, [activeStoreId, runCheckoutPrompt]);


  useEffect(() => {
    if (pathname !== '/dashboard/customer/my-profile' || !hasMounted || !enabled) {
      formFieldToFillRef.current = null;
      return;
    }
    let speakTimeout: NodeJS.Timeout | null = null;
    if (profileForm) {
      speakTimeout = setTimeout(() => {
        handleProfileFormInteraction();
      }, 1500);
    }
    return () => {
      if (speakTimeout) {
        clearTimeout(speakTimeout);
      }
    };
  }, [pathname, hasMounted, enabled, profileForm, handleProfileFormInteraction]);

  const findProductAndVariant = useCallback(async (phrase: string): Promise<{ product: Product | null; variant: ProductVariant | null; requestedQty: number; remainingPhrase: string; matchedAlias: string | null; lang: string; }> => {
    const lowerPhrase = phrase.toLowerCase();
    const normalizedPhrase = lowerPhrase.replace(/\s+/g, '');
    let bestMatch: { product: Product, alias: string, similarity: number, lang: string } | null = null;

    // Search both with and without spaces for flexibility
    const searchTerms = [lowerPhrase, normalizedPhrase];

    for (const term of searchTerms) {
        for (const [alias, { product, lang }] of universalProductAliasMap.entries()) {
            // Check if the alias (which might be space-less) is a substring of the search term
            if (term.includes(alias)) {
                const similarity = calculateSimilarity(term, alias);
                if (!bestMatch || similarity > bestMatch.similarity) {
                    bestMatch = { product, alias, similarity, lang };
                }
            }
        }
    }
    
    if (!bestMatch) return { product: null, variant: null, requestedQty: 1, remainingPhrase: phrase, matchedAlias: null, lang: 'en' };

    const { product: productMatch, alias: matchedAlias, lang: detectedLang } = bestMatch;
    let remainingPhrase = lowerPhrase.replace(matchedAlias, '').trim();

    // Fetch price data if not already cached
    let priceData = productPrices[productMatch.name.toLowerCase()];
    if (priceData === undefined && firestore) {
        await fetchProductPrices(firestore, [productMatch.name]);
        priceData = useAppStore.getState().productPrices[productMatch.name.toLowerCase()];
    }
    
    if (!priceData?.variants?.length) return { product: productMatch, variant: null, requestedQty: 1, remainingPhrase, matchedAlias, lang: detectedLang };
    
    const numberWords: Record<string, number> = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'ఒకటి': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'ఐదు': 5, 'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9, 'పది': 10, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10 };
    const unitKeywords: Record<string, string[]> = {
        'kg': ['kg', 'kilo', 'kilos', 'కేజీ', 'కిలో'],
        'gm': ['gm', 'g', 'grams', 'గ్రాములు'],
        'pc': ['pc', 'piece', 'pieces'],
        'pack': ['pack', 'packet', 'ప్యాక్']
    };
    
    let requestedQty = 1;
    let requestedUnit: string | null = null;
    
    // 1. Find quantity (number word or digit)
    const numMatch = remainingPhrase.match(/(\d+)/);
    const wordNumMatch = remainingPhrase.match(new RegExp(`\\b(${Object.keys(numberWords).join('|')})\\b`, 'i'));

    if (numMatch) {
        requestedQty = parseInt(numMatch[0], 10);
        remainingPhrase = remainingPhrase.replace(numMatch[0], '').trim();
    } else if (wordNumMatch) {
        requestedQty = numberWords[wordNumMatch[0].toLowerCase()];
        remainingPhrase = remainingPhrase.replace(wordNumMatch[0], '').trim();
    }

    // 2. Find unit
    for (const unit in unitKeywords) {
        const keywords = unitKeywords[unit];
        const unitMatch = remainingPhrase.match(new RegExp(`\\b(${keywords.join('|')})\\b`, 'i'));
        if (unitMatch) {
            requestedUnit = unit;
            break;
        }
    }

    // 3. Find the best variant
    let chosenVariant: ProductVariant | null = null;
    if (requestedUnit) {
        // Find a variant that contains the unit, e.g., 'kg' in '1kg'
        chosenVariant = priceData.variants.find(v => v.weight.toLowerCase().includes(requestedUnit)) || null;
    }

    // Fallback: If no variant was found, or no unit was specified, pick the most common one (e.g., 1kg or 1 pc)
    if (!chosenVariant && priceData.variants.length > 0) {
        chosenVariant = 
            priceData.variants.find(v => v.weight === '1kg') ||
            priceData.variants.find(v => v.weight.includes('kg')) ||
            priceData.variants.find(v => v.weight.includes('pc')) ||
            priceData.variants[0]; // Default to the first variant
    }
    
    return { product: productMatch, variant: chosenVariant, requestedQty, remainingPhrase, matchedAlias, lang: detectedLang };

  }, [firestore, productPrices, fetchProductPrices, universalProductAliasMap]);

  const handleCommand = useCallback(async (commandText: string) => {
    onStatusUpdate(`Processing: "${commandText}"`);
    if (!firestore || !user) {
        speak("I can't process commands without being connected. Please log in.", 'en-IN');
        return;
    }

    const commandLower = commandText.toLowerCase();

    // --- Language Detection & Context Management ---
    const spokenLang = determinePhraseLanguage(commandText);
    const langWithRegion = spokenLang === 'en' ? 'en-IN' : `${spokenLang}-IN`;
    const didLanguageChange = spokenLang !== language;

    if (didLanguageChange) {
        setLanguage(spokenLang);
        updateRecognitionLanguage(langWithRegion);
        // Announce the change *after* processing the action, if an action is taken.
    }
    
    // --- PRIORITY 0: Check for product/item command first ---
    const { product, variant, requestedQty, matchedAlias, lang: itemLang } = await findProductAndVariant(commandLower);

    if (product && variant) {
        // Since we found a product, this takes precedence. Perform the action.
        addItemToCart(product, variant, requestedQty);
        onOpenCart();
        
        // Now, construct and speak the confirmation.
        const productLang = itemLang || spokenLang;
        const replyProductName = matchedAlias || getProductName(product);

        let speech = t('adding-item-speech', productLang)
            .replace('{quantity}', `${requestedQty} ${variant.weight}`)
            .replace('{productName}', replyProductName);

        // If the language changed during this command, add the confirmation to the speech.
        if (didLanguageChange) {
            speech += spokenLang === 'te' ? " నేను మీ కోసం తెలుగుకి మారాను." : " I've also switched to English for you.";
            // Since we're now in a new language, play the welcome speech after a delay.
        }
            
        speak(speech, productLang + '-IN');
        resetAllContext();
        return;
    }
    
    // --- PRIORITY 1: Check for simple conversational commands first ---
    const conversationalCommands = ["whatTime", "howAreYou", "howIsYourDay", "whatToOrder"];
    for (const key of conversationalCommands) {
        const cmdGroup = fileCommandsRef.current[key];
        if (!cmdGroup) continue;

        const allAliases = [t(key, spokenLang).toLowerCase(), ...Object.values(getAllAliases(key)).flat().map(a => a.toLowerCase()), ...(cmdGroup.aliases || [])];
        for (const alias of [...new Set(allAliases)]) {
            if (calculateSimilarity(commandLower, alias) > 0.8 || commandText.toLowerCase() === alias) {
                let replyText = t(cmdGroup.reply, spokenLang);
                
                if (replyText.includes('{time}')) {
                    const now = new Date();
                    const timeString = now.toLocaleTimeString(langWithRegion, { hour: '2-digit', minute: '2-digit' });
                    replyText = replyText.replace('{time}', timeString);
                }
                
                speak(replyText, langWithRegion);
                resetAllContext();
                return;
            }
        }
    }
    
    
    // --- PRIORITY 2: Page-Specific Contextual Actions ---
    if (pathname === '/checkout') {
        const placeOrderAliases = [t('placeOrder', spokenLang).toLowerCase(), ...Object.values(getAllAliases('placeOrder')).flat().map(a => a.toLowerCase())];
        if (placeOrderAliases.some(alias => calculateSimilarity(commandLower, alias) > 0.8)) {
            await commandActionsRef.current.placeOrder({ lang: spokenLang });
            resetAllContext();
            return;
        }
    }
    
    if (pathname === '/dashboard/owner/my-store') {
        const saveAliases = [t('saveChanges', spokenLang).toLowerCase(), ...Object.values(getAllAliases('saveChanges')).flat().map(a => a.toLowerCase())];
        if (saveAliases.some(alias => calculateSimilarity(commandLower, alias) > 0.8)) {
            commandActionsRef.current.saveChanges({ lang: spokenLang });
            resetAllContext();
            return;
        }
    }

    if (pathname === '/dashboard/delivery/deliveries') {
      const acceptJobAliases = ["accept job", "accept this job", "take this job", "accept group", "i'll take it"];
      if (acceptJobAliases.some(alias => calculateSimilarity(commandLower, alias) > 0.8)) {
          commandActionsRef.current.acceptDeliveryJob({ lang: spokenLang });
          resetAllContext();
          return;
      }
    }

    // --- PRIORITY 3: High-priority global navigation ---
    const highPriorityCommands = ["home", "stores", "dashboard", "cart", "orders", "deliveries", "myStore", "refresh", "checkout"];
    for (const key of highPriorityCommands) {
        const cmdGroup = fileCommandsRef.current[key];
        if (!cmdGroup) continue;

        const allAliases = [t(key, spokenLang).toLowerCase(), ...Object.values(getAllAliases(key)).flat().map(a => a.toLowerCase()), ...(cmdGroup.aliases || [])];
        for (const alias of [...new Set(allAliases)]) {
             if (calculateSimilarity(commandLower, alias) > 0.8 || commandText.toLowerCase() === alias) {
                const action = commandActionsRef.current[key];
                if (action) {
                    speak(t(cmdGroup.reply, spokenLang), langWithRegion, () => action({ lang: spokenLang }));
                }
                resetAllContext();
                return;
            }
        }
    }

    // --- PRIORITY 4: Contextual Replies & Information Gathering ---
    if (isWaitingForAddressType) {
        const homeKeywords = [t('homeAddress', spokenLang).toLowerCase(), ...Object.values(getAllAliases('homeAddress')).flat().map(a => a.toLowerCase())];
        const locationKeywords = [t('currentLocation', spokenLang).toLowerCase(), ...Object.values(getAllAliases('currentLocation')).flat().map(a => a.toLowerCase())];
        
        if (homeKeywords.some(keyword => commandLower.includes(keyword))) {
            homeAddressBtnRef?.current?.click();
            speak(t('setting-delivery-to-home-speech', spokenLang), langWithRegion);
        } else if (locationKeywords.some(keyword => commandLower.includes(keyword))) {
            currentLocationBtnRef?.current?.click();
            speak(t('using-current-location-speech', spokenLang), langWithRegion);
        } else {
            speak(t('did-not-understand-address-type-speech', spokenLang), langWithRegion);
            resetAllContext();
            return;
        }
        setIsWaitingForAddressType(false);
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
            speak(t('okay-ordering-from-speech', spokenLang).replace('{storeName}', store.name), langWithRegion, () => {
                setActiveStoreId(store.id);
            });
        } else {
            speak(t('could-not-find-store-speech', spokenLang).replace('{storeName}', commandText), langWithRegion);
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
    
    // --- PRIORITY 5: Complex "Smart Order" parsing ---
    const locationKeywords = ['from', 'to'];
    if (locationKeywords.some(kw => commandLower.includes(kw))) {
        await commandActionsRef.current.smartOrder(commandLower, spokenLang, commandText);
        resetAllContext();
        return;
    }

    // --- PRIORITY 6: Fallback for failure ---
    speak(t('sorry-i-didnt-understand-that', spokenLang), langWithRegion);
    if (firestore && user) {
        addDoc(collection(firestore, 'failedCommands'), {
            userId: user.uid,
            commandText: commandText,
            language: spokenLang,
            reason: `No product or command matched for phrase: "${commandLower}"`,
            timestamp: serverTimestamp(),
        });
    }
    resetAllContext();

  }, [firestore, user, language, determinePhraseLanguage, updateRecognitionLanguage, speak, onStatusUpdate, resetAllContext, pathname, findProductAndVariant, storeAliasMap, homeAddressBtnRef, currentLocationBtnRef, placeOrderBtnRef, profileForm, saveInventoryBtnRef, setActiveStoreId, isWaitingForAddressType, isWaitingForStoreName, handleProfileFormInteraction, runCheckoutPrompt, getProductName, cartItemsProp.length, setLanguage, addItemToCart, onOpenCart]);


  useEffect(() => {
    if (!recognition) {
      onStatusUpdate("Speech recognition not supported by this browser.");
      return;
    }

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

    // This is the key change: the onend handler.
    recognition.onend = () => {
        // Only restart if the mic was intentionally enabled by the user
        // and we are not in the middle of speaking a reply.
        if (isEnabledRef.current && !isSpeakingRef.current) {
            try {
                // A brief delay can help prevent rapid restart loops on some systems.
                setTimeout(() => {
                    if (isEnabledRef.current && !isSpeakingRef.current && recognition) {
                        try {
                           recognition.start();
                        } catch(e) {
                           // This can happen if it's already starting. Safe to ignore.
                        }
                    }
                }, 100); 
            } catch (e) {
                // This can happen if start() is called while it's already starting.
                // It's safe to ignore in this context.
            }
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
        onCloseCart();
        if (cartTotal > 0) {
            // This is the important change: trigger the voice prompt *after* navigating
            router.push('/checkout');
            triggerVoicePrompt();
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
      orderItem: async ({ phrase, originalText }: { phrase?: string; originalText: string }) => {
        if (!phrase) return;

        const { product, variant, requestedQty, matchedAlias, lang } = await findProductAndVariant(phrase);

        if (product && variant) {
            const replyProductName = matchedAlias || getProductName(product);
            const speech = t('adding-item-speech', lang)
                .replace('{quantity}', `${requestedQty} ${variant.weight}`)
                .replace('{productName}', replyProductName);
            speak(speech, lang + '-IN');
            addItemToCart(product, variant, requestedQty);
            onOpenCart();
        } else {
            const detectedLang = determinePhraseLanguage(originalText);
            speak(t('sorry-i-didnt-understand-that', detectedLang), detectedLang + '-IN');
            if (firestore && user) {
                // Find best guess for logging
                let bestGuess: { product: Product, similarity: number } | null = null;
                for (const p of masterProducts) {
                    const similarity = calculateSimilarity(phrase, p.name.toLowerCase());
                    if (!bestGuess || similarity > bestGuess.similarity) {
                        bestGuess = { product: p, similarity: similarity };
                    }
                }
                
                const logData: Partial<FailedVoiceCommand> = {
                    userId: user.uid,
                    commandText: originalText,
                    language: detectedLang,
                    reason: `No matching product found for phrase: "${phrase}"`,
                    timestamp: serverTimestamp(),
                    suggestedProduct: bestGuess?.product.name,
                    similarityScore: bestGuess?.similarity,
                };
                
                addDoc(collection(firestore, 'failedCommands'), logData);
            }
        }
    },
    orderMultipleItems: async (phrases: string[], lang: string, originalText: string) => {
        let addedItems: string[] = [];
        let failedItems: string[] = [];
        let detectedLang = lang;

        for (const phrase of phrases) {
            if (!phrase.trim()) continue;
            const { product, variant, requestedQty, matchedAlias, lang: itemLang } = await findProductAndVariant(phrase);
             if (itemLang !== detectedLang) detectedLang = itemLang;

            if (product && variant) {
                addItemToCart(product, variant, requestedQty);
                const replyProductName = matchedAlias || getProductName(product);
                addedItems.push(`${requestedQty} ${replyProductName}`);
            } else {
                failedItems.push(phrase);
            }
        }

        let speech = "";
        if (addedItems.length > 0) {
            speech += t('ive-added-to-your-cart', detectedLang).replace('{items}', addedItems.join(', '));
            onOpenCart();
        }
        if (failedItems.length > 0) {
            if (speech) speech += " ";
            speech += t('but-i-couldnt-find', detectedLang).replace('{items}', failedItems.join(', '));
            if (firestore && user) {
               addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: originalText, language: detectedLang, reason: `Multi-item match failed for: "${failedItems.join(', ')}"`, timestamp: serverTimestamp() });
            }
        }
        if (!speech) {
            speech = t('sorry-i-couldnt-find-any-items', detectedLang);
             if (firestore && user) {
                addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: originalText, language: detectedLang, reason: 'Multi-item match failed for all items', timestamp: serverTimestamp() });
            }
        }
        speak(speech, detectedLang + '-IN');
    },
    smartOrder: async (command: string, lang: string, originalText: string) => {
        let remainingCommand = command.toLowerCase();
        const multiItemSeparators = / and | , | and then | then /i;
        let detectedLang = lang;

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
        
        let addedItems: {name: string, qty: number}[] = [];
        let failedItems: string[] = [];

        for (const phrase of productPhrases) {
            if (!phrase.trim()) continue;
            const { product, variant, requestedQty, matchedAlias, lang: itemLang } = await findProductAndVariant(phrase);
            if (itemLang !== detectedLang) detectedLang = itemLang;

            if (product && variant) {
                addItemToCart(product, variant, requestedQty);
                const replyProductName = matchedAlias || getProductName(product);
                addedItems.push({ name: replyProductName, qty: requestedQty });
            } else {
                failedItems.push(phrase);
            }
        }

        if (addedItems.length === 0) {
            speak(t('could-not-find-product-in-order-speech', detectedLang), detectedLang + '-IN');
            if(firestore && user) addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: originalText, language: detectedLang, reason: `Smart order: no products found in "${productPhrase}"`, timestamp: serverTimestamp() });
            return;
        }

        if (!bestStoreMatch) {
            speak(t('could-not-identify-store-speech', detectedLang), detectedLang + '-IN');
             if(firestore && user) addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: originalText, language: detectedLang, reason: 'Smart order: store not found', timestamp: serverTimestamp() });
            return;
        }
        if (destination === 'home' && (!userProfileRef.current || !userProfileRef.current.address)) {
            speak(t('cannot-deliver-home-no-address-speech', detectedLang), detectedLang + '-IN', () => {
              router.push('/dashboard/customer/my-profile');
            });
            return;
        }

        const speech = t('preparing-order-speech', detectedLang)
            .replace('{qty}', '') // Quantity is plural, so we remove it
            .replace('{productName}', addedItems.map(i => `${i.qty} ${i.name}`).join(', '))
            .replace('{storeName}', bestStoreMatch.store.name);
        speak(speech, detectedLang + '-IN');

        setActiveStoreId(bestStoreMatch.store.id);

        if (destination === 'home' && userProfileRef.current?.address) {
            setHomeAddress(userProfileRef.current.address);
        } else {
             setHomeAddress(null);
        }

        setShouldPlaceOrderDirectly(true);
        router.push('/checkout');
    },
    checkPrice: async ({ phrase, lang, originalText }: { phrase?: string; lang: string, originalText: string }) => {
      if (!phrase) return;

      // Clean the phrase by removing the price check keywords first
      const priceKeywords = [t('checkPrice', lang).toLowerCase(), ...Object.values(getAllAliases('checkPrice')).flat().map(a => a.toLowerCase())];
      const productPhrase = priceKeywords.reduce((acc, keyword) => acc.replace(keyword, ''), phrase).trim();

      const { product, lang: detectedLang } = await findProductAndVariant(productPhrase);

      if (product) {
        // We have a product, now fetch its price explicitly if not already cached
        let priceData = productPrices[product.name.toLowerCase()];
        if (priceData === undefined && firestore) {
          await fetchProductPrices(firestore, [product.name]);
          // After fetching, get the updated value from the store
          priceData = useAppStore.getState().productPrices[product.name.toLowerCase()];
        }
        
        if (priceData && priceData.variants && priceData.variants.length > 0) {
          const pricesString = priceData.variants.map(v => 
            t('price-check-variant-speech', detectedLang)
              .replace('{weight}', v.weight)
              .replace('{price}', `₹${v.price.toFixed(2)}`)
          ).join(', ');

          const reply = t('price-check-reply-speech', detectedLang)
            .replace('{productName}', getProductName(product))
            .replace('{prices}', pricesString);
          
          speak(reply, detectedLang + '-IN');
          return;

        } else {
          speak(t('no-price-found-speech', detectedLang).replace('{productName}', getProductName(product)), detectedLang + '-IN');
          if (firestore && user) {
            addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: originalText, language: detectedLang, reason: `Price check: product "${product.name}" found but no price data available.`, timestamp: serverTimestamp() });
          }
           return;
        }
      }
      
      // If we reach here, no product was found
      speak(t('sorry-i-didnt-understand-that', lang), lang + '-IN');
      if (firestore && user) {
        // Find best guess for logging
        let bestGuess: { product: Product, similarity: number } | null = null;
        for (const p of masterProducts) {
            const similarity = calculateSimilarity(productPhrase, p.name.toLowerCase());
            if (!bestGuess || similarity > bestGuess.similarity) {
                bestGuess = { product: p, similarity: similarity };
            }
        }
        
        const logData: Partial<FailedVoiceCommand> = {
            userId: user.uid,
            commandText: originalText,
            language: lang,
            reason: `Price check: product not found in phrase "${productPhrase}".`,
            timestamp: serverTimestamp(),
            suggestedProduct: bestGuess?.product.name,
            similarityScore: bestGuess?.similarity,
        };
        addDoc(collection(firestore, 'failedCommands'), logData);
      }
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
        recognition.stop();
      }
    };
  }, [handleCommand, cartTotal, cartItemsProp, pathname, masterProducts]);

  useEffect(() => {
    console.log('Current language changed to:', language);
  }, [language]);

  return null;
}

