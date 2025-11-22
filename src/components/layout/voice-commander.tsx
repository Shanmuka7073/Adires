
'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, errorEmitter, useDoc, useMemoFirebase } from '@/firebase';
import type { Store, Product, ProductPrice, CartItem, User, FailedVoiceCommand, ProductVariant, SiteConfig, VoiceAliasGroup } from '@/lib/types';
import { calculateSimilarity } from '@/lib/calculate-similarity';
import { useCart } from '@/lib/cart';
import { useAppStore } from '@/lib/store';
import { useMyStorePageStore } from '@/lib/store';
import { t } from '@/lib/locales';
import { doc, getDoc, serverTimestamp, addDoc, collection, query, where, getDocs, writeBatch, arrayUnion, setDoc } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import { useCheckoutStore } from '@/app/checkout/page';
import { useProfileFormStore, ProfileFormValues } from '@/lib/store';
import { getIngredientsForDish } from '@/ai/flows/recipe-ingredients-flow';
import { suggestAlias, SuggestAliasOutput } from '@/ai/flows/suggest-alias-flow';


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
  retryCommandText: string | null;
  onRetryHandled: () => void;
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
  retryCommandText,
  onRetryHandled,
}: VoiceCommanderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const { clearCart, addItem: addItemToCart, removeItem, updateQuantity, addUnidentifiedItem, activeStoreId, setActiveStoreId, cartTotal } = useCart();

  const { stores, masterProducts, productPrices, fetchProductPrices, getProductName, language, setLanguage, getAllAliases, locales, commands, loading: isAppStoreLoading, fetchInitialData } = useAppStore();

  const { form: profileForm } = useProfileFormStore();
  const { saveInventoryBtnRef } = useMyStorePageStore();
  const { 
    handleUseCurrentLocation,
    handleUseHomeAddress,
    placeOrderBtnRef, 
    setIsWaitingForQuickOrderConfirmation, 
    isWaitingForQuickOrderConfirmation, 
    setHomeAddress,
    setShouldUseCurrentLocation
  } = useCheckoutStore();


  const isSpeakingRef = useRef(false);
  const isEnabledRef = useRef(enabled);
  const commandActionsRef = useRef<any>({});

  const formFieldToFillRef = useRef<keyof ProfileFormValues | null>(null);
  const isWaitingForStoreNameRef = useRef(false);
  const isWaitingForAddressTypeRef = useRef(false);
  const addressRetryCountRef = useRef(0);
  const itemForPriceCheck = useRef<Product | null>(null);
  const productForVariantSelection = useRef<Product | null>(null);
  const lastTranscriptRef = useRef<string>('');
  
  const userProfileRef = useRef<User | null>(null);

  const [hasMounted, setHasMounted] = useState(false);

  const [speechSynthesisVoices, setSpeechSynthesisVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const [hasRunCheckoutPrompt, setHasRunCheckoutPrompt] = useState(false);
  
    // --- Performance Optimization: Memoized Alias Maps ---
  const universalProductAliasMap = useMemo<AliasToProductMap>(() => {
    const map: AliasToProductMap = new Map();
    if (isAppStoreLoading || !masterProducts) return map;

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
  }, [isAppStoreLoading, masterProducts, getAllAliases]);

  const storeAliasMap = useMemo(() => {
    const map = new Map<string, Store>();
    if (isAppStoreLoading || !stores) return map;

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
  }, [isAppStoreLoading, stores, getAllAliases]);
  
  // Client-side AI config fetching
  const configDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'siteConfig', 'aiFeatures') : null, [firestore]);
  const { data: aiConfig } = useDoc<SiteConfig>(configDocRef);


  const resetAllContext = useCallback(() => {
    itemForPriceCheck.current = null;
    productForVariantSelection.current = null;
    isWaitingForStoreNameRef.current = false;
    isWaitingForAddressTypeRef.current = false;
    addressRetryCountRef.current = 0;
    onSuggestions([]);
    setIsWaitingForQuickOrderConfirmation(false);
    formFieldToFillRef.current = null;
    useCheckoutStore.getState().setShouldPlaceOrderDirectly(false);
    setHasRunCheckoutPrompt(false);
  }, [onSuggestions, setIsWaitingForQuickOrderConfirmation]);


  const determinePhraseLanguage = useCallback((text: string): string => {
    const lowerText = text.toLowerCase();
    
    // If it contains Telugu script, it's Telugu
    if (/[\u0C00-\u0C7F]/.test(lowerText)) {
      return 'te';
    }

    const langKeywords = [
        { lang: 'te', keywords: ['naku', 'naaku', 'kavali', 'ధర'] },
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
             if (lang === 'display' || lang === 'reply' || lang === 'type') continue;
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
  }, []);

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

  const speak = useCallback((textOrReplies: string | string[], lang: string, onEndCallback?: (() => void) | boolean) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (typeof onEndCallback === 'function') onEndCallback();
      return;
    }
    
    if (recognition) {
        try { recognition.stop(); } catch(e) {}
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

    const handleEnd = () => {
      isSpeakingRef.current = false;
      if (typeof onEndCallback === 'function') {
        onEndCallback();
      } else if (onEndCallback !== false && isEnabledRef.current && recognition) {
        try {
          if (!isSpeakingRef.current) recognition.start();
        } catch(e) {}
      }
    };
    
    utterance.onend = handleEnd;
    utterance.onerror = (e) => {
      console.error('Speech synthesis error', e);
      handleEnd(); 
    };

    window.speechSynthesis.speak(utterance);
  }, [speechSynthesisVoices]);

  const handleProfileFormInteraction = useCallback(() => {
    if (!profileForm?.getValues) {
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

  const promptTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const runCheckoutPrompt = useCallback(() => {
      if (pathname !== '/checkout' || !hasMounted || !enabled || hasRunCheckoutPrompt || isSpeakingRef.current) {
          return;
      }

      if (promptTimeoutRef.current) {
        clearTimeout(promptTimeoutRef.current);
      }

      promptTimeoutRef.current = setTimeout(() => {
        setHasRunCheckoutPrompt(true);
        
        const detectedLang = language;
        const langWithRegion = detectedLang === 'en' ? 'en-IN' : `${detectedLang}-IN`;

        const addressInput = typeof document !== 'undefined' ? (document.querySelector('input[name="deliveryAddress"]') as HTMLInputElement) : null;
        const currentAddress = addressInput?.value || '';
        
        const onPromptEnd = () => {
            setHasRunCheckoutPrompt(false);
             if (isEnabledRef.current && recognition && !isSpeakingRef.current) {
                try { recognition.start(); } catch(e){}
            }
        };

        if (cartItemsProp.length === 0 && !isWaitingForQuickOrderConfirmation) {
            speak(t('your-cart-is-empty-speech', detectedLang), langWithRegion, onPromptEnd);
        } else if (!currentAddress || currentAddress.length < 10) {
            speak(t('should-i-deliver-to-home-or-current-speech', detectedLang), langWithRegion, () => {
                isWaitingForAddressTypeRef.current = true;
                addressRetryCountRef.current = 0; // Reset retry count when asking
                onPromptEnd();
            });
        } else if (!activeStoreId) {
            speak(t('which-store-should-fulfill-speech', detectedLang), langWithRegion, () => {
                isWaitingForStoreNameRef.current = true;
                onPromptEnd();
            });
        } else {
            const total = cartTotal + 30;
            const speech = t('finalConfirmPrompt', detectedLang).replace('{total}', `₹${total.toFixed(2)}`);
            speak(speech, langWithRegion, onPromptEnd);
        }
        promptTimeoutRef.current = null;
      }, 500); 
  }, [
      pathname, hasMounted, enabled, isWaitingForQuickOrderConfirmation, hasRunCheckoutPrompt,
      cartItemsProp.length, language, speak, cartTotal, t, activeStoreId
  ]);
  
  useEffect(() => {
      if (pathname === '/checkout' && hasMounted && enabled && voiceTrigger > 0) {
        setHasRunCheckoutPrompt(false); 
        runCheckoutPrompt();
      }
  }, [voiceTrigger, pathname, hasMounted, enabled, runCheckoutPrompt]); 

  useEffect(() => {
    if (pathname === '/checkout' && enabled && !isSpeakingRef.current && !hasRunCheckoutPrompt) {
      runCheckoutPrompt();
    }
    
    return () => {
      if (promptTimeoutRef.current) {
        clearTimeout(promptTimeoutRef.current);
        promptTimeoutRef.current = null;
      }
    };
  }, [activeStoreId, runCheckoutPrompt, enabled, pathname, hasRunCheckoutPrompt]);


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
    let sanitizedPhrase = lowerPhrase.replace(/[-.,]/g, ' ').replace(/\s+/g, ' ').trim();

    let requestedQty = 1;
    let requestedUnit: 'kg' | 'gm' | 'pc' | 'pack' | null = null;

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

    const words = sanitizedPhrase.split(' ');
    const remainingWords = [];
    
    for (const word of words) {
        let consumed = false;
        if (!isNaN(parseInt(word))) {
            requestedQty = parseInt(word);
            consumed = true;
        } else if (numberWords[word]) {
            requestedQty = numberWords[word];
            consumed = true;
        } else if (unitKeywords[word]) {
            requestedUnit = unitKeywords[word].type;
            consumed = true;
        }
        if (!consumed) {
            remainingWords.push(word);
        }
    }
    let productNamePhrase = remainingWords.join(' ');

    let productMatch: { product: Product, alias: string, lang: string } | null = null;
    const directMatch = universalProductAliasMap.get(productNamePhrase) || universalProductAliasMap.get(productNamePhrase.replace(/\s+/g, ''));
    
    if (directMatch) {
      productMatch = { ...directMatch, alias: productNamePhrase };
    } else {
      let bestMatch: { product: Product, alias: string, similarity: number, lang: string } | null = null;
      for (const [alias, { product, lang }] of universalProductAliasMap.entries()) {
          const similarity = calculateSimilarity(productNamePhrase, alias);
          if (similarity > 0.8 && (!bestMatch || similarity > bestMatch.similarity)) { 
              bestMatch = { product, alias, similarity, lang };
          }
      }
      if (bestMatch) {
        productMatch = { product: bestMatch.product, alias: bestMatch.alias, lang: bestMatch.lang };
      }
    }

    if (!productMatch) {
      return { product: null, variant: null, requestedQty: 1, remainingPhrase: phrase, matchedAlias: null, lang: 'en' };
    }

    const { product, lang: detectedLang, alias: matchedAlias } = productMatch;
    
    let priceData = productPrices[product.name.toLowerCase()];
    if (!priceData && firestore) {
        await fetchProductPrices(firestore, [product.name]);
        priceData = useAppStore.getState().productPrices[product.name.toLowerCase()];
    }

    if (!priceData?.variants?.length) {
        return { product, variant: null, requestedQty, remainingPhrase: productNamePhrase, matchedAlias, lang: detectedLang };
    }

    let chosenVariant: ProductVariant | null = null;
    if (requestedUnit) {
        chosenVariant = priceData.variants.find(v => v.weight.toLowerCase().includes(requestedUnit)) || null;
    }

    if (!chosenVariant) {
        chosenVariant =
            priceData.variants.find(v => v.weight === '1kg') ||
            priceData.variants.find(v => v.weight.includes('kg')) ||
            priceData.variants.find(v => v.weight.includes('pc')) ||
            priceData.variants[0];
    }

    return { product: product, variant: chosenVariant, requestedQty, remainingPhrase: productNamePhrase, matchedAlias, lang: detectedLang };
}, [firestore, productPrices, fetchProductPrices, universalProductAliasMap]);

  const recognizeIntent = useCallback((text: string, spokenLang: string): Intent => {
    const lowerText = text.toLowerCase().trim();
    
    const fromKeywords = ['from', 'at', 'in'];
    const toKeywords = ['to', 'at'];
    const hasFrom = fromKeywords.some(kw => lowerText.includes(` ${kw} `));
    const hasTo = toKeywords.some(kw => lowerText.includes(` ${kw} `));

    if (intentKeywords.SMART_ORDER.some(kw => lowerText.startsWith(kw)) && hasFrom && hasTo) {
        return { type: 'SMART_ORDER', originalText: text, lang: spokenLang };
    }
    
    const priceKeyword = intentKeywords.CHECK_PRICE.find(kw => lowerText.includes(kw));
    if (priceKeyword) {
        const productPhrase = lowerText.replace(priceKeyword, '').trim();
        return { type: 'CHECK_PRICE', productPhrase, originalText: text, lang: spokenLang };
    }

    const removeKeyword = intentKeywords.REMOVE_ITEM.find(kw => lowerText.includes(kw));
    if (removeKeyword) {
        const productPhrase = lowerText.replace(removeKeyword, '').trim();
        return { type: 'REMOVE_ITEM', productPhrase, originalText: text, lang: spokenLang };
    }
    
    const detailsKeyword = intentKeywords.SHOW_DETAILS.find(kw => lowerText.includes(kw));
    if (detailsKeyword) {
        const target = lowerText.replace(detailsKeyword, '').trim();
        return { type: 'SHOW_DETAILS', target, originalText: text, lang: spokenLang };
    }

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
      if (bestCommandMatch.key === 'get-recipe') {
          const recipeAliases = (getAllAliases('get-recipe')[spokenLang] || ['recipe for']);
          const recipeKeywordUsed = recipeAliases.find(alias => lowerText.includes(alias));
          if(recipeKeywordUsed) {
            const dishName = lowerText.substring(lowerText.indexOf(recipeKeywordUsed) + recipeKeywordUsed.length).trim();
            return { type: 'GET_RECIPE', dishName, originalText: text, lang: spokenLang };
          }
      }

      if (intentKeywords.NAVIGATE.some(kw => lowerText.includes(kw))) {
        return { type: 'NAVIGATE', destination: bestCommandMatch.key, originalText: text, lang: spokenLang };
      }
      return { type: 'CONVERSATIONAL', commandKey: bestCommandMatch.key, originalText: text, lang: spokenLang };
    }

    return { type: 'ORDER_ITEM', originalText: text, lang: spokenLang };

  }, [commands, getAllAliases]);


    const handleCommandFailure = useCallback(async (commandText: string, spokenLang: string, reason: string) => {
        addUnidentifiedItem(commandText);
        speak(t('sorry-i-didnt-understand-that', spokenLang), `${spokenLang}-IN`);
        if (!firestore || !user) return;
    
        // Immediately start AI analysis in the background. Do not await.
        if (aiConfig?.isAliasSuggesterEnabled) {
            console.log("Triggering background AI analysis for failed command...");
            suggestAlias({
                commandText,
                language: spokenLang,
                itemNames: [...masterProducts.map(p => p.name), ...stores.map(s => s.name)]
            }).then(async (suggestion) => {
                if (suggestion.isSuggestionAvailable && suggestion.similarityScore > 0.8) {
                    console.log(`High confidence suggestion found (${suggestion.similarityScore}). Auto-approving.`);
                    const aliasGroupRef = doc(firestore, 'voiceAliasGroups', suggestion.suggestedKey);
                    
                    try {
                         // Read-Modify-Write for safety
                        const docSnap = await getDoc(aliasGroupRef);
                        const existingData = docSnap.exists() ? docSnap.data() : { type: 'product' };
    
                        const updatedData = { ...existingData };
    
                        const allNewAliases = [...suggestion.suggestedAliases, { lang: spokenLang, alias: suggestion.originalCommand, transliteratedAlias: '' }];
    
                        allNewAliases.forEach(({ lang, alias, transliteratedAlias }) => {
                            if (!updatedData[lang]) updatedData[lang] = [];
                            
                            const langAliases = new Set(updatedData[lang]);
                            if (alias) langAliases.add(alias);
                            if (transliteratedAlias) langAliases.add(transliteratedAlias);
    
                            updatedData[lang] = Array.from(langAliases);
                        });
                        
                        await setDoc(aliasGroupRef, updatedData);
    
                        toast({ title: "AI Self-Correction", description: `Automatically added "${suggestion.originalCommand}" as an alias for "${suggestion.suggestedKey}".`});
                        
                        // Re-fetch all data to update the VoiceCommander's context in real-time
                        await fetchInitialData(firestore);
                    } catch (err) {
                        console.error("Error auto-saving aliases:", err);
                        // If auto-save fails, log it as a normal failed command
                        addDoc(collection(firestore, 'failedCommands'), {
                            userId: user.uid, commandText, language: spokenLang, reason, timestamp: serverTimestamp(),
                        });
                    }
                } else {
                    addDoc(collection(firestore, 'failedCommands'), {
                        userId: user.uid, commandText, language: spokenLang, reason, timestamp: serverTimestamp(),
                    });
                }
            }).catch(aiError => {
                console.error("AI suggestion flow failed:", aiError);
                 addDoc(collection(firestore, 'failedCommands'), {
                    userId: user.uid, commandText, language: spokenLang, reason, timestamp: serverTimestamp(),
                });
            });
        } else {
             // Log for manual review if AI suggester is disabled
            addDoc(collection(firestore, 'failedCommands'), {
                userId: user.uid, commandText, language: spokenLang, reason, timestamp: serverTimestamp(),
            });
        }
    }, [addUnidentifiedItem, firestore, user, speak, aiConfig?.isAliasSuggesterEnabled, masterProducts, stores, toast, fetchInitialData]);


  const handleCommand = useCallback(async (commandText: string) => {
    if (lastTranscriptRef.current === commandText) {
      return;
    }
    lastTranscriptRef.current = commandText;
    
    if (!firestore || !user) {
        speak("I can't process commands without being connected. Please log in.", 'en-IN');
        return;
    }

    let spokenLang = determinePhraseLanguage(commandText);
    const replyLang = spokenLang === 'hi' ? 'en' : spokenLang; // Always reply in English if Hindi is detected.
    const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;
    
    if (spokenLang !== language && spokenLang !== 'hi') {
        setLanguage(spokenLang);
        updateRecognitionLanguage(`${spokenLang}-IN`);
    }

    // --- CONTEXTUAL RESPONSES ---
    if (productForVariantSelection.current) {
        const product = productForVariantSelection.current;
        const priceData = productPrices[product.name.toLowerCase()];
        let selectedVariant: ProductVariant | null = null;
    
        if (priceData?.variants) {
            // Try to match by spoken number or price amount
            const spokenNumber = commandText.match(/\d+/g)?.[0];
            if (spokenNumber) {
                const priceAsNumber = parseInt(spokenNumber);
                selectedVariant = priceData.variants.find(v => v.price === priceAsNumber) || null;
            }
    
            // If no numeric match, try by text similarity against price (e.g. "twenty")
            if (!selectedVariant) {
                let bestMatch = { variant: null as ProductVariant | null, similarity: 0 };
                for (const variant of priceData.variants) {
                    const similarity = calculateSimilarity(commandText.toLowerCase(), String(variant.price));
                    // A lower threshold might be needed for spoken numbers vs text
                    if (similarity > 0.5 && similarity > bestMatch.similarity) {
                        bestMatch = { variant, similarity };
                    }
                }
                selectedVariant = bestMatch.variant;
            }
        }
    
        if (selectedVariant) {
            addItemToCart(product, selectedVariant, 1);
            onOpenCart();
            speak(t('adding-item-speech', replyLang).replace('{quantity}', '1').replace('{weight}', selectedVariant.weight).replace('{productName}', getProductName(product)), langWithRegion);
        } else {
            speak(`I'm sorry, I couldn't find that price option for ${getProductName(product)}. Please try again.`, langWithRegion);
        }
    
        // Exit this special mode whether successful or not
        productForVariantSelection.current = null;
        return;
    }


    if (itemForPriceCheck.current) {
        const productForCheck = itemForPriceCheck.current;
        itemForPriceCheck.current = null; // Reset immediately
        const yesKeywords = ['yes', 'add', 'buy', 'okay', 'yep', 'yeah', 'సరే', 'అవును'];
        const noKeywords = ['no', 'cancel', 'stop', 'వద్దు', 'cancel'];

        if (yesKeywords.some(kw => commandText.toLowerCase().includes(kw))) {
            const { variant, requestedQty } = await findProductAndVariant(commandText);
            if (variant) {
                addItemToCart(productForCheck, variant, requestedQty);
                onOpenCart();
                speak(t('adding-item-speech', replyLang).replace('{quantity}', `${requestedQty}`).replace('{weight}', variant.weight).replace('{productName}', getProductName(productForCheck)), langWithRegion);
            } else {
                 speak(t('sorry-i-didnt-understand-that', replyLang), langWithRegion);
            }
        } else if (noKeywords.some(kw => commandText.toLowerCase().includes(kw))) {
            speak("Okay.", langWithRegion);
        } else {
            handleCommand(commandText); // Re-process as a new command
            return;
        }
        return;
    }
    
    if (isWaitingForAddressTypeRef.current) {
        const lowerCommand = commandText.toLowerCase();
        const homeKeywords = getAllAliases('homeAddress')[spokenLang] || ['home'];
        const locationKeywords = getAllAliases('currentLocation')[spokenLang] || ['current', 'location'];
        
        const homeSimilarity = Math.max(...homeKeywords.map(kw => calculateSimilarity(lowerCommand, kw.toLowerCase())));
        const locationSimilarity = Math.max(...locationKeywords.map(kw => calculateSimilarity(lowerCommand, kw.toLowerCase())));
    
        if (homeSimilarity > 0.6 && homeSimilarity > locationSimilarity) {
            // Success: Reset flags
            isWaitingForAddressTypeRef.current = false;
            addressRetryCountRef.current = 0; // Reset retry count
            
            handleUseHomeAddress();
            speak(t('setting-delivery-to-home-speech', replyLang), langWithRegion, triggerVoicePrompt);
        } else if (locationSimilarity > 0.6) {
            // Success: Reset flags
            isWaitingForAddressTypeRef.current = false;
            addressRetryCountRef.current = 0; // Reset retry count
    
            handleUseCurrentLocation();
            speak(t('using-current-location-speech', replyLang), langWithRegion, triggerVoicePrompt);
        } else {
            // Failure Logic
            if (addressRetryCountRef.current < 2) {
                // ALLOW RETRY: Increment counter, keep flag TRUE
                addressRetryCountRef.current += 1;
                
                // Speak a specific prompt asking them to try again
                speak(t('did-not-understand-please-repeat', replyLang), langWithRegion, triggerVoicePrompt);
            } else {
                // STOP LOOP: Max retries reached. Reset everything.
                isWaitingForAddressTypeRef.current = false;
                addressRetryCountRef.current = 0;
                
                speak(t('address-selection-cancelled-speech', replyLang), langWithRegion, false); // Pass false to stop listening
                handleCommandFailure(commandText, spokenLang, `Address type clarification failed. Max retries reached.`);
            }
        }
        return; 
    }


    if (isWaitingForStoreNameRef.current) {
        isWaitingForStoreNameRef.current = false; // Reset immediately
        let bestMatch: { store: Store, similarity: number } | null = null;
        for (const [alias, store] of storeAliasMap.entries()) {
            const similarity = calculateSimilarity(commandText.toLowerCase(), alias);
            if (!bestMatch || similarity > bestMatch.similarity) {
                bestMatch = { store, similarity: similarity };
            }
        }

       if (bestMatch && bestMatch.similarity > 0.6) {
           const store = bestMatch.store;
           setActiveStoreId(store.id);
          speak(t('okay-ordering-from-speech', replyLang).replace('{storeName}', store.name), langWithRegion, triggerVoicePrompt);
       } else {
          speak(t('could-not-find-store-speech', replyLang).replace('{storeName}', commandText), langWithRegion, triggerVoicePrompt);
           handleCommandFailure(commandText, spokenLang, `Store clarification failed. Best match: ${bestMatch?.store.name} (${bestMatch?.similarity.toFixed(2)})`);
       }
       return;
    }
    
    if (formFieldToFillRef.current && profileForm) {
        profileForm.setValue(formFieldToFillRef.current, commandText, { shouldValidate: true });
        handleProfileFormInteraction();
        return;
    }
    
    const multiItemSeparators = ['and', 'మరియు'];
    const separatorUsed = multiItemSeparators.find(sep => commandText.toLowerCase().includes(` ${sep} `));
    
    if (separatorUsed && recognizeIntent(commandText, spokenLang).type === 'ORDER_ITEM') {
        await commandActionsRef.current.orderMultipleItems(commandText.split(new RegExp(` ${separatorUsed} `, 'i')), spokenLang, commandText);
        return;
    }

    const intent = recognizeIntent(commandText, spokenLang);

    switch (intent.type) {
        case 'SMART_ORDER':
            await commandActionsRef.current.handleSmartOrder(intent.originalText, intent.lang);
            break;

        case 'GET_RECIPE':
            if (!aiConfig?.isRecipeApiEnabled) {
                speak("I'm sorry, the recipe feature is currently disabled.", langWithRegion);
                return;
            }
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
        
        case 'NAVIGATE':
        case 'CONVERSATIONAL': {
            const commandKey = intent.type === 'NAVIGATE' ? intent.destination : intent.commandKey;
            if(commandKey) {
                const action = commandActionsRef.current[commandKey];
                const reply = commands[commandKey]?.reply || `Executing ${commands[commandKey]?.display}`;
                if (action) {
                    speak(reply, langWithRegion, () => action({ lang: intent.lang }));
                } else {
                    speak(reply, langWithRegion, false);
                }
            }
            break;
        }
        case 'ORDER_ITEM': {
            const { product, variant, requestedQty, remainingPhrase, matchedAlias } = await findProductAndVariant(commandText);
            
            const priceData = product ? productPrices[product.name.toLowerCase()] : null;
            const hasMultipleVariants = priceData && priceData.variants && priceData.variants.length > 1;

            if (product && hasMultipleVariants && !variant) {
                // Enter drill-down mode
                productForVariantSelection.current = product;
                const pricesString = priceData.variants.map(v => `₹${v.price}`).join(', ');
                speak(`${getProductName(product)} is available for ${pricesString}. Which price would you like?`, replyLang);
            }
            else if (product && variant) {
                const productWithContext = { ...product, matchedAlias: matchedAlias || commandText, isAiAssisted: !!matchedAlias };
                addItemToCart(productWithContext, variant, requestedQty);
                onOpenCart();
                const productLang = spokenLang;
                const replyProductName = t(product.name.toLowerCase().replace(/ /g, '-'), productLang);

                let speech = t('adding-item-speech', replyLang)
                    .replace('{quantity}', `${requestedQty}`)
                    .replace('{weight}', `${variant.weight}`)
                    .replace('{productName}', replyProductName);

                speak(speech, langWithRegion);
            } else {
                handleCommandFailure(commandText, spokenLang, `ORDER_ITEM intent failed. Product not found or no variants. Phrase: "${remainingPhrase}"`);
            }
            break;
        }

        case 'UNKNOWN':
        default:
            handleCommandFailure(commandText, spokenLang, 'UNKNOWN intent');
            break;
    }
  }, [
      firestore, user, language, determinePhraseLanguage, updateRecognitionLanguage, speak, resetAllContext,
      isWaitingForQuickOrderConfirmation,
      findProductAndVariant, addItemToCart, onOpenCart, t, getProductName,
      locales, commands, getAllAliases, recognizeIntent, aiConfig,
      handleUseHomeAddress, handleUseCurrentLocation, triggerVoicePrompt, setActiveStoreId,
      storeAliasMap, profileForm, handleProfileFormInteraction, handleCommandFailure, fetchInitialData,
      placeOrderBtnRef, onCloseCart, setHomeAddress,
      setShouldUseCurrentLocation, setIsWaitingForQuickOrderConfirmation, clearCart, updateQuantity,
      removeItem, router, stores, productPrices
  ]);

    // Effect to handle retrying a command
    useEffect(() => {
        if (retryCommandText) {
            handleCommand(retryCommandText);
            onRetryHandled(); // Signal that the retry has been processed
        }
    }, [retryCommandText, handleCommand, onRetryHandled]);

  useEffect(() => {
    if (!recognition) {
      onStatusUpdate("Speech recognition not supported by this browser.");
      return;
    }

    recognition.onstart = () => {
        onStatusUpdate(`Listening... (${language}-IN)`);
    };

    recognition.onresult = (event) => {
        if (isSpeakingRef.current) return;
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
            setTimeout(() => {
                try {
                    if (isEnabledRef.current && !isSpeakingRef.current && recognition) {
                         recognition.start();
                    }
                } catch (e) {
                    if (! (e instanceof DOMException && e.name === 'InvalidStateError')) {
                        console.error("Could not start recognition:", e);
                    }
                }
            }, 300);
        }
    };

    commandActionsRef.current = {
      home: (params: {lang: string}) => router.push('/'),
      stores: (params: {lang: string}) => router.push('/stores'),
      dashboard: (params: {lang: string}) => router.push('/dashboard'),
      cart: (params: {lang: string}) => router.push('/cart'),
      orders: (params: {lang: string}) => router.push('/dashboard/customer/my-orders'),
      deliveries: (params: {lang: string}) => router.push('/dashboard/delivery/deliveries'),
      myStore: (params: {lang: string}) => router.push('/dashboard/owner/my-store'),
      myProfile: (params: {lang: string}) => router.push('/dashboard/customer/my-profile'),
      managePacks: (params: {lang: string}) => router.push('/dashboard/owner/packs'),
      'recipe-tester': (params: {lang: string}) => router.push('/dashboard/admin/recipe-tester'),
      'get-recipe': async ({ dishName, lang }: { dishName: string, lang: string }) => {
        const replyLang = lang === 'hi' ? 'en' : lang;
        const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;
        if (!firestore) return;

        const cachedIngredients = await getCachedRecipe(firestore, dishName);
        if (cachedIngredients) {
            const ingredientsText = cachedIngredients.join(', ');
            speak(`The ingredients for ${dishName} are: ${ingredientsText}`, langWithRegion);
            return;
        }

        speak(`Let me check the ingredients for ${dishName}...`, langWithRegion);
        try {
            const result = await getIngredientsForDish({ dishName, language: replyLang });
            if (result.isSuccess && result.ingredients.length > 0) {
                const ingredientsText = result.ingredients.join(', ');
                speak(`The main ingredients for ${dishName} are: ${ingredientsText}`, langWithRegion);
                await cacheRecipe(firestore, dishName, result.ingredients);
            } else {
                speak(`I'm sorry, I couldn't find the ingredients for ${dishName}.`, langWithRegion);
            }
        } catch (error) {
            console.error("AI recipe flow failed:", error);
            speak(`I'm having trouble connecting to my knowledge base right now. Please try again later.`, langWithRegion);
        }
      },
      checkout: (params: { lang: string }) => {
        const lang = params.lang || language;
        const replyLang = lang === 'hi' ? 'en' : lang;
        const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;
        onCloseCart();
        if (cartTotal > 0) {
            const total = cartTotal + 30; // Delivery fee
            speak(t('proceeding-to-checkout-speech', replyLang).replace('{total}', `₹${total.toFixed(2)}`), langWithRegion, () => {
                router.push('/checkout');
                triggerVoicePrompt();
            });
        } else {
            speak(t('your-cart-is-empty-speech', replyLang), langWithRegion);
        }
      },
      homeAddress: ({lang}: {lang: string}) => {
        if(pathname === '/checkout') {
          handleUseHomeAddress();
        }
      },
      currentLocation: ({lang}: {lang: string}) => {
        if(pathname === '/checkout') {
          handleUseCurrentLocation();
        }
      },
      placeOrder: (params: {lang: string}) => {
        const lang = params?.lang || language;
        const replyLang = lang === 'hi' ? 'en' : lang;
        const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;
        if (pathname === '/checkout' && placeOrderBtnRef?.current) {
          speak(t('placing-your-order-now-speech', replyLang), langWithRegion, () => {
              placeOrderBtnRef?.current?.click();
          });
        } else if (cartItemsProp.length > 0) {
          commandActionsRef.current.checkout({ lang });
        } else {
          speak(t('your-cart-is-empty-speech', replyLang), langWithRegion);
        }
      },
      saveChanges: (params: {lang: string}) => {
        const lang = params?.lang || language;
        const replyLang = lang === 'hi' ? 'en' : lang;
        const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;
        if (pathname === '/dashboard/owner/my-store' && saveInventoryBtnRef?.current) {
          saveInventoryBtnRef.current.click();
          speak(t('saving-changes', replyLang), langWithRegion);
        } else if (pathname === '/dashboard/customer/my-profile' && profileForm) {
            if (typeof document !== 'undefined') {
                const formElement = document.querySelector('form');
                if (formElement) formElement.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                speak(t('saving-changes', replyLang), langWithRegion);
            }
        } else {
          speak(t('no-changes-to-save-speech', replyLang), langWithRegion);
        }
      },
      acceptDeliveryJob: ({ lang }: {lang: string}) => {
          const replyLang = lang === 'hi' ? 'en' : lang;
          const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;
          if (pathname === '/dashboard/delivery/deliveries' && typeof document !== 'undefined') {
              const acceptButton = document.querySelector('.accordion-content button') as HTMLButtonElement | null;
              if (acceptButton) {
                  speak("Okay, accepting the first available job group.", langWithRegion);
                  acceptButton.click();
              } else {
                  speak("There are no available jobs to accept right now.", langWithRegion);
              }
          } else {
              speak("You can only accept jobs from the deliveries page.", langWithRegion);
          }
      },
      showDetails: ({ target, lang }: {target: string, lang: string}) => {
        const replyLang = lang === 'hi' ? 'en' : lang;
        const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;
        if (pathname === '/dashboard/delivery/deliveries') {
            const detailsButton = document.querySelector('[id^="details-btn-"]') as HTMLButtonElement | null;
            if (detailsButton) {
                speak("Showing details for the first group.", langWithRegion);
                detailsButton.click();
            } else {
                speak("I couldn't find any details to show.", langWithRegion);
            }
        } else {
            speak("You can only view delivery details on the deliveries page.", langWithRegion);
        }
      },
      refresh: (params: {lang: string}) => {
         window.location.reload();
      },
      goToStore: ({ store, lang }: {store: Store, lang: string}) => {
        const replyLang = lang === 'hi' ? 'en' : lang;
        const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;
        speak(`Okay, opening ${store.name}.`, langWithRegion, false);
        router.push(`/stores/${store.id}`);
      },
    checkPrice: async ({ phrase, lang, originalText }: { phrase?: string; lang: string, originalText: string }) => {
      if (!phrase) return;

      const { product, lang: detectedLang } = await findProductAndVariant(phrase);
      const replyLang = detectedLang === 'hi' ? 'en' : detectedLang;
      const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;

      if (product) {
        let priceData = productPrices[product.name.toLowerCase()];
        if (priceData === undefined && firestore) {
          await fetchProductPrices(firestore, [product.name]);
          priceData = useAppStore.getState().productPrices[product.name.toLowerCase()];
        }
        
        if (priceData && priceData.variants && priceData.variants.length > 0) {
          const pricesString = priceData.variants.map(v => 
            t('price-check-variant-speech', replyLang)
              .replace('{weight}', v.weight)
              .replace('{price}', `₹${v.price.toFixed(2)}`)
          ).join(', ');

          const reply = t('price-check-reply-speech', replyLang)
            .replace('{productName}', getProductName(product))
            .replace('{prices}', pricesString);
          
          speak(`${reply} Would you like to add it to your cart?`, langWithRegion);
          itemForPriceCheck.current = product;
          return;

        } else {
          speak(t('no-price-found-speech', replyLang).replace('{productName}', getProductName(product)), langWithRegion);
          handleCommandFailure(originalText, detectedLang, `Price check: product "${product.name}" found but no price data available.`);
          return;
        }
      }
      
      handleCommandFailure(originalText, lang, `Price check: product not found in phrase "${phrase}".`);
    },
    removeItemFromCart: async ({ phrase, lang }: { phrase?: string; lang: string }) => {
        const replyLang = lang === 'hi' ? 'en' : lang;
        const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;
        if (!phrase) return;
        if (cartItemsProp.length === 0) {
            speak("Your cart is already empty.", langWithRegion);
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
            speak(`Okay, I've removed ${getProductName(item.product)} from your cart.`, langWithRegion);
        } else {
            speak(`I couldn't find "${phrase}" in your cart.`, langWithRegion);
        }
    },
    orderMultipleItems: async (phrases: string[], lang: string, originalText: string) => {
        let addedItems: string[] = [];
        let failedItems: string[] = [];
        const multiplePhrases = phrases.flatMap(p => p.split(new RegExp(` మరియు `, 'i')));

        for (const phrase of multiplePhrases) {
            const { product, variant, requestedQty } = await findProductAndVariant(phrase);
            if (product && variant) {
                addItemToCart(product, variant, requestedQty);
                addedItems.push(getProductName(product));
            } else {
                failedItems.push(phrase.trim());
            }
        }
        
        const replyLang = lang === 'hi' ? 'en' : lang;
        const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;
        
        if (addedItems.length > 0) {
            onOpenCart();
            let speech;
            if (failedItems.length > 0) {
                speech = `${t('ive-added-to-your-cart', replyLang).replace('{items}', addedItems.join(', '))} ${t('but-i-couldnt-find', replyLang).replace('{items}', failedItems.join(', '))}`;
            } else {
                speech = t('ive-added-to-your-cart', replyLang).replace('{items}', addedItems.join(', '));
            }
            speak(speech, langWithRegion);
        } else {
            handleCommandFailure(originalText, lang, `Multi-order: No products found. Failed items: ${failedItems.join(', ')}`);
        }
    },
    handleSmartOrder: async (text: string, lang: string) => {
        const replyLang = lang === 'hi' ? 'en' : lang;
        const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;
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
            speak(t('could-not-find-product-in-order-speech', replyLang), langWithRegion);
            return;
        }

        const productPhrase = text.substring(0, fromIndex).replace(/^(order|buy|get|send)\s+/i, '').trim();
        const storePhrase = text.substring(fromIndex + fromKeyword.length + 1, toIndex).trim();
        const addressPhrase = text.substring(toIndex + toKeyword.length + 1).trim();

        // 1. Process Product
        const { product, variant, requestedQty } = await findProductAndVariant(productPhrase);
        if (!product || !variant) {
            speak(t('could-not-find-item-speech', replyLang).replace('{itemName}', productPhrase), langWithRegion);
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
            speak(t('could-not-identify-store-speech', replyLang), langWithRegion);
            return;
        }

        // 3. Process Address
        const homeKeywords = getAllAliases('homeAddress')[lang] || ['home'];
        const locationKeywords = getAllAliases('currentLocation')[lang] || ['current', 'location'];
        const homeSimilarity = Math.max(...homeKeywords.map(kw => calculateSimilarity(addressPhrase.toLowerCase(), kw)));
        const locationSimilarity = Math.max(...locationKeywords.map(kw => calculateSimilarity(addressPhrase.toLowerCase(), kw)));

        let deliveryAddress = '';
        let useCurrentLocation = false;
        if (homeSimilarity > 0.7 && homeSimilarity > locationSimilarity) {
            if (userProfileRef.current?.address) {
                deliveryAddress = userProfileRef.current.address;
            } else {
                speak(t('cannot-deliver-home-no-address-speech', replyLang), langWithRegion, false);
                router.push('/dashboard/customer/my-profile');
                return;
            }
        } else if (locationSimilarity > 0.7) {
            useCurrentLocation = true;
        } else {
            // If it's not clearly home or current, set it to the raw phrase and let the user fix it.
            deliveryAddress = addressPhrase;
        }

        // 4. Execute Actions
        const speech = t('preparing-order-speech', replyLang)
            .replace('{items}', `${requestedQty} ${variant.weight} of ${getProductName(product)}`)
            .replace('{storeName}', bestStoreMatch.name);

        speak(speech, langWithRegion, () => {
            setIsWaitingForQuickOrderConfirmation(true); // Prevents checkout page from prompting
            addItemToCart(product, variant, requestedQty);
            setActiveStoreId(bestStoreMatch!.id);
            if(useCurrentLocation) {
                setShouldUseCurrentLocation(true);
            } else {
                setHomeAddress(deliveryAddress);
            }
            useCheckoutStore.getState().setShouldPlaceOrderDirectly(true); // Signal the checkout page to auto-submit
            router.push('/checkout');
        });
    },
  };


    if (firestore && user) {
        const userDocRef = doc(firestore, 'users', user.uid);
        getDoc(userDocRef).then(docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data() as User;
                userProfileRef.current = data;
            };
        });
    }


    return () => {
      if (recognition) {
        recognition.onend = null;
        recognition.stop();
      }
    };
  }, [
      handleCommand, cartTotal, cartItemsProp, pathname, masterProducts, t, aiConfig, isAppStoreLoading,
      productPrices, fetchProductPrices, firestore, user, router, language, setLanguage, speak,
      updateRecognitionLanguage, determinePhraseLanguage, resetAllContext, storeAliasMap,
      handleUseHomeAddress, handleUseCurrentLocation, triggerVoicePrompt, setActiveStoreId,
      profileForm, handleProfileFormInteraction, handleCommandFailure, fetchInitialData,
      placeOrderBtnRef, isWaitingForQuickOrderConfirmation, onCloseCart, setHomeAddress,
      setShouldUseCurrentLocation, setIsWaitingForQuickOrderConfirmation, clearCart, updateQuantity,
      getProductName, addItemToCart, removeItem, locales, commands, getAllAliases, recognizeIntent, stores
  ]);

  return null;
}
