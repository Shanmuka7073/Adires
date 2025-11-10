

'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, errorEmitter } from '@/firebase';
import type { Store, Product, ProductPrice, CartItem, User, FailedVoiceCommand, ProductVariant, VoiceAlias } from '@/lib/types';
import { calculateSimilarity } from '@/lib/calculate-similarity';
import { useCart } from '@/lib/cart';
import { useAppStore } from '@/lib/store';
import { useProfileFormStore } from '@/app/dashboard/customer/my-profile/page';
import { useCheckoutStore } from '@/app/checkout/page';
import { useMyStorePageStore } from '@/lib/store';
import { t, initializeTranslations } from '@/lib/locales';
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
  triggerVoicePrompt: () => void;
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
  triggerVoicePrompt,
}: VoiceCommanderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const { clearCart, addItem: addItemToCart, updateQuantity, activeStoreId, setActiveStoreId, cartTotal } = useCart();

  const { stores, masterProducts, productPrices, fetchProductPrices, getProductName, language, setLanguage, getAllAliases, locales, commands } = useAppStore();

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
  const commandActionsRef = useRef<any>({});

  const formFieldToFillRef = useRef<any>(null);
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
      
      const normalizedCanonicalName = p.name.toLowerCase();
      map.set(normalizedCanonicalName, { product: p, lang: 'en' });
      map.set(normalizedCanonicalName.replace(/\s+/g, ''), { product: p, lang: 'en' });

      for (const lang in productAliasesByLang) {
        for (const alias of productAliasesByLang[lang]) {
          const normalizedAlias = alias.toLowerCase();
          map.set(normalizedAlias, { product: p, lang: lang });
          map.set(normalizedAlias.replace(/\s+/g, ''), { product: p, lang: lang });
        }
      }
    }
    return map;
  }, [masterProducts, getAllAliases]);

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
  }, [stores, getAllAliases]);


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


  const determinePhraseLanguage = useCallback((text: string): string => {
    const lowerText = text.toLowerCase();
    
    const transliteratedGreetings = ['హై', 'హలో'];
    if (transliteratedGreetings.some(greeting => lowerText.includes(greeting))) {
      return 'en';
    }

    const langKeywords = [
        { lang: 'te', keywords: ['నాకు', 'కావాలి', 'naku', 'naaku', 'kavali', 'ధర'] },
        { lang: 'hi', keywords: ['मुझे', 'चाहिए', 'mujhe', 'chahiye'] },
        { lang: 'en', keywords: ['i want', 'i need', 'get me', 'add', 'get', 'buy', 'order', 'send', 'go', 'open', 'what is', 'how', 'price', 'cost'] }
    ];
     for (const langInfo of langKeywords) {
        if (langInfo.keywords.some(keyword => lowerText.includes(keyword))) {
            return langInfo.lang;
        }
    }

    // Check all aliases
     for (const key in locales) {
        const langAliases = locales[key];
        for (const lang in langAliases) {
             if (lang === 'display' || lang === 'reply') continue;
            const aliases = Array.isArray(langAliases[lang]) ? langAliases[lang] as string[] : [langAliases[lang] as string];
            if (aliases.some(alias => lowerText.includes(alias.toLowerCase()))) {
                if (lang !== 'en') return lang;
            }
        }
    }

    return language; // Default to the current app language
  }, [language, locales]);


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
    initializeTranslations(locales);

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
  }, [locales]);

  useEffect(() => {
    isEnabledRef.current = enabled;
    if (recognition) {
        if (enabled) {
            recognition.lang = language === 'te' ? 'te-IN' : 'en-IN';
            recognition.continuous = false;
            recognition.interimResults = false;
            try {
                recognition.start();
            } catch (e) {
                 if (! (e instanceof DOMException && e.name === 'InvalidStateError')) {
                    console.error("Could not start recognition:", e);
                }
            }
        } else {
            recognition.onend = null; 
            recognition.stop();
        }
    }
}, [enabled, language]);

  const speak = useCallback((text: string, lang: string, onEndCallback?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      if (onEndCallback) onEndCallback();
      return;
    }

    if (recognition) {
        recognition.stop();
    }
    window.speechSynthesis.cancel();
    isSpeakingRef.current = true;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1;
    utterance.rate = 1.1;
    utterance.lang = lang;

    // --- New Intelligent Voice Selection Logic ---
    const allVoices = speechSynthesisVoices;
    let selectedVoice: SpeechSynthesisVoice | null = null;

    if (lang.startsWith('en')) {
        // 1. Prioritize specific, high-quality local English (India) voices by name
        const preferredIndianVoice = allVoices.find(voice => voice.lang === 'en-IN' && voice.name.includes('Rishi'));
        if (preferredIndianVoice) {
            selectedVoice = preferredIndianVoice;
        } else {
            // 2. Fallback: Find any local 'en-IN' voice.
            const localIndianVoice = allVoices.find(voice => voice.lang === 'en-IN' && voice.localService);
            if (localIndianVoice) {
                selectedVoice = localIndianVoice;
            } else {
                // 3. Fallback: Find any 'en-IN' voice.
                const anyIndianVoice = allVoices.find(voice => voice.lang === 'en-IN');
                if (anyIndianVoice) {
                    selectedVoice = anyIndianVoice;
                } else {
                    // 4. Ultimate fallback to any available English voice if no en-IN is found
                    selectedVoice = allVoices.find(voice => voice.lang.startsWith('en') && voice.localService) || allVoices.find(voice => voice.lang.startsWith('en')) || null;
                }
            }
        }
    } else {
        // For other languages like Telugu, find the best match for the language code.
        selectedVoice = allVoices.find(voice => voice.lang === lang && voice.localService) || allVoices.find(voice => voice.lang === lang) || null;
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    // --- End of New Logic ---

    utterance.onend = () => {
      isSpeakingRef.current = false;
      if (onEndCallback) onEndCallback();
      
      if (isEnabledRef.current && recognition) {
        try {
            recognition.start();
        } catch(e) {
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
    
    window.speechSynthesis.speak(utterance);
  }, [speechSynthesisVoices]);

  const handleProfileFormInteraction = useCallback(() => {
    if (!profileForm) {
      speak("I can't seem to access the profile form right now.", 'en-IN');
      return;
    }
    const fields: { name: keyof typeof profileForm.getValues; label: string }[] = [
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

  const promptTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const runCheckoutPrompt = useCallback(() => {
      if (pathname !== '/checkout' || !hasMounted || !enabled || isSpeakingRef.current) {
          return;
      }
      if (promptTimeoutRef.current) {
        return;
      }

      promptTimeoutRef.current = setTimeout(() => {
        const detectedLang = language;
        const langWithRegion = detectedLang === 'en' ? 'en-IN' : `${detectedLang}-IN`;

        const addressInput = typeof document !== 'undefined' ? (document.querySelector('input[name="deliveryAddress"]') as HTMLInputElement) : null;
        const currentAddress = addressInput?.value || '';
        
        if (cartItemsProp.length === 0 && !isWaitingForQuickOrderConfirmation) {
            speak(t('your-cart-is-empty-speech', detectedLang), langWithRegion);
        } else if (!currentAddress || currentAddress.length < 10) {
            speak(t('should-i-deliver-to-home-or-current-speech', detectedLang), langWithRegion);
            setIsWaitingForAddressType(true);
        } else if (!activeStoreId) {
            speak(t('which-store-should-fulfill-speech', detectedLang), langWithRegion);
            setIsWaitingForStoreName(true);
        } else {
            const total = cartTotal + 30;
            const speech = t('finalConfirmPrompt', detectedLang).replace('{total}', `₹${total.toFixed(2)}`);
            speak(speech, langWithRegion);
        }
        promptTimeoutRef.current = null;
      }, 250);
  }, [
      pathname, hasMounted, enabled, isWaitingForQuickOrderConfirmation,
      cartItemsProp.length, language, speak,
      setIsWaitingForAddressType, setIsWaitingForStoreName, cartTotal, t, activeStoreId
  ]);
  
  useEffect(() => {
      if (pathname === '/checkout' && hasMounted && enabled && voiceTrigger > 0) {
        runCheckoutPrompt();
      }
  }, [voiceTrigger, pathname, hasMounted, enabled, runCheckoutPrompt]);

  useEffect(() => {
    if (pathname === '/checkout' && enabled && !isSpeakingRef.current) {
      runCheckoutPrompt();
    }
    
    return () => {
      if (promptTimeoutRef.current) {
        clearTimeout(promptTimeoutRef.current);
        promptTimeoutRef.current = null;
      }
    };
  }, [activeStoreId, runCheckoutPrompt, enabled, pathname]);


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
    let lowerPhrase = phrase.toLowerCase();

    const numberWords: Record<string, number> = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'ఒకటి': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'ఐదు': 5, 'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9, 'పది': 10, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'छह': 6, 'सात': 8, 'नौ': 9, 'दस': 10 };
    const unitKeywords: Record<string, { aliases: string[], type: 'kg' | 'gm' | 'pc' | 'pack' }> = {
      'kg': { aliases: ['kg', 'kilo', 'kilos', 'కిలో', 'కేజీ'], type: 'kg'},
      'gm': { aliases: ['gm', 'g', 'grams', 'గ్రాములు'], type: 'gm'},
      'pc': { aliases: ['pc', 'piece', 'pieces'], type: 'pc'},
      'pack': { aliases: ['pack', 'packet', 'ప్యాక్'], type: 'pack'}
    };

    let requestedQty = 1;
    let requestedUnit: string | null = null;
    let matchedUnitKeyword: string | null = null;

    // 1. Extract numbers (digit or word)
    const numMatch = lowerPhrase.match(/(\d+)/);
    const wordNumMatch = lowerPhrase.match(new RegExp(`\\b(${Object.keys(numberWords).join('|')})\\b`, 'i'));

    if (numMatch) {
      requestedQty = parseInt(numMatch[0], 10);
      lowerPhrase = lowerPhrase.replace(numMatch[0], '').trim();
    } else if (wordNumMatch) {
      requestedQty = numberWords[wordNumMatch[0].toLowerCase()];
      lowerPhrase = lowerPhrase.replace(wordNumMatch[0], '').trim();
    }

    // 2. Extract units
    for (const unitType in unitKeywords) {
        const { aliases, type } = unitKeywords[unitType];
        const unitRegex = new RegExp(`\\b(${aliases.join('|')})\\b`, 'i');
        const unitMatch = lowerPhrase.match(unitRegex);
        if (unitMatch) {
            requestedUnit = type;
            matchedUnitKeyword = unitMatch[0];
            break;
        }
    }
    
    // Remove the matched unit keyword from the phrase to clean it for product matching
    if (matchedUnitKeyword) {
      lowerPhrase = lowerPhrase.replace(new RegExp(`\\b${matchedUnitKeyword}\\b`, 'i'), '').trim();
    }

    // 3. Fuzzy match the remaining phrase for the product name
    let bestMatch: { product: Product, alias: string, similarity: number, lang: string } | null = null;
    for (const [alias, { product, lang }] of universalProductAliasMap.entries()) {
      const similarity = calculateSimilarity(lowerPhrase, alias);
      if (similarity > (bestMatch?.similarity || 0.6)) {
        bestMatch = { product, alias, similarity, lang };
      }
    }
    
    if (!bestMatch) return { product: null, variant: null, requestedQty: 1, remainingPhrase: phrase, matchedAlias: null, lang: 'en' };

    const { product: productMatch, alias: matchedAlias, lang: detectedLang } = bestMatch;
    let remainingPhrase = lowerPhrase.replace(matchedAlias, '').trim();

    let priceData = productPrices[productMatch.name.toLowerCase()];
    if (priceData === undefined && firestore) {
      await fetchProductPrices(firestore, [productMatch.name]);
      priceData = useAppStore.getState().productPrices[productMatch.name.toLowerCase()];
    }
    
    if (!priceData?.variants?.length) return { product: productMatch, variant: null, requestedQty: 1, remainingPhrase, matchedAlias, lang: detectedLang };
    
    // 4. Select the best variant based on the extracted unit
    let chosenVariant: ProductVariant | null = null;
    if (requestedUnit) {
      // Find a variant that explicitly matches the unit type (e.g., contains 'kg')
      chosenVariant = priceData.variants.find(v => v.weight.toLowerCase().includes(requestedUnit)) || null;
    }

    // Fallback logic if no unit was spoken or no variant matched the unit
    if (!chosenVariant) {
      chosenVariant = 
        priceData.variants.find(v => v.weight === '1kg') ||
        priceData.variants.find(v => v.weight.includes('kg')) ||
        priceData.variants.find(v => v.weight.includes('pc')) ||
        priceData.variants[0]; // Default to the first available variant
    }
    
    return { product: productMatch, variant: chosenVariant, requestedQty, remainingPhrase, matchedAlias, lang: detectedLang };

  }, [firestore, productPrices, fetchProductPrices, universalProductAliasMap]);

  const handleCommand = useCallback(async (commandText: string) => {
    if (!firestore || !user) {
        speak("I can't process commands without being connected. Please log in.", 'en-IN');
        return;
    }

    const commandLower = commandText.toLowerCase();
    const spokenLang = determinePhraseLanguage(commandText);
    const langWithRegion = spokenLang === 'en' ? 'en-IN' : `${spokenLang}-IN`;
    const didLanguageChange = spokenLang !== language;

    if (didLanguageChange) {
        setLanguage(spokenLang);
        updateRecognitionLanguage(langWithRegion);
    }
    
     // --- PRIORITY 1: CONTEXTUAL RESPONSES (The State Machine) ---
    if (isWaitingForAddressType) {
        const homeKeywords = getAllAliases('homeAddress')[spokenLang] || ['home'];
        const locationKeywords = getAllAliases('currentLocation')[spokenLang] || ['current'];
        
        const homeSimilarity = Math.max(...homeKeywords.map(kw => calculateSimilarity(commandLower, kw)));
        const locationSimilarity = Math.max(...locationKeywords.map(kw => calculateSimilarity(commandLower, kw)));

        if (homeSimilarity > 0.6 && homeSimilarity > locationSimilarity) {
            homeAddressBtnRef?.current?.click();
            speak(t('setting-delivery-to-home-speech', spokenLang), langWithRegion);
        } else if (locationSimilarity > 0.6) {
            currentLocationBtnRef?.current?.click();
            speak(t('using-current-location-speech', spokenLang), langWithRegion);
        } else {
            speak(t('did-not-understand-address-type-speech', spokenLang), langWithRegion);
            if (firestore && user) {
                addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: commandText, language: spokenLang, reason: `Address type clarification failed. Similarities: Home=${homeSimilarity.toFixed(2)}, Location=${locationSimilarity.toFixed(2)}`, timestamp: serverTimestamp() });
            }
        }
        resetAllContext();
        triggerVoicePrompt(); // Ask the next question
        return;
    }

    if (isWaitingForStoreName) {
        let bestMatch: { store: Store, similarity: number } | null = null;
        for (const [alias, store] of storeAliasMap.entries()) {
            const similarity = calculateSimilarity(commandLower, alias);
            if (!bestMatch || similarity > bestMatch.similarity) {
                bestMatch = { store, similarity: similarity };
            }
        }

       if (bestMatch && bestMatch.similarity > 0.6) {
           const store = bestMatch.store;
           speak(t('okay-ordering-from-speech', spokenLang).replace('{storeName}', store.name), langWithRegion, () => {
               setActiveStoreId(store.id);
               triggerVoicePrompt();
           });
       } else {
           speak(t('could-not-find-store-speech', spokenLang).replace('{storeName}', commandText), langWithRegion);
            if (firestore && user) {
                addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: commandText, language: spokenLang, reason: `Store clarification failed. Best match: ${bestMatch?.store.name} (${bestMatch?.similarity.toFixed(2)})`, timestamp: serverTimestamp() });
            }
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
    
    // --- PRIORITY 2: CHECK FOR SPECIFIC COMMANDS (PRICE CHECK) FIRST ---
    const checkPriceKeywords = [...(getAllAliases('checkPrice')['en'] || []), ...(getAllAliases('checkPrice')['te'] || []), 'cost of', 'price of'];
    const isPriceCheck = checkPriceKeywords.some(kw => commandLower.includes(kw));

    if (isPriceCheck) {
        await commandActionsRef.current.checkPrice({ phrase: commandLower, lang: spokenLang, originalText: commandText });
        resetAllContext();
        return;
    }

    // --- PRIORITY 3: GLOBAL & GENERAL COMMANDS ---
    const allCommandKeys = Object.keys(commands);
    let bestCommandMatch: { key: string, similarity: number, reply: string, display: string } | null = null;
    
    for (const key of allCommandKeys) {
        const commandAliases = getAllAliases(key);
        const allAliasStrings = Object.values(commandAliases).flat();

        for (const alias of allAliasStrings) {
            const similarity = calculateSimilarity(commandLower, alias.toLowerCase());
            if (similarity > (bestCommandMatch?.similarity || 0.85)) { // Higher threshold for general commands
                bestCommandMatch = {
                    key,
                    similarity,
                    reply: commands[key].reply || `Executing ${commands[key].display}.`,
                    display: commands[key].display
                };
            }
        }
    }
    
    if (bestCommandMatch) {
        const action = commandActionsRef.current[bestCommandMatch.key];
        if (action) {
            speak(bestCommandMatch.reply, langWithRegion, () => action({ lang: spokenLang, phrase: commandLower, originalText: commandText }));
        } else {
            speak(bestCommandMatch.reply, langWithRegion);
        }
        resetAllContext();
        return;
    }
    
    // --- PRIORITY 4: ORDERING & PRODUCT-RELATED COMMANDS ---
    const multiItemSeparators = new RegExp(`\\s+(${['and', 'మరియు', 'aur'].join('|')})\\s+`, 'i');
    const potentialItems = commandLower.split(multiItemSeparators).filter(s => s && !['and', 'మరియు', 'aur'].includes(s));

    if (potentialItems.length > 1) {
        await commandActionsRef.current.orderMultipleItems(potentialItems, spokenLang, commandText);
        resetAllContext();
        return;
    }
    
    // Check for smart order keywords like "from" and "to"
    const locationKeywords = ['from', 'to', 'నుండి', 'కి'];
    if (locationKeywords.some(kw => commandLower.includes(kw))) {
        await commandActionsRef.current.smartOrder(commandLower, spokenLang, commandText);
        resetAllContext();
        return;
    }

    const { product, variant, requestedQty, matchedAlias, lang: itemLang } = await findProductAndVariant(commandLower);

    if (product && variant) {
        addItemToCart(product, variant, requestedQty);
        onOpenCart();
        
        const productLang = itemLang || spokenLang;
        const replyProductName = t(product.name.toLowerCase().replace(/ /g, '-'), productLang);

        let speech = t('adding-item-speech', productLang)
            .replace('{quantity}', `${requestedQty}`)
            .replace('{weight}', `${variant.weight}`)
            .replace('{productName}', replyProductName);

        if (didLanguageChange) {
            speech += spokenLang === 'te' ? " నేను మీ కోసం తెలుగుకి మారాను." : " I've also switched to English for you.";
        }
            
        speak(speech, productLang + '-IN');
        resetAllContext();
        return;
    }
    
    // --- LAST RESORT: FAILURE ---
    let failSpeech = t('sorry-i-didnt-understand-that', spokenLang);
    let reason = `No product or command matched for phrase: "${commandLower}"`;

    if(matchedAlias && !variant) {
        failSpeech = t('no-price-found-speech', spokenLang).replace('{productName}', product?.name || 'that item');
        reason = `Product "${product?.name}" found but no variants available.`;
    }
    else if (product && !variant) {
         failSpeech = t('no-price-found-speech', spokenLang).replace('{productName}', product.name);
         reason = `Product "${product.name}" found but no variants available.`;
    }
    else {
        failSpeech = t('could-not-find-item-speech', spokenLang).replace('{itemName}', commandText);
    }
    
    speak(failSpeech, langWithRegion);

    if (firestore && user) {
        addDoc(collection(firestore, 'failedCommands'), {
            userId: user.uid,
            commandText: commandText,
            language: spokenLang,
            reason: reason,
            timestamp: serverTimestamp(),
        });
    }
    resetAllContext();

  }, [firestore, user, language, determinePhraseLanguage, updateRecognitionLanguage, speak, resetAllContext, pathname, findProductAndVariant, storeAliasMap, homeAddressBtnRef, currentLocationBtnRef, placeOrderBtnRef, profileForm, saveInventoryBtnRef, setActiveStoreId, isWaitingForAddressType, isWaitingForStoreName, handleProfileFormInteraction, runCheckoutPrompt, getProductName, cartItemsProp.length, setLanguage, addItemToCart, onOpenCart, locales, commands, getAllAliases, t, triggerVoicePrompt]);


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
      onStatusUpdate(`Processing: "${transcript}"`);
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
            try {
                setTimeout(() => {
                    if (isEnabledRef.current && !isSpeakingRef.current && recognition) {
                         recognition.start();
                    }
                }, 250); 
            } catch (e) {
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
      myProfile: (params) => router.push('/dashboard/customer/my-profile'),
      checkout: (params: { lang: string }) => {
        const lang = params.lang || language;
        onCloseCart();
        if (cartTotal > 0) {
            const total = cartTotal + 30; // Delivery fee
            speak(t('proceeding-to-checkout-speech', lang).replace('{total}', `₹${total.toFixed(2)}`), lang + '-IN', () => {
                router.push('/checkout');
                triggerVoicePrompt();
            });
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
        const lang = params?.lang || language;
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
        speak(`Okay, opening ${store.name}.`, langWithRegion);
        router.push(`/stores/${store.id}`);
      },
      orderItem: async ({ phrase, originalText }: { phrase?: string; originalText: string }) => {
        if (!phrase) return;

        const { product, variant, requestedQty, matchedAlias, lang } = await findProductAndVariant(phrase);

        if (product && variant) {
            const replyProductName = t(product.name.toLowerCase().replace(/ /g, '-'), lang);
            const speech = t('adding-item-speech', lang)
                .replace('{quantity}', `${requestedQty}`)
                .replace('{weight}', `${variant.weight}`)
                .replace('{productName}', replyProductName);
            speak(speech, lang + '-IN');
            addItemToCart(product, variant, requestedQty);
            onOpenCart();
        } else {
            const detectedLang = determinePhraseLanguage(originalText);
            speak(t('sorry-i-didnt-understand-that', detectedLang), detectedLang + '-IN');
            if (firestore && user) {
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
                const replyProductName = t(product.name.toLowerCase().replace(/ /g, '-'), detectedLang);
                addedItems.push(`${requestedQty} ${variant.weight} of ${replyProductName}`);
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
            if (speech) speech += ". ";
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
        
        let addedItems: {name: string, qty: number, weight: string}[] = [];
        let failedItems: string[] = [];

        for (const phrase of productPhrases) {
            if (!phrase.trim()) continue;
            const { product, variant, requestedQty, matchedAlias, lang: itemLang } = await findProductAndVariant(phrase);
            if (itemLang !== detectedLang) detectedLang = itemLang;

            if (product && variant) {
                addItemToCart(product, variant, requestedQty);
                const replyProductName = t(product.name.toLowerCase().replace(/ /g, '-'), detectedLang);
                addedItems.push({ name: replyProductName, qty: requestedQty, weight: variant.weight });
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
            .replace('{items}', addedItems.map(i => `${i.qty} ${i.weight} of ${i.name}`).join(', '))
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

      const checkPriceAliases = [...(getAllAliases('checkPrice')[lang] || []), 'cost of', 'price of'];
      const productPhrase = checkPriceAliases.reduce((acc, keyword) => acc.replace(keyword, ''), phrase).trim();

      const { product, lang: detectedLang } = await findProductAndVariant(productPhrase);

      if (product) {
        let priceData = productPrices[product.name.toLowerCase()];
        if (priceData === undefined && firestore) {
          await fetchProductPrices(firestore, [product.name]);
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
      
      speak(t('sorry-i-didnt-understand-that', lang), lang + '-IN');
      if (firestore && user) {
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
    }


    return () => {
      if (recognition) {
        recognition.onend = null;
        recognition.stop();
      }
    };
  }, [handleCommand, cartTotal, cartItemsProp, pathname, masterProducts, t]);

  useEffect(() => {
    console.log('Current language changed to:', language);
  }, [language]);

  return null;
}
