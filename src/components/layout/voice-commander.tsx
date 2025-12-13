

'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, errorEmitter, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import type { Store, Product, ProductPrice, CartItem, User, FailedVoiceCommand, ProductVariant, SiteConfig, VoiceAliasGroup, Menu, MenuItem } from '@/lib/types';
import { calculateSimilarity } from '@/lib/calculate-similarity';
import { useCart } from '@/lib/cart';
import { useAppStore } from '@/lib/store';
import { useMyStorePageStore } from '@/lib/store';
import { t } from '@/lib/locales';
import { doc, getDoc, serverTimestamp, addDoc, collection, query, where, getDocs, writeBatch, arrayUnion, setDoc, limit } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import { useCheckoutStore } from '@/app/checkout/page';
import { useProfileFormStore, ProfileFormValues } from '@/lib/store';
import { getWikipediaSummary, getMealDbRecipe } from '@/app/actions';
import { useVoiceCommanderContext } from './main-layout';
import { getIngredientsForDish } from '@/ai/flows/recipe-ingredients-flow';
import { runNLU, extractQuantityAndProduct } from '@/lib/nlu/voice-integration';
import { useInstall } from '../install-provider';


export interface Command {
  command: string;
  action: (params?: any) => void;
  display: string;
  reply: {
    en: string;
    te?: string;
    hi?: string;
    en_audio?: string;
    te_audio?: string;
    hi_audio?: string;
  };
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
  onInstallApp: () => void;
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
  | { type: 'GET_KNOWLEDGE', topic: string, originalText: string, lang: string }
  | { type: 'MATH', originalText: string, lang: string }
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
  GET_KNOWLEDGE: ['what is', 'what are', 'tell me about', 'who is', 'explain'],
  MATH: ['+', '-', '*', '/', 'plus', 'minus', 'times', 'divided by'],
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
  onInstallApp,
}: VoiceCommanderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const { clearCart, addItem: addItemToCart, removeItem, updateQuantity, addUnidentifiedItem, updateUnidentifiedItem, addIdentifiedItem, activeStoreId, setActiveStoreId, cartTotal } = useCart();
  const { retryCommand, showPriceCheck, hidePriceCheck } = useVoiceCommanderContext();

  const { stores, masterProducts, allMenus, productPrices, fetchProductPrices, getProductName, language, setLanguage, getAllAliases, locales, commands, loading: isAppStoreLoading, fetchInitialData } = useAppStore();

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
  const itemForPriceCheck = useRef<{product: Product, variants: ProductVariant[]} | null>(null);
  const productForVariantSelection = useRef<Product | null>(null);
  const lastTranscriptRef = useRef<string>('');

  const userProfileRef = useRef<User | null>(null);

  const [hasMounted, setHasMounted] = useState(false);

  const [speechSynthesisVoices, setSpeechSynthesisVoices] = useState<SpeechSynthesisVoice[]>([]);

  const [hasRunCheckoutPrompt, setHasRunCheckoutPrompt] = useState(false);

  // --- NEW: Context-aware menu data ---
  const isMenuPage = pathname.startsWith('/menu/');
  const menuStoreId = isMenuPage ? pathname.split('/')[2] : null;
  const currentMenu = useMemo(() => allMenus.find(m => m.storeId === menuStoreId), [allMenus, menuStoreId]);
  // ------------------------------------

    // --- Performance Optimization: Memoized Alias Maps ---
  const universalProductAliasMap = useMemo<AliasToProductMap>(() => {
    const map: AliasToProductMap = new Map();
    if (isAppStoreLoading || !masterProducts) return map;

    for (const p of masterProducts) {
      if (!p?.name) continue;
      const productSlug = p.name.toLowerCase().replace(/ /g, '-');
      const productAliasesByLang = getAllAliases(productSlug);

      const normalizedCanonicalName = p.name.toLowerCase();
      map.set(normalizedCanonicalName, { product: p, lang: 'en' });
      map.set(normalizedCanonicalName.replace(/\s/g, ''), { product: p, lang: 'en' });

      for (const lang in productAliasesByLang) {
        for (const alias of productAliasesByLang[lang]) {
          const normalizedAlias = alias.toLowerCase();
          map.set(normalizedAlias, { product: p, lang: lang });
          map.set(normalizedAlias.replace(/\s/g, ''), { product: p, lang: lang });
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
            map.set(normalizedTerm.replace(/\s/g, ''), { ...s });
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
    hidePriceCheck();
    productForVariantSelection.current = null;
    isWaitingForStoreNameRef.current = false;
    isWaitingForAddressTypeRef.current = false;
    addressRetryCountRef.current = 0;
    onSuggestions([]);
    setIsWaitingForQuickOrderConfirmation(false);
    formFieldToFillRef.current = null;
    useCheckoutStore.getState().setShouldPlaceOrderDirectly(false);
    setHasRunCheckoutPrompt(false);
  }, [onSuggestions, setIsWaitingForQuickOrderConfirmation, hidePriceCheck]);


  const determinePhraseLanguage = useCallback((text: string): string => {
    const lowerText = text.toLowerCase();

    // If it contains Telugu script, it's Telugu
    if (/[\u0C00-\u0C7F]/.test(lowerText)) {
      return 'te';
    }

    const langKeywords = [
        { lang: 'te', keywords: ['naku', 'naaku', 'kavali', 'dhara'] },
        { lang: 'hi', keywords: ['mujhe', 'chahiye'] },
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

    return 'en'; // Default to English if no specific language is detected
  }, [locales]);


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
            recognition.lang = 'en-IN'; // Always listen in English
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
}, [enabled]);

 const speak = useCallback((textOrReply: Command['reply'] | string, lang: string, onEndCallback?: (() => void) | boolean) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (typeof onEndCallback === 'function') onEndCallback();
      return;
    }

    if (recognition) {
      recognition.stop();
    }

    isSpeakingRef.current = true;
    window.speechSynthesis.cancel();

    const targetLang = lang.split('-')[0] as 'en' | 'te' | 'hi';
    let textToSpeak = '';
    let audioUrl: string | undefined = undefined;

    if (typeof textOrReply === 'object' && textOrReply !== null) {
        audioUrl = textOrReply[targetLang + '_audio'];
        textToSpeak = textOrReply[targetLang] || textOrReply['en'] || '';
    } else if (typeof textOrReply === 'string') {
        textToSpeak = textOrReply;
    } else {
        console.warn('No suitable reply found for language:', targetLang, 'from', textOrReply);
        if (typeof onEndCallback === 'function') onEndCallback();
        return;
    }

    const onEnd = () => {
        isSpeakingRef.current = false;
        if (typeof onEndCallback === 'function') onEndCallback();
        if (isEnabledRef.current && recognition) {
            try { recognition.start(); } catch(e) {}
        }
    };

    // Prioritize playing the recorded audio
    if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.onended = onEnd;
        audio.onerror = (e) => {
            console.error('Audio playback error', e);
            onEnd();
        };
        audio.play().catch(onEnd);
        return;
    }

    // Fallback to text-to-speech if no audio URL
    const replies = textToSpeak.split(',').map(r => r.trim());
    const text = replies[Math.floor(Math.random() * replies.length)];
    const utterance = new SpeechSynthesisUtterance(text);

    let voice = speechSynthesisVoices.find(v => v.lang.startsWith(targetLang) && v.name.includes('Google')) ||
                speechSynthesisVoices.find(v => v.lang.startsWith(targetLang)) ||
                speechSynthesisVoices.find(v => v.default);

    if (voice) {
      utterance.voice = voice;
    } else {
      console.warn(`No voice found for language: ${lang}. Using default.`);
    }

    utterance.onend = onEnd;
    utterance.onerror = (e) => {
      console.error('Speech synthesis error', e);
      onEnd();
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

const findProductAndVariant = useCallback(
  async (phrase: string): Promise<{
    product: Product | null;
    variant: ProductVariant | null;
    requestedQty: number;
    remainingPhrase: string;
    matchedAlias: string | null;
    lang: string;
  }> => {
    const nluResult = runNLU(phrase, language);
    const { qty, unit, money, productPhrase } = extractQuantityAndProduct(nluResult);

    // --- CONTEXT-AWARE SEARCH LOGIC ---
    if (isMenuPage && currentMenu) {
        let bestMatch: { menuItem: MenuItem, score: number } | null = null;
        for (const item of currentMenu.items) {
            const similarity = calculateSimilarity(productPhrase.toLowerCase(), item.name.toLowerCase());
            if (!bestMatch || similarity > bestMatch.score) {
                if(similarity > 0.8) {
                    bestMatch = { menuItem: item, score: similarity };
                }
            }
        }
        
        if (bestMatch) {
            const menuItem = bestMatch.menuItem;
            // Create a "virtual" product and variant from the menu item
            const virtualProduct: Product = {
                id: `${menuStoreId}-${menuItem.name.replace(/\s/g, '-')}`,
                name: menuItem.name,
                description: menuItem.description || '',
                storeId: menuStoreId!,
                category: menuItem.category,
                imageId: 'cat-restaurant', // Generic fallback
                isMenuItem: true,
                price: menuItem.price
            };
            const virtualVariant: ProductVariant = {
                sku: `${menuStoreId}-${menuItem.name.replace(/\s/g, '-')}-default`,
                weight: '1 pc', // Menu items are usually per piece
                price: menuItem.price,
                stock: 99, // Assume available
            };
            return { product: virtualProduct, variant: virtualVariant, requestedQty: qty || 1, remainingPhrase: '', matchedAlias: menuItem.name, lang: language };
        }
    }

    // --- FALLBACK TO GROCERY SEARCH ---
    let bestMatch: { product: Product, alias: string, score: number, lang: string } | null = null;
    
    if (productPhrase) {
        const directMatch = universalProductAliasMap.get(productPhrase.toLowerCase()) || universalProductAliasMap.get(productPhrase.toLowerCase().replace(/\s/g, ''));
        if (directMatch) {
            bestMatch = { product: directMatch.product, alias: productPhrase, score: 1.0, lang: directMatch.lang };
        } else {
            for (const [alias, { product, lang }] of universalProductAliasMap.entries()) {
                const similarity = calculateSimilarity(productPhrase, alias);
                if (similarity > 0.7 && (!bestMatch || similarity > bestMatch.score)) {
                    bestMatch = { product, alias, score: similarity, lang };
                }
            }
        }
    }

    if (!bestMatch) {
      return { product: null, variant: null, requestedQty: qty, remainingPhrase: productPhrase, matchedAlias: null, lang: 'en' };
    }

    const { product, lang: detectedLang, alias: matchedAlias } = bestMatch;
    
    const priceData = productPrices[product.name.toLowerCase()];

    if (!priceData?.variants?.length) {
        return { product, variant: null, requestedQty: qty, remainingPhrase: productPhrase, matchedAlias, lang: detectedLang };
    }
    
    let chosenVariant: ProductVariant | null = null;
    let finalQty = qty;

    if (money && money > 0) {
        const isLiquid = product.category?.toLowerCase().includes('oil') || product.category?.toLowerCase().includes('beverage');
        const baseUnit = isLiquid ? 'l' : 'kg';
        const baseVariant = priceData.variants.find(v => v.weight.includes(baseUnit)) || priceData.variants[0];

        const baseWeightStr = baseVariant.weight.match(/(\d+\.?\d*)/);
        const baseWeight = baseWeightStr ? parseFloat(baseWeightStr[0]) : 1;
        const pricePerBaseUnit = baseVariant.price / (baseWeight * 1000); // price per ml or gram

        const requestedAmount = money / pricePerBaseUnit;

        chosenVariant = {
            price: money,
            weight: `${Math.round(requestedAmount)}${isLiquid ? 'ml' : 'gm'}`,
            sku: `${baseVariant.sku}-custom-${money}`,
            stock: baseVariant.stock,
        };
        finalQty = 1;

    } else if (unit) {
        const isLiquidUnit = unit === 'ml';
        let requestedAmount = qty;
        
        // This is the fix: convert litres/kg to base units
        if (unit === 'l') {
            requestedAmount = qty * 1000;
        } else if (unit === 'kg') {
            requestedAmount = qty * 1000;
        }

        const baseUnit = isLiquidUnit ? 'l' : 'kg';
        const baseVariant = priceData.variants.find(v => v.weight.includes(baseUnit)) || priceData.variants[0];
        
        const baseWeightStr = baseVariant.weight.match(/(\d+\.?\d*)/);
        const baseWeight = baseWeightStr ? parseFloat(baseWeightStr[0]) : 1;
        const pricePerBaseUnit = baseVariant.price / (baseWeight * 1000); // price per ml or gram
        
        const newPrice = requestedAmount * pricePerBaseUnit;
        
        chosenVariant = {
            price: newPrice,
            weight: `${Math.round(requestedAmount)}${isLiquidUnit ? 'ml' : 'gm'}`,
            sku: `${baseVariant.sku}-custom-${requestedAmount}${isLiquidUnit ? 'ml' : 'gm'}`,
            stock: baseVariant.stock,
        };
        finalQty = 1;
    } else { 
        chosenVariant = priceData.variants.find(v => {
            const variantWeightMatch = v.weight.match(/(\d+\.?\d*)/);
            const variantWeight = variantWeightMatch ? parseFloat(variantWeightMatch[0]) : 0;
            return variantWeight === finalQty;
        }) || priceData.variants[0];
    }
    
    return { product, variant: chosenVariant, requestedQty: finalQty, remainingPhrase: productPhrase, matchedAlias, lang: detectedLang };
}, [firestore, productPrices, universalProductAliasMap, language, isMenuPage, currentMenu, menuStoreId]);


  const recognizeIntent = useCallback((text: string, spokenLang: string): Intent => {
    const lowerText = text.toLowerCase().trim();
    const nlu = runNLU(text, spokenLang);

    if (nlu.hasMath) {
        return { type: 'MATH', originalText: text, lang: spokenLang };
    }

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

    const knowledgeKeyword = intentKeywords.GET_KNOWLEDGE.find(kw => lowerText.startsWith(kw));
    if (knowledgeKeyword) {
        const topic = lowerText.substring(knowledgeKeyword.length).trim();
        return { type: 'GET_KNOWLEDGE', topic, originalText: text, lang: spokenLang };
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

  }, [commands, getAllAliases, language]);


    const handleCommandFailure = useCallback(async (commandText: string, spokenLang: string, reason: string) => {
        const tempId = addUnidentifiedItem(commandText);
        speak(t('sorry-i-didnt-understand-that', spokenLang), `${spokenLang}-IN`);
        
        if (!firestore || !user) {
            updateUnidentifiedItem(tempId, 'failed');
            return;
        }

        addDoc(collection(firestore, 'failedCommands'), {
            userId: user.uid,
            commandText,
            language: spokenLang,
            reason,
            timestamp: serverTimestamp()
        });
        updateUnidentifiedItem(tempId, 'failed');

    }, [addUnidentifiedItem, updateUnidentifiedItem, firestore, user, speak, t]);


  const handleCommand = useCallback(async (commandText: string) => {
    if (lastTranscriptRef.current === commandText) {
      return;
    }
    lastTranscriptRef.current = commandText;
    
    const intent = recognizeIntent(commandText, "en");
    const requiresUser = ['SMART_ORDER', 'ORDER_ITEM', 'REMOVE_ITEM', 'CHECK_PRICE', 'GET_RECIPE', 'SHOW_DETAILS', 'placeOrder', 'saveChanges'].includes(intent.type) || (intent.type === 'CONVERSATIONAL' && ['dashboard', 'orders', 'myStore', 'myProfile'].includes(intent.commandKey));

    if (requiresUser && !user && !isMenuPage) {
        speak("You need to be logged in to do that. Please log in to continue.", 'en-IN');
        router.push('/login');
        return;
    }

    let spokenLang = determinePhraseLanguage(commandText);
    const replyLang = spokenLang;
    const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;

    // --- CONTEXTUAL RESPONSES ---
    if (itemForPriceCheck.current) {
      const context = itemForPriceCheck.current;
      const lowerCommandText = commandText.toLowerCase();
      let chosenVariant: ProductVariant | null = null;
      let requestedQty = 1;

      const yesKeywords = ['yes', 'add', 'buy', 'okay', 'yep', 'yeah', 'sare', 'sari', 'sareh', 'సరే', 'అవును'];
      const noKeywords = ['no', 'cancel', 'stop', 'వద్దు', 'not now'];

      const isYes = yesKeywords.some(kw => lowerCommandText.includes(kw));
      const isNo = noKeywords.some(kw => lowerCommandText.includes(kw));

      // --- Start of Variant Selection Logic ---

      // Case 1: Direct match by spoken weight (e.g., "add 1kg" or "one kilo")
      const { variant: foundVariantByWeight, requestedQty: foundQty } = await findProductAndVariant(commandText);
      if (foundVariantByWeight && context.variants.some(v => v.sku === foundVariantByWeight.sku)) {
          chosenVariant = foundVariantByWeight;
          requestedQty = foundQty;
      }

      // Case 2: Match by spoken price (e.g., "the 50 rupee one")
      if (!chosenVariant) {
          const numbersInCommand = lowerCommandText.match(/\d+/g)?.map(Number);
          if (numbersInCommand) {
              for (const price of numbersInCommand) {
                  const matchedVariant = context.variants.find(v => Math.round(v.price * 1.20) === price);
                  if (matchedVariant) {
                      chosenVariant = matchedVariant;
                      break;
                  }
              }
          }
      }

      // Case 3: Match by position ("the first one", "second", "3")
      if (!chosenVariant) {
          const positionalWords: { [key: string]: number } = {
              'first': 0, '1st': 0, 'one': 0, '1': 0, 'modati': 0, 'okati': 0, 'पहला': 0,
              'second': 1, '2nd': 1, 'two': 1, '2': 1, 'rendava': 1, 'दूसरा': 1,
              'third': 2, '3rd': 2, 'three': 2, '3': 2, 'moodava': 2, 'तीसरा': 2,
              'fourth': 3, '4th': 3, 'four': 3, '4': 3, 'nalugava': 3, 'चौथा': 3,
              'last': context.variants.length - 1
          };
          for (const word of lowerCommandText.split(' ')) {
              if (positionalWords[word] !== undefined && context.variants[positionalWords[word]]) {
                  chosenVariant = context.variants[positionalWords[word]];
                  break;
              }
          }
      }

      // Case 4: Simple "yes" confirmation (defaults to first variant)
      if (!chosenVariant && isYes) {
          chosenVariant = context.variants[0];
      }

      // --- End of Variant Selection Logic ---

      if (chosenVariant) {
          const productWithContext = { ...context.product, isAiAssisted: true, matchedAlias: `Price check` };
          addItemToCart(productWithContext, chosenVariant, requestedQty || 1);
          onOpenCart();
          const reply = commands['addItem']?.reply;
          if (reply) {
            speak(reply, langWithRegion);
          }
      } else if (isNo) {
          speak("Okay, cancelled.", langWithRegion, false);
      } else {
          // If no variant was selected and it wasn't a "no", assume it's a new command
          resetAllContext();
          handleCommand(commandText);
          return;
      }
      resetAllContext(); // Ensure context is cleared
      return;
    }


    if (isWaitingForAddressTypeRef.current) {
        const lowerCommand = commandText.toLowerCase();
        const homeKeywords = getAllAliases('homeAddress')[spokenLang] || ['home'];
        const locationKeywords = getAllAliases('currentLocation')[spokenLang] || ['current', 'location'];

        const homeSimilarity = Math.max(...homeKeywords.map(kw => calculateSimilarity(lowerCommand, kw.toLowerCase())));
        const locationSimilarity = Math.max(...locationKeywords.map(kw => calculateSimilarity(lowerCommand, kw.toLowerCase())));

        if (homeSimilarity > 0.6 && homeSimilarity > locationSimilarity) {
            isWaitingForAddressTypeRef.current = false;
            addressRetryCountRef.current = 0;

            handleUseHomeAddress();
            speak(commands['homeAddress'].reply, langWithRegion, triggerVoicePrompt);
        } else if (locationSimilarity > 0.6) {
            isWaitingForAddressTypeRef.current = false;
            addressRetryCountRef.current = 0;

            handleUseCurrentLocation();
            speak(commands['currentLocation'].reply, langWithRegion, triggerVoicePrompt);
        } else {
            if (addressRetryCountRef.current < 2) {
                addressRetryCountRef.current += 1;
                speak(t('did-not-understand-please-repeat', replyLang), langWithRegion, triggerVoicePrompt);
            } else {
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
    const separatorUsed = multiItemSeparators.find(sep => ` ${commandText.toLowerCase()} `.includes(` ${sep} `));

    if (separatorUsed && recognizeIntent(commandText, spokenLang).type === 'ORDER_ITEM') {
        await commandActionsRef.current.orderMultipleItems(commandText.split(new RegExp(` ${separatorUsed} `, 'i')), spokenLang, commandText);
        return;
    }
    
    switch (intent.type) {
        case 'SMART_ORDER':
            await commandActionsRef.current.handleSmartOrder(intent.originalText, intent.lang);
            break;

        case 'GET_KNOWLEDGE':
            await commandActionsRef.current.getKnowledge({ topic: intent.topic, lang: intent.lang });
            break;

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

        case 'MATH': {
          const nlu = runNLU(commandText, spokenLang);
          if (nlu.mathResult !== null) {
            speak(`The answer is ${nlu.mathResult}`, langWithRegion);
          } else {
            speak("I couldn't solve that math problem.", langWithRegion);
          }
          break;
        }

        case 'NAVIGATE':
        case 'CONVERSATIONAL': {
            const commandKey = intent.type === 'NAVIGATE' ? intent.destination : intent.commandKey;
            if (commandKey) {
                const action = commandActionsRef.current[commandKey];
                const reply = commands[commandKey]?.reply;
                if (!reply) {
                    console.warn(`No reply found for command: ${commandKey}`);
                    return;
                }

                if (action) {
                    speak(reply, langWithRegion, () => action({ lang: intent.lang }));
                } else {
                    speak(reply, langWithRegion, false);
                }
            }
            break;
        }
        case 'ORDER_ITEM': {
            const { product, variant, requestedQty, remainingPhrase, matchedAlias, lang } = await findProductAndVariant(commandText);

            if (product && variant) {
                const productWithContext = { ...product, matchedAlias: matchedAlias || commandText, isAiAssisted: !!matchedAlias };
                addItemToCart(productWithContext, variant, requestedQty);
                onOpenCart();
                const reply = commands['addItem']?.reply;
                if (reply) {
                    speak(reply, langWithRegion);
                }
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
      firestore, user, language, determinePhraseLanguage, speak, resetAllContext,
      isWaitingForQuickOrderConfirmation,
      findProductAndVariant, addItemToCart, onOpenCart, t, getProductName,
      locales, commands, getAllAliases, recognizeIntent, aiConfig,
      handleUseHomeAddress, handleUseCurrentLocation, triggerVoicePrompt, setActiveStoreId,
      storeAliasMap, profileForm, handleProfileFormInteraction, handleCommandFailure, fetchInitialData,
      placeOrderBtnRef, isWaitingForQuickOrderConfirmation, onCloseCart, setHomeAddress,
      setShouldUseCurrentLocation, setIsWaitingForQuickOrderConfirmation, clearCart, updateQuantity,
      removeItem, addUnidentifiedItem, updateUnidentifiedItem, router, stores, productPrices,
      showPriceCheck, hidePriceCheck, masterProducts, isMenuPage, currentMenu, menuStoreId
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
        onStatusUpdate(`Listening... (en-IN)`);
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
            if (!(e instanceof DOMException && e.name === 'InvalidStateError')) {
              console.error("Could not restart recognition:", e);
            }
          }
        }, 300);
      }
    };

    commandActionsRef.current = {
      home: (params: {lang: string}) => router.push('/'),
      stores: (params: {lang: string}) => router.push('/stores'),
      dashboard: (params: {lang: string}) => {
          if (!user) { router.push('/login'); return; }
          if (user.email === 'admin@gmail.com' || user.email === 'admin2@gmail.com') {
              router.push('/dashboard/admin');
          } else {
              router.push('/dashboard');
          }
      },
      cart: (params: {lang: string}) => router.push('/cart'),
      orders: (params: {lang: string}) => router.push('/dashboard/customer/my-orders'),
      deliveries: (params: {lang: string}) => router.push('/dashboard/delivery/deliveries'),
      myStore: (params: {lang: string}) => router.push('/dashboard/owner/my-store'),
      myProfile: (params: {lang: string}) => router.push('/dashboard/customer/my-profile'),
      managePacks: (params: {lang: string}) => router.push('/dashboard/owner/packs'),
      'recipe-tester': (params: {lang: string}) => router.push('/dashboard/admin/recipe-tester'),
      installApp: (params: {lang: string}) => onInstallApp(),

      'get-recipe': async ({ dishName, lang }: { dishName: string, lang: string }) => {
        const replyLang = lang;
        const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;
        if (!firestore) return;

        speak(`Let me check the ingredients for ${dishName}...`, langWithRegion, false);
        try {
            const result = await getIngredientsForDish({ dishName, language: replyLang });
            if (result.isSuccess && result.ingredients.length > 0) {
                const ingredientsText = result.ingredients.map(ing => ing.name).join(', ');
                speak(`The main ingredients for ${dishName} are: ${ingredientsText}`, langWithRegion);
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
        const replyLang = lang;
        const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;
        onCloseCart();
        if (cartTotal > 0) {
            const total = cartTotal + 30; // Delivery fee
            const reply = t('proceeding-to-checkout-speech', replyLang).replace('{total}', `₹${total.toFixed(2)}`);
            speak(reply, langWithRegion, () => {
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
        const replyLang = lang;
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
        const replyLang = lang;
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
          const replyLang = lang;
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
        const replyLang = lang;
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
        const replyLang = lang;
        const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;
        speak(`Okay, opening ${store.name}.`, langWithRegion, false);
        router.push(`/stores/${store.id}`);
      },
    checkPrice: async ({ phrase, lang, originalText }: { phrase?: string; lang: string, originalText: string }) => {
      if (!phrase) return;

      const { product, lang: detectedLang } = await findProductAndVariant(phrase);
      const replyLang = detectedLang;
      const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;

      if (product) {
          const masterStoreId = stores.find(s => s.name === 'LocalBasket')?.id;
          if (masterStoreId) {
            speak(`Okay, let's see about ${getProductName(product)}.`, langWithRegion, () => {
              router.push(`/stores/${masterStoreId}?category=${encodeURIComponent(product.category || '')}&highlight=${encodeURIComponent(product.name)}`);
            });
          } else {
            speak("I can't navigate to the product page right now.", langWithRegion);
          }
          return;
      }
      
      handleCommandFailure(originalText, lang, `Price check: product not found in phrase "${phrase}".`);
    },
    removeItemFromCart: async ({ phrase, lang }: { phrase?: string; lang: string }) => {
        const replyLang = lang;
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

        const replyLang = lang;
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
        const replyLang = lang;
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
      determinePhraseLanguage, resetAllContext, storeAliasMap,
      handleUseHomeAddress, handleUseCurrentLocation, triggerVoicePrompt, setActiveStoreId,
      profileForm, handleProfileFormInteraction, handleCommandFailure, fetchInitialData,
      placeOrderBtnRef, isWaitingForQuickOrderConfirmation, onCloseCart, setHomeAddress,
      setShouldUseCurrentLocation, setIsWaitingForQuickOrderConfirmation, clearCart, updateQuantity,
      removeItem, addUnidentifiedItem, updateUnidentifiedItem,
      getProductName, addItemToCart, locales, commands, getAllAliases, recognizeIntent, stores,
      showPriceCheck, hidePriceCheck, findProductAndVariant, onInstallApp, isMenuPage, currentMenu, menuStoreId
  ]);

  return null;
}

    
