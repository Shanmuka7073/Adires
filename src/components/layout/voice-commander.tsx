

'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, errorEmitter } from '@/firebase';
import type { Store, Product, ProductPrice, CartItem, User, FailedVoiceCommand, ProductVariant, VoiceAlias, MonthlyPackage } from '@/lib/types';
import { calculateSimilarity } from '@/lib/calculate-similarity';
import { useCart } from '@/lib/cart';
import { useAppStore } from '@/lib/store';
import { useProfileFormStore } from '@/app/dashboard/customer/my-profile/page';
import { useMyStorePageStore } from '@/lib/store';
import { t, initializeTranslations } from '@/lib/locales';
import { doc, getDoc, serverTimestamp, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import groceryData from '@/lib/grocery-data.json';
import { getIngredientsForRecipe, answerGeneralQuestion, generatePack, suggestAliasTarget } from '@/app/actions';
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import { getCachedAIResponse, cacheAIResponse } from '@/lib/ai-cache';
import { useCheckoutStore } from '@/app/checkout/page';


export interface Command {
  command: string;
  action: (params?: any) => void;
  display: string;
  reply: string | string[]; // Can now be an array
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

// --- NEW: Intent Recognition System ---
type Intent = 
  | { type: 'SMART_ORDER', originalText: string, lang: string }
  | { type: 'CHECK_PRICE', productPhrase: string, originalText: string, lang: string }
  | { type: 'ORDER_ITEM', originalText: string, lang: string }
  | { type: 'REMOVE_ITEM', productPhrase: string, originalText: string, lang: string }
  | { type: 'NAVIGATE', destination: string, originalText: string, lang: string }
  | { type: 'CONVERSATIONAL', commandKey: string, originalText: string, lang: string }
  | { type: 'GET_RECIPE', dishName: string, originalText: string, lang: string }
  | { type: 'SHOW_DETAILS', target: string, originalText: string, lang: string }
  | { type: 'ADD_PACK', packType: string, familySize: number, originalText: string, lang: string }
  | { type: 'WAKE_WORD', originalText: string, lang: string }
  | { type: 'UNKNOWN', originalText: string, lang: string };

const intentKeywords = {
  SMART_ORDER: ['order', 'buy', 'get', 'send'],
  CHECK_PRICE: ['price of', 'cost of', 'how much for', 'rate for', 'ధర', 'రేటు'],
  ORDER_ITEM: ['order', 'add', 'buy', 'get', 'send', 'నాకు', 'కావాలి'],
  REMOVE_ITEM: ['remove', 'delete', 'take out', 'తీసివేయి', 'తొలగించు'],
  NAVIGATE: ['go to', 'open', 'show', 'వెళ్ళు', 'చూపించు'],
  CONVERSATIONAL: ['help', 'what can', 'who are you', 'how does'],
  GET_RECIPE: ['recipe for', 'ingredients for', 'how to make', 'కోసం కావలసినవి', 'ఎలా చేయాలి'],
  SHOW_DETAILS: ['details for', 'show details', 'view details', 'వివరాలు చూపించు'],
  ADD_PACK: ['pack for', 'package for', 'ప్యాక్'],
};


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
}: {
  enabled: boolean;
  onStatusUpdate: (status: string) => void;
  onSuggestions: (suggestions: any[]) => void;
  onOpenCart: () => void;
  onCloseCart: () => void;
  isCartOpen: boolean;
  cartItems: CartItem[];
  voiceTrigger: number;
  triggerVoicePrompt: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const { clearCart, addItem: addItemToCart, removeItem, updateQuantity, activeStoreId, setActiveStoreId, cartTotal } = useCart();

  const { stores, masterProducts, productPrices, fetchProductPrices, getProductName, language, setLanguage, getAllAliases, locales, commands, fetchInitialData } = useAppStore();

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const formFieldToFillRef = useRef<any>(null);
  const [isWaitingForStoreName, setIsWaitingForStoreName] = useState(false);
  const [isWaitingForVoiceOrder, setIsWaitingForVoiceOrder] = useState(false);
  const [clarificationStores, setClarificationStores] = useState<Store[]>([]);
  const [isWaitingForAddressType, setIsWaitingForAddressType] = useState(false);
  const [itemForPriceCheck, setItemForPriceCheck] = useState<Product | null>(null);

  const [isWaitingForQuantity, setIsWaitingForQuantity] = useState(false);
  const itemToUpdateSkuRef = useRef<string | null>(null);
  const [isAiModeActive, setIsAiModeActive] = useState(false);
  
  const [isWaitingForPackStoreConfirmation, setIsWaitingForPackStoreConfirmation] = useState(false);
  const pendingPackRequestRef = useRef<{ packType: string; familySize: number; lang: string } | null>(null);

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
    setItemForPriceCheck(null);
    setIsWaitingForPackStoreConfirmation(false);
    pendingPackRequestRef.current = null;
    // Don't reset AI mode here, it's persistent now
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

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const getVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          setSpeechSynthesisVoices(voices);
        }
      };
      getVoices();
      window.speechSynthesis.onvoiceschanged = getVoices;
    }
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

  const speak = useCallback((textOrReplies: string | string[], lang: string, onEndCallback?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onEndCallback) onEndCallback();
      return;
    }
    
    if (recognition) {
      recognition.stop();
    }

    isSpeakingRef.current = true;
    window.speechSynthesis.cancel();
    
    const text = Array.isArray(textOrReplies) 
      ? textOrReplies[Math.floor(Math.random() * textOrReplies.length)] 
      : textOrReplies;

    const utterance = new SpeechSynthesisUtterance(text);
    
    const targetLang = lang.split('-')[0];
    let voice = speechSynthesisVoices.find(v => v.lang.startsWith(targetLang) && v.name.includes('Google')) ||
                speechSynthesisVoices.find(v => v.lang.startsWith(targetLang)) ||
                speechSynthesisVoices.find(v => v.default);
    
    if (voice) {
      utterance.voice = voice;
    } else {
      console.warn(`No voice found for language: ${lang}`);
    }

    utterance.onend = () => {
      isSpeakingRef.current = false;
      if (onEndCallback) onEndCallback();
      if (isEnabledRef.current && recognition) {
        try {
          recognition.start();
        } catch(e) {}
      }
    };
    
    utterance.onerror = (e) => {
      console.error('Speech synthesis error', e);
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
        let requestedQty = 1;
        let requestedUnit: 'kg' | 'gm' | 'pc' | 'pack' | null = null;
        let productNamePhrase = lowerPhrase;

        const numberWords: { [key: string]: number } = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'ఒకటి': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'ఐదు': 5, 'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9, 'పది': 10,
            'okati': 1, 'rendu': 2, 'moodu': 3, 'nalugu': 4, 'aidu': 5, 'aaru': 6, 'yedu': 7, 'enimidi': 8, 'tommidi': 9, 'padi': 10,
            'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'paanch': 5, 'chhe': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
        };

        const unitKeywords: { [key: string]: { type: 'kg' | 'gm' | 'pc' | 'pack' } } = {
            'kg': { type: 'kg' }, 'kilo': { type: 'kg' }, 'kilos': { type: 'kg' }, 'కిలో': { type: 'kg' }, 'కేజీ': { type: 'kg' }, 'किलो': { type: 'kg' },
            'gm': { type: 'gm' }, 'g': { type: 'gm' }, 'grams': { type: 'gm' }, 'గ్రాములు': { type: 'gm' }, 'ग्राम': { type: 'gm' },
            'pc': { type: 'pc' }, 'piece': { type: 'pc' }, 'pieces': { type: 'pc' }, 'పీస్': { type: 'pc' }, 'पीस': { type: 'pc' },
            'pack': { type: 'pack' }, 'packet': { type: 'pack' }, 'ప్యాక్': { type: 'pack' }, 'पैकेट': { type: 'pack' }
        };

        const words = lowerPhrase.split(' ').filter(Boolean);
        const remainingWords = [];
        
        for (const word of words) {
            let consumed = false;
            // Check for digit quantity
            if (!isNaN(parseInt(word))) {
                requestedQty = parseInt(word);
                consumed = true;
            }
            // Check for word quantity
            else if (numberWords[word]) {
                requestedQty = numberWords[word];
                consumed = true;
            }
            // Check for unit
            else if (unitKeywords[word]) {
                requestedUnit = unitKeywords[word].type;
                consumed = true;
            }

            if (!consumed) {
                remainingWords.push(word);
            }
        }
        productNamePhrase = remainingWords.join(' ');


        // 2. Fuzzy match the remaining phrase for the product name
        let bestMatch: { product: Product, alias: string, similarity: number, lang: string } | null = null;
        for (const [alias, { product, lang }] of universalProductAliasMap.entries()) {
            const similarity = calculateSimilarity(productNamePhrase, alias);
            if (!bestMatch || similarity > bestMatch.similarity) {
                if (similarity > 0.6) { // Lowered threshold for flexibility
                    bestMatch = { product, alias, similarity, lang };
                }
            }
        }

        if (!bestMatch) {
            return { product: null, variant: null, requestedQty: 1, remainingPhrase: phrase, matchedAlias: null, lang: 'en' };
        }

        const { product: productMatch, alias: matchedAlias, lang: detectedLang } = bestMatch;

        // 3. Find the best variant
        let priceData = productPrices[productMatch.name.toLowerCase()];
        if (!priceData && firestore) {
            await fetchProductPrices(firestore, [productMatch.name]);
            priceData = useAppStore.getState().productPrices[productMatch.name.toLowerCase()];
        }

        if (!priceData?.variants?.length) {
            return { product: productMatch, variant: null, requestedQty, remainingPhrase: productNamePhrase, matchedAlias, lang: detectedLang };
        }

        let chosenVariant: ProductVariant | null = null;
        if (requestedUnit) {
            chosenVariant = priceData.variants.find(v => v.weight.toLowerCase().includes(requestedUnit)) || null;
        }

        // Fallback variant logic
        if (!chosenVariant) {
            chosenVariant =
                priceData.variants.find(v => v.weight === '1kg') ||
                priceData.variants.find(v => v.weight.includes('kg')) ||
                priceData.variants.find(v => v.weight.includes('pc')) ||
                priceData.variants[0];
        }

        return { product: productMatch, variant: chosenVariant, requestedQty, remainingPhrase: productNamePhrase, matchedAlias, lang: detectedLang };

    }, [firestore, productPrices, fetchProductPrices, universalProductAliasMap]);

  const recognizeIntent = useCallback((text: string, spokenLang: string): Intent => {
    const lowerText = text.toLowerCase().trim();
    
    // 1. SMART ORDER - check for "from" and "to" keywords
    const fromKeywords = ['from', 'at', 'in'];
    const toKeywords = ['to', 'at'];
    const hasFrom = fromKeywords.some(kw => lowerText.includes(` ${kw} `));
    const hasTo = toKeywords.some(kw => lowerText.includes(` ${kw} `));

    if (intentKeywords.SMART_ORDER.some(kw => lowerText.startsWith(kw)) && hasFrom && hasTo) {
        return { type: 'SMART_ORDER', originalText: text, lang: spokenLang };
    }

    // 2. WAKE WORD
    const wakeWords = (getAllAliases('who-are-you')['en'] || []).concat(['smart', 'ai']);
    if (wakeWords.some(word => lowerText === word)) {
        return { type: 'WAKE_WORD', originalText: text, lang: spokenLang };
    }

    // 3. ADD PACK
    const packKeyword = intentKeywords.ADD_PACK.find(kw => lowerText.includes(kw));
    if (packKeyword) {
        const packTypeMatch = lowerText.match(/3-day|weekly|monthly/);
        const packType = packTypeMatch ? packTypeMatch[0] as "3-day" | "weekly" | "monthly" : 'weekly';
        const familySizeMatch = lowerText.match(/\d+/);
        const familySize = familySizeMatch ? parseInt(familySizeMatch[0]) : 2;
        return { type: 'ADD_PACK', packType, familySize, originalText: text, lang: spokenLang };
    }

    // 4. RECIPE
    const recipeKeyword = intentKeywords.GET_RECIPE.find(kw => lowerText.includes(kw));
    if (recipeKeyword) {
        const dishName = lowerText.replace(recipeKeyword, '').trim();
        return { type: 'GET_RECIPE', dishName, originalText: text, lang: spokenLang };
    }

    // 5. CHECK PRICE
    const priceKeyword = intentKeywords.CHECK_PRICE.find(kw => lowerText.includes(kw));
    if (priceKeyword) {
        const productPhrase = lowerText.replace(priceKeyword, '').trim();
        return { type: 'CHECK_PRICE', productPhrase, originalText: text, lang: spokenLang };
    }

    // 6. REMOVE ITEM
    const removeKeyword = intentKeywords.REMOVE_ITEM.find(kw => lowerText.includes(kw));
    if (removeKeyword) {
        const productPhrase = lowerText.replace(removeKeyword, '').trim();
        return { type: 'REMOVE_ITEM', productPhrase, originalText: text, lang: spokenLang };
    }
    
    // 7. SHOW DETAILS
    const detailsKeyword = intentKeywords.SHOW_DETAILS.find(kw => lowerText.includes(kw));
    if (detailsKeyword) {
        const target = lowerText.replace(detailsKeyword, '').trim();
        return { type: 'SHOW_DETAILS', target, originalText: text, lang: spokenLang };
    }

    // 8. CONVERSATIONAL/NAVIGATIONAL COMMANDS
    let bestCommandMatch: { key: string, similarity: number } | null = null;
    for (const key in commands) {
      const commandAliases = getAllAliases(key);
      const allAliasStrings = Object.values(commandAliases).flat();
      allAliasStrings.push(key, commands[key].display.toLowerCase());

      for (const alias of [...new Set(allAliasStrings)]) {
        const similarity = calculateSimilarity(lowerText, alias.toLowerCase());
        if (!bestCommandMatch || similarity > bestCommandMatch.similarity) {
          if (similarity > 0.8) {
            bestCommandMatch = { key, similarity };
          }
        }
      }
    }
    
    if (bestCommandMatch) {
      if (intentKeywords.NAVIGATE.some(kw => lowerText.includes(kw))) {
        return { type: 'NAVIGATE', destination: bestCommandMatch.key, originalText: text, lang: spokenLang };
      }
      return { type: 'CONVERSATIONAL', commandKey: bestCommandMatch.key, originalText: text, lang: spokenLang };
    }

    // 9. ORDER ITEM (Default Action)
    return { type: 'ORDER_ITEM', originalText: text, lang: spokenLang };

  }, [commands, getAllAliases]);


  const handleCommand = useCallback(async (commandText: string) => {
    if (!firestore || !user) {
        speak("I can't process commands without being connected. Please log in.", 'en-IN');
        return;
    }

    const spokenLang = determinePhraseLanguage(commandText);
    const langWithRegion = spokenLang === 'en' ? 'en-IN' : `${spokenLang}-IN`;
    const didLanguageChange = spokenLang !== language;

    if (didLanguageChange) {
        setLanguage(spokenLang);
        updateRecognitionLanguage(langWithRegion);
    }
    
    if (isAiModeActive) {
        const quitKeywords = ['quit', 'exit', 'stop', 'ఆపు', 'బయటకు రా'];
        if (quitKeywords.some(kw => commandText.toLowerCase().includes(kw))) {
            setIsAiModeActive(false);
            speak("Okay, back to regular commands.", langWithRegion);
            return;
        }

        const cachedAnswer = await getCachedAIResponse(firestore, commandText);
        if (cachedAnswer) {
            speak(cachedAnswer, langWithRegion);
        } else {
            try {
                const result = await answerGeneralQuestion({ question: commandText });
                speak(result.answer, langWithRegion);
                await cacheAIResponse(firestore, commandText, result.answer);
            } catch (error) {
                console.error("General question failed:", error);
                speak(t('sorry-i-didnt-understand-that', spokenLang), langWithRegion);
            }
        }
        return;
    }

    // --- CONTEXTUAL RESPONSES ---
    if (isWaitingForPackStoreConfirmation) {
        let bestMatch: { store: Store, similarity: number } | null = null;
        for (const [alias, store] of storeAliasMap.entries()) {
            const similarity = calculateSimilarity(commandText.toLowerCase(), alias);
            if (!bestMatch || similarity > bestMatch.similarity) {
                bestMatch = { store, similarity: similarity };
            }
        }

        if (bestMatch && bestMatch.similarity > 0.6 && pendingPackRequestRef.current) {
            const store = bestMatch.store;
            speak(t('okay-ordering-from-speech', spokenLang).replace('{storeName}', store.name), langWithRegion, async () => {
                setActiveStoreId(store.id);
                // Now execute the pending pack request
                await commandActionsRef.current.addPackToCart({
                    ...pendingPackRequestRef.current,
                    storeId: store.id // Pass the newly selected store ID
                });
            });
        } else {
             speak(t('could-not-find-store-speech', spokenLang).replace('{storeName}', commandText), langWithRegion);
        }
        resetAllContext();
        return;
    }
    if (itemForPriceCheck) {
        const yesKeywords = ['yes', 'add', 'buy', 'okay', 'yep', 'yeah', 'సరే', 'అవును'];
        const noKeywords = ['no', 'cancel', 'stop', 'వద్దు', 'cancel'];

        if (yesKeywords.some(kw => commandText.toLowerCase().includes(kw))) {
            const { product, variant, requestedQty } = await findProductAndVariant(commandText);
            if (variant) {
                addItemToCart(itemForPriceCheck, variant, requestedQty);
                onOpenCart();
                speak(t('adding-item-speech', spokenLang).replace('{quantity}', `${requestedQty}`).replace('{weight}', variant.weight).replace('{productName}', getProductName(itemForPriceCheck)), langWithRegion);
            } else {
                 speak(t('sorry-i-didnt-understand-that', spokenLang), langWithRegion);
            }
        } else if (noKeywords.some(kw => commandText.toLowerCase().includes(kw))) {
            speak("Okay.", langWithRegion);
        } else {
            setItemForPriceCheck(null);
            handleCommand(commandText);
            return;
        }
        resetAllContext();
        return;
    }
    if (isWaitingForAddressType) {
        const homeKeywords = getAllAliases('homeAddress')[spokenLang] || ['home'];
        const locationKeywords = getAllAliases('currentLocation')[spokenLang] || ['current'];
        
        const homeSimilarity = Math.max(...homeKeywords.map(kw => calculateSimilarity(commandText.toLowerCase(), kw)));
        const locationSimilarity = Math.max(...locationKeywords.map(kw => calculateSimilarity(commandText.toLowerCase(), kw)));

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
        triggerVoicePrompt();
        return;
    }

    if (isWaitingForStoreName) {
        let bestMatch: { store: Store, similarity: number } | null = null;
        for (const [alias, store] of storeAliasMap.entries()) {
            const similarity = calculateSimilarity(commandText.toLowerCase(), alias);
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
    
    const multiItemSeparators = ['and', 'మరియు'];
    const separatorUsed = multiItemSeparators.find(sep => commandText.toLowerCase().includes(` ${sep} `));
    
    if (separatorUsed && recognizeIntent(commandText, spokenLang).type === 'ORDER_ITEM') {
        const phrases = commandText.split(new RegExp(` ${separatorUsed} `, 'i'));
        await commandActionsRef.current.orderMultipleItems(phrases, spokenLang, commandText);
        resetAllContext();
        return;
    }

    const intent = recognizeIntent(commandText, spokenLang);

    switch (intent.type) {
        case 'SMART_ORDER':
            await commandActionsRef.current.handleSmartOrder(intent.originalText, intent.lang);
            break;

        case 'WAKE_WORD':
            setIsAiModeActive(true);
            speak("I'm here to help. You can ask me anything. Just say 'quit' to exit.", langWithRegion);
            return;

        case 'GET_RECIPE':
            await commandActionsRef.current.getRecipe({ dishName: intent.dishName, lang: intent.lang });
            break;
            
        case 'CHECK_PRICE':
            await commandActionsRef.current.checkPrice({ phrase: intent.productPhrase, lang: intent.lang, originalText: intent.originalText });
            break;

        case 'REMOVE_ITEM':
            await commandActionsRef.current.removeItemFromCart({ phrase: intent.productPhrase, lang: intent.lang });
            break;
        
        case 'SHOW_DETAILS':
            commandActionsRef.current.showDetails({ target: intent.target, lang: intent.lang });
            break;
        
        case 'ADD_PACK':
            await commandActionsRef.current.addPackToCart({ packType: intent.packType, familySize: intent.familySize, lang: intent.lang });
            break;
        
        case 'NAVIGATE':
        case 'CONVERSATIONAL':
            const action = commandActionsRef.current[intent.commandKey];
            const reply = commands[intent.commandKey]?.reply || `Executing ${commands[intent.commandKey]?.display}`;
            if (action) {
                speak(reply, langWithRegion, () => action({ lang: intent.lang }));
            } else {
                speak(reply, langWithRegion);
            }
            break;

        case 'ORDER_ITEM':
            const { product, variant, requestedQty, matchedAlias, lang: itemLang, remainingPhrase } = await findProductAndVariant(commandText);
            if (product && variant) {
                addItemToCart(product, variant, requestedQty);
                onOpenCart();
                const productLang = itemLang || spokenLang;
                const replyProductName = t(product.name.toLowerCase().replace(/ /g, '-'), productLang);

                let speech = t('adding-item-speech', productLang)
                    .replace('{quantity}', `${requestedQty}`)
                    .replace('{weight}', `${variant.weight}`)
                    .replace('{productName}', replyProductName);

                speak(speech, productLang + '-IN');
            } else {
                // Log the failure and inform the user.
                speak("I'm sorry, I'm still learning that item. I will make sure to remember it for next time.", langWithRegion);
                if (firestore && user) {
                    addDoc(collection(firestore, 'failedCommands'), {
                        userId: user.uid,
                        commandText: commandText,
                        language: spokenLang,
                        reason: `ORDER_ITEM intent failed. Product not found or no variants. Phrase: "${remainingPhrase}"`,
                        timestamp: serverTimestamp(),
                    });
                }
            }
            break;

        case 'UNKNOWN':
        default:
            const cachedAnswer = await getCachedAIResponse(firestore, commandText);
            if (cachedAnswer) {
                speak(cachedAnswer, langWithRegion);
            } else {
                speak(t('sorry-i-didnt-understand-that', spokenLang), langWithRegion);
                if (firestore && user) {
                    addDoc(collection(firestore, 'failedCommands'), {
                        userId: user.uid, commandText, language: spokenLang, reason: 'UNKNOWN intent & AI mode not active', timestamp: serverTimestamp(),
                    });
                }
            }
            break;
    }
    
    if (!itemForPriceCheck && !isWaitingForPackStoreConfirmation) {
        resetAllContext();
    }

  }, [firestore, user, language, determinePhraseLanguage, updateRecognitionLanguage, speak, resetAllContext, pathname, findProductAndVariant, storeAliasMap, homeAddressBtnRef, currentLocationBtnRef, placeOrderBtnRef, profileForm, saveInventoryBtnRef, setActiveStoreId, isWaitingForAddressType, isWaitingForStoreName, handleProfileFormInteraction, runCheckoutPrompt, getProductName, cartItemsProp, setLanguage, addItemToCart, removeItem, onOpenCart, locales, commands, getAllAliases, t, triggerVoicePrompt, itemForPriceCheck, recognizeIntent, isAiModeActive, isWaitingForPackStoreConfirmation, masterProducts, fetchInitialData]);


  useEffect(() => {
    if (!recognition) {
      onStatusUpdate("Speech recognition not supported by this browser.");
      return;
    }

    recognition.onstart = () => {
      if (isAiModeActive) {
        onStatusUpdate("I'm listening for your question...");
      } else {
        onStatusUpdate(`Listening... (${language}-IN)`);
      }
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
      managePacks: (params) => router.push('/dashboard/owner/packs'),
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
          speak(t('placing-your-order-now-speech', lang), lang + '-IN', () => {
              placeOrderBtnRef?.current?.click();
          });
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
      showDetails: ({ target, lang }) => {
        if (pathname === '/dashboard/delivery/deliveries') {
            const detailsButton = document.querySelector('[id^="details-btn-"]') as HTMLButtonElement | null;
            if (detailsButton) {
                speak("Showing details for the first group.", lang + '-IN');
                detailsButton.click();
            } else {
                speak("I couldn't find any details to show.", lang + '-IN');
            }
        } else {
            speak("You can only view delivery details on the deliveries page.", lang + '-IN');
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
    checkPrice: async ({ phrase, lang, originalText }: { phrase?: string; lang: string, originalText: string }) => {
      if (!phrase) return;

      const { product, lang: detectedLang } = await findProductAndVariant(phrase);

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
          
          speak(`${reply} Would you like to add it to your cart?`, detectedLang + '-IN');
          setItemForPriceCheck(product);
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
        addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: originalText, language: lang, reason: `Price check: product not found in phrase "${phrase}".`, timestamp: serverTimestamp() });
      }
    },
    removeItemFromCart: async ({ phrase, lang }: { phrase?: string; lang: string }) => {
        if (!phrase) return;
        if (cartItemsProp.length === 0) {
            speak("Your cart is already empty.", lang + '-IN');
            return;
        }

        let bestMatch: { item: CartItem, similarity: number } | null = null;
        for (const item of cartItemsProp) {
            const similarity = calculateSimilarity(phrase.toLowerCase(), item.product.name.toLowerCase());
            if (!bestMatch || similarity > bestMatch.similarity) {
                bestMatch = { item, similarity };
            }
        }
        
        if (bestMatch && bestMatch.similarity > 0.6) {
            const { item } = bestMatch;
            removeItem(item.variant.sku);
            speak(`Okay, I've removed ${getProductName(item.product)} from your cart.`, lang + '-IN');
        } else {
            speak(`I couldn't find "${phrase}" in your cart.`, lang + '-IN');
        }
    },
    getRecipe: async ({ dishName, lang }: { dishName: string, lang: string }) => {
        if (!dishName) return;
        const langWithRegion = lang === 'en' ? 'en-IN' : `${lang}-IN`;
        speak(`Let me check the ingredients for ${dishName}.`, langWithRegion);
        
        try {
            if (!firestore) throw new Error("Firestore not available");
            let ingredients = await getCachedRecipe(firestore, dishName);

            if (ingredients) {
                speak(`I found a cached recipe. The ingredients for ${dishName} are: ${ingredients.join(', ')}`, langWithRegion);
            } else {
                const result = await getIngredientsForRecipe({ dishName });
                ingredients = result.ingredients;
                speak(`The ingredients for ${dishName} are: ${ingredients.join(', ')}`, langWithRegion);
                await cacheRecipe(firestore, dishName, ingredients);
            }

        } catch (error) {
            console.error("Error getting recipe:", error);
            speak(`I'm sorry, I couldn't get the ingredients for ${dishName} right now.`, langWithRegion);
        }
    },
    orderMultipleItems: async (phrases: string[], lang: string, originalText: string) => {
        let addedItems: string[] = [];
        let failedItems: string[] = [];

        for (const phrase of phrases) {
            const { product, variant, requestedQty, lang: itemLang } = await findProductAndVariant(phrase);
            if (product && variant) {
                addItemToCart(product, variant, requestedQty);
                addedItems.push(getProductName(product));
            } else {
                failedItems.push(phrase.trim());
            }
        }
        
        const langToUse = lang || 'en';
        const langWithRegion = langToUse === 'en' ? 'en-IN' : `${langToUse}-IN`;
        
        if (addedItems.length > 0) {
            onOpenCart();
            let speech;
            if (failedItems.length > 0) {
                speech = `${t('ive-added-to-your-cart', langToUse).replace('{items}', addedItems.join(', '))} ${t('but-i-couldnt-find', langToUse).replace('{items}', failedItems.join(', '))}`;
            } else {
                speech = t('ive-added-to-your-cart', langToUse).replace('{items}', addedItems.join(', '));
            }
            speak(speech, langWithRegion);
        } else {
            speak(t('sorry-i-couldnt-find-any-items', langToUse), langWithRegion);
            if (firestore && user) {
                addDoc(collection(firestore, 'failedCommands'), { userId: user.uid, commandText: originalText, language: lang, reason: `Multi-order: No products found. Failed items: ${failedItems.join(', ')}`, timestamp: serverTimestamp() });
            }
        }
    },
    handleSmartOrder: async (text: string, lang: string) => {
        const langWithRegion = lang === 'en' ? 'en-IN' : `${lang}-IN`;
        clearCart(); // Start with a fresh cart for a smart order
        
        const fromKeywords = ['from', 'at', 'in'];
        const toKeywords = ['to', 'at'];

        let fromIndex = -1;
        let fromKeyword = '';
        for (const kw of fromKeywords) {
            const index = text.toLowerCase().lastIndexOf(` ${kw} `);
            if (index > fromIndex) {
                fromIndex = index;
                fromKeyword = kw;
            }
        }
        
        let toIndex = -1;
        let toKeyword = '';
        for (const kw of toKeywords) {
            const index = text.toLowerCase().lastIndexOf(` ${kw} `);
            if (index > toIndex) {
                toIndex = index;
                toKeyword = kw;
            }
        }

        if (fromIndex === -1 || toIndex === -1) {
            speak(t('could-not-find-product-in-order-speech', lang), langWithRegion);
            return;
        }

        const productPhrase = text.substring(0, fromIndex).replace(/^(order|buy|get|send)\s+/i, '').trim();
        const storePhrase = text.substring(fromIndex + fromKeyword.length + 1, toIndex).trim();
        const addressPhrase = text.substring(toIndex + toKeyword.length + 1).trim();

        // 1. Process Product
        const { product, variant, requestedQty } = await findProductAndVariant(productPhrase);
        if (!product || !variant) {
            speak(t('could-not-find-item-speech', lang).replace('{itemName}', productPhrase), langWithRegion);
            return;
        }

        // 2. Process Store
        let bestStoreMatch: Store | null = null;
        let bestSimilarity = 0;
        for (const [alias, store] of storeAliasMap.entries()) {
            const similarity = calculateSimilarity(storePhrase.toLowerCase(), alias);
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestStoreMatch = store;
            }
        }

        if (!bestStoreMatch || bestSimilarity < 0.6) {
            speak(t('could-not-identify-store-speech', lang), langWithRegion);
            return;
        }

        // 3. Process Address
        const homeKeywords = getAllAliases('homeAddress')[lang] || ['home'];
        const locationKeywords = getAllAliases('currentLocation')[lang] || ['current', 'location'];
        const homeSimilarity = Math.max(...homeKeywords.map(kw => calculateSimilarity(addressPhrase.toLowerCase(), kw)));
        const locationSimilarity = Math.max(...locationKeywords.map(kw => calculateSimilarity(addressPhrase.toLowerCase(), kw)));

        let deliveryAddress = '';
        if (homeSimilarity > 0.7 && homeSimilarity > locationSimilarity) {
            if (userProfileRef.current?.address) {
                deliveryAddress = userProfileRef.current.address;
            } else {
                speak(t('cannot-deliver-home-no-address-speech', lang), langWithRegion);
                router.push('/dashboard/customer/my-profile');
                return;
            }
        } else if (locationSimilarity > 0.7) {
            // This is a special case. We will set a placeholder and let the checkout page handle the geolocation.
            deliveryAddress = 'use-current-location';
        } else {
            // If it's not clearly home or current, set it to the raw phrase and let the user fix it.
            deliveryAddress = addressPhrase;
        }

        // 4. Execute Actions
        const speech = t('preparing-order-speech', lang)
            .replace('{items}', `${requestedQty} ${variant.weight} of ${getProductName(product)}`)
            .replace('{storeName}', bestStoreMatch.name);

        speak(speech, langWithRegion, () => {
            setIsWaitingForQuickOrderConfirmation(true); // Prevents checkout page from prompting
            addItemToCart(product, variant, requestedQty);
            setActiveStoreId(bestStoreMatch!.id);
            setHomeAddress(deliveryAddress); // Pass the address to the checkout page store
            setShouldPlaceOrderDirectly(true); // Signal the checkout page to auto-submit
            router.push('/checkout');
        });
    },
    addPackToCart: async ({ packType, familySize, lang, storeId }) => {
        const langWithRegion = lang === 'en' ? 'en-IN' : `${lang}-IN`;
    
        if (!firestore) return;
    
        const masterStore = stores.find(s => s.name === 'LocalBasket');
        if (!masterStore) {
            speak("I'm sorry, I can't find the master pack list right now.", langWithRegion);
            return;
        }
    
        const packName = `${packType} pack for ${familySize}`;
        const packCollectionRef = collection(firestore, `stores/${masterStore.id}/packages`);
    
        // First, try to find the specific pack
        let q = query(packCollectionRef, where('name', '==', packName));
        let querySnapshot = await getDocs(q);
    
        // If not found, try a more general search for the same family size
        if (querySnapshot.empty) {
            q = query(packCollectionRef, where('memberCount', '==', familySize));
            querySnapshot = await getDocs(q);
        }
    
        if (querySnapshot.empty) {
            speak(`I'm sorry, I couldn't find a pack for ${familySize} members. You can ask the store owner to create one.`, langWithRegion);
            return;
        }
    
        const pack = querySnapshot.docs[0].data() as MonthlyPackage;
        speak(`Found the ${pack.name}. Adding ${pack.items.length} items to your cart. You can select a store at checkout.`, langWithRegion);
    
        // Fetch prices for all items in the pack at once
        const productNamesToFetch = pack.items.map(item => item.name);
        await fetchProductPrices(firestore, productNamesToFetch);
        
        // Give Zustand a moment to update state after the async price fetch
        await new Promise(resolve => setTimeout(resolve, 200)); 
    
        const latestPrices = useAppStore.getState().productPrices;
    
        let itemsAdded = 0;
        for (const item of pack.items) {
            const product = masterProducts.find(p => p.name === item.name);
            const priceData = latestPrices[item.name.toLowerCase()];
            
            if (product && priceData?.variants) {
                // Since this is a generic pack, the storeId is not tied to a specific user store yet
                const productWithCorrectStore = { ...product, storeId: masterStore.id }; 
                
                const bestVariant = priceData.variants.find(v => item.quantity.includes(v.weight)) || priceData.variants[0];
                
                if (bestVariant) {
                    addItemToCart(productWithCorrectStore, bestVariant, 1);
                    itemsAdded++;
                }
            }
        }
    
        if (itemsAdded > 0) {
            onOpenCart();
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
  }, [handleCommand, cartTotal, cartItemsProp, pathname, masterProducts, t, isAiModeActive]);

  useEffect(() => {
    console.log('Current language changed to:', language);
  }, [language]);

  return null;
}
