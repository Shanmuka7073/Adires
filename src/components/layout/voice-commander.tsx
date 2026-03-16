
'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import type { Store, Product, ProductPrice, CartItem, User, FailedVoiceCommand, ProductVariant, SiteConfig, MenuItem, Menu } from '@/lib/types';
import { calculateSimilarity } from '@/lib/calculate-similarity';
import { useCart } from '@/lib/cart';
import { useAppStore } from '@/lib/store';
import { useMyStorePageStore } from '@/lib/store';
import { t } from '@/lib/locales';
import { doc, getDoc, serverTimestamp, addDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useCheckoutStore } from '@/lib/checkout-store';
import { useProfileFormStore, ProfileFormValues } from '@/lib/store';
import { useVoiceCommanderContext } from './voice-commander-context';
import { getIngredientsForDish } from '@/ai/flows/recipe-ingredients-flow';
import { runNLU, extractQuantityAndProduct } from '@/lib/nlu/voice-integration';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { chatWithAsha } from '@/ai/flows/asha-flow';

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
  onOpenCart: () => void;
  onCloseCart: () => void;
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
  | { type: 'ASK_ASHA', originalText: string, lang: string }
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
  ASK_ASHA: ['asha', 'hey asha', 'hi asha', 'ask asha'],
};

export function VoiceCommander({
  enabled,
  onStatusUpdate,
  onOpenCart,
  onCloseCart,
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
  const { clearCart, addItem: addItemToCart, removeItem, activeStoreId, setActiveStoreId, cartTotal } = useCart();
  const { showPriceCheck, hidePriceCheck } = useVoiceCommanderContext();
  const { isRestaurantOwner, isAdmin } = useAdminAuth();

  const { stores, masterProducts, productPrices, fetchProductPrices, getProductName, language, setLanguage, getAllAliases, locales, commands, loading: isAppStoreLoading } = useAppStore();

  const { form: profileForm } = useProfileFormStore();
  const { saveInventoryBtnRef } = useMyStorePageStore();
  const {
    handleUseCurrentLocation,
    handleUseHomeAddress,
    placeOrderBtnRef,
    isWaitingForQuickOrderConfirmation,
    setIsWaitingForQuickOrderConfirmation,
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
  const lastTranscriptRef = useRef<string>('');

  const userProfileRef = useRef<User | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [speechSynthesisVoices, setSpeechSynthesisVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [hasRunCheckoutPrompt, setHasRunCheckoutPrompt] = useState(false);

  // OPTIMIZED: We fetch the current menu locally if on a menu page
  const [localMenu, setLocalMenu] = useState<Menu | null>(null);
  const isMenuPage = pathname.startsWith('/menu/');
  const menuStoreId = isMenuPage ? pathname.split('/')[2] : null;

  useEffect(() => {
      const fetchLocalMenu = async () => {
          if (isMenuPage && menuStoreId && firestore) {
              const q = query(collection(firestore, `stores/${menuStoreId}/menus`), limit(1));
              const snap = await getDocs(q);
              if (!snap.empty) setLocalMenu(snap.docs[0].data() as Menu);
          } else {
              setLocalMenu(null);
          }
      };
      fetchLocalMenu();
  }, [isMenuPage, menuStoreId, firestore]);

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

  const configDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'siteConfig', 'aiFeatures') : null, [firestore]);
  const { data: aiConfig } = useDoc<SiteConfig>(configDocRef);

  const resetAllContext = useCallback(() => {
    itemForPriceCheck.current = null;
    hidePriceCheck();
    isWaitingForStoreNameRef.current = false;
    isWaitingForAddressTypeRef.current = false;
    addressRetryCountRef.current = 0;
    setIsWaitingForQuickOrderConfirmation(false);
    formFieldToFillRef.current = null;
    useCheckoutStore.getState().setShouldPlaceOrderDirectly(false);
    setHasRunCheckoutPrompt(false);
  }, [setIsWaitingForQuickOrderConfirmation, hidePriceCheck]);

  const determinePhraseLanguage = useCallback((text: string): string => {
    const lowerText = text.toLowerCase();
    if (/[\u0C00-\u0C7F]/.test(lowerText)) return 'te';

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
    return 'en'; 
  }, []);

  useEffect(() => {
    if(pathname !== '/checkout') resetAllContext();
  }, [pathname, resetAllContext]);

  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const getVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) setSpeechSynthesisVoices(voices);
      };
      getVoices();
      window.speechSynthesis.onvoiceschanged = getVoices;
    }
  }, []);

  useEffect(() => {
    isEnabledRef.current = enabled;
    if (recognition) {
        if (enabled) {
            recognition.lang = 'en-IN';
            recognition.continuous = false;
            recognition.interimResults = false;
            try { recognition.start(); } catch (e) {}
        } else {
            recognition.onend = null;
            recognition.stop();
        }
    }
}, [enabled]);

 const speak = useCallback((textOrReply: any | string, lang: string, onEndCallback?: (() => void) | boolean) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (typeof onEndCallback === 'function') onEndCallback();
      return;
    }
    if (recognition) recognition.stop();

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
    }

    const onEnd = () => {
        isSpeakingRef.current = false;
        if (typeof onEndCallback === 'function') onEndCallback();
        if (isEnabledRef.current && recognition) {
            try { recognition.start(); } catch(e) {}
        }
    };

    if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.onended = onEnd;
        audio.play().catch(onEnd);
        return;
    }

    const replies = textToSpeak.split(',').map(r => r.trim());
    const text = replies[Math.floor(Math.random() * replies.length)];
    const utterance = new SpeechSynthesisUtterance(text);

    let voice = speechSynthesisVoices.find(v => v.lang.startsWith(targetLang) && v.name.includes('Google')) ||
                speechSynthesisVoices.find(v => v.lang.startsWith(targetLang)) ||
                speechSynthesisVoices.find(v => v.default);

    if (voice) utterance.voice = voice;
    utterance.onend = onEnd;
    window.speechSynthesis.speak(utterance);
  }, [speechSynthesisVoices]);

  const runCheckoutPrompt = useCallback(() => {
      if (pathname !== '/checkout' || !hasMounted || !enabled || hasRunCheckoutPrompt || isSpeakingRef.current) return;

      setTimeout(() => {
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
      }, 500);
  }, [pathname, hasMounted, enabled, isWaitingForQuickOrderConfirmation, hasRunCheckoutPrompt, cartItemsProp.length, language, speak, cartTotal, activeStoreId]);

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

    if (isMenuPage && localMenu) {
        let bestMatch: { menuItem: MenuItem, score: number } | null = null;
        for (const item of localMenu.items) {
            const similarity = calculateSimilarity(productPhrase.toLowerCase(), item.name.toLowerCase());
            if (!bestMatch || similarity > bestMatch.score) {
                if(similarity > 0.8) bestMatch = { menuItem: item, score: similarity };
            }
        }
        if (bestMatch) {
            const menuItem = bestMatch.menuItem;
            const virtualProduct: Product = {
                id: `${menuStoreId}-${menuItem.name.replace(/\s/g, '-')}`,
                name: menuItem.name,
                description: menuItem.description || '',
                storeId: menuStoreId!,
                category: menuItem.category,
                imageId: 'cat-restaurant',
                isMenuItem: true,
                price: menuItem.price
            };
            const virtualVariant: ProductVariant = {
                sku: `${menuStoreId}-${menuItem.name.replace(/\s/g, '-')}-default`,
                weight: '1 pc',
                price: menuItem.price,
                stock: 99,
            };
            return { product: virtualProduct, variant: virtualVariant, requestedQty: qty || 1, remainingPhrase: '', matchedAlias: menuItem.name, lang: language };
        }
    }

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

    if (!bestMatch) return { product: null, variant: null, requestedQty: qty, remainingPhrase: productPhrase, matchedAlias: null, lang: 'en' };

    const { product, lang: detectedLang, alias: matchedAlias } = bestMatch;
    const priceData = productPrices[product.name.toLowerCase()];
    if (!priceData?.variants?.length) return { product, variant: null, requestedQty: qty, remainingPhrase: productPhrase, matchedAlias, lang: detectedLang };
    
    let chosenVariant: ProductVariant | null = null;
    let finalQty = qty;

    if (money && money > 0) {
        const baseVariant = priceData.variants.find(v => v.weight.includes('kg')) || priceData.variants[0];
        const baseWeightStr = baseVariant.weight.match(/(\d+\.?\d*)/);
        const baseWeight = baseWeightStr ? parseFloat(baseWeightStr[0]) : 1;
        const pricePerGram = baseVariant.price / (baseWeight * 1000);
        const requestedGrams = money / pricePerGram;
        chosenVariant = { price: money, weight: `${Math.round(requestedGrams)}gm`, sku: `${baseVariant.sku}-custom-${money}`, stock: baseVariant.stock };
        finalQty = 1;
    } else if (unit) {
        let requestedAmount = qty;
        if (unit === 'l' || unit === 'kg') requestedAmount = qty * 1000;
        const baseVariant = priceData.variants.find(v => v.weight.includes('kg')) || priceData.variants[0];
        const baseWeightStr = baseVariant.weight.match(/(\d+\.?\d*)/);
        const baseWeight = baseWeightStr ? parseFloat(baseWeightStr[0]) : 1;
        const pricePerGram = baseVariant.price / (baseWeight * 1000);
        chosenVariant = { price: requestedAmount * pricePerGram, weight: `${Math.round(requestedAmount)}gm`, sku: `${baseVariant.sku}-custom-${requestedAmount}`, stock: baseVariant.stock };
        finalQty = 1;
    } else {
        chosenVariant = priceData.variants.find(v => parseFloat(v.weight) === finalQty) || priceData.variants[0];
    }
    return { product, variant: chosenVariant, requestedQty: finalQty, remainingPhrase: productPhrase, matchedAlias, lang: detectedLang };
}, [firestore, productPrices, universalProductAliasMap, language, isMenuPage, localMenu, menuStoreId]);

  const recognizeIntent = useCallback((text: string, spokenLang: string): Intent => {
    const lowerText = text.toLowerCase().trim();
    const nlu = runNLU(text, spokenLang);
    if (nlu.hasMath) return { type: 'MATH', originalText: text, lang: spokenLang };

    const fromKeywords = ['from', 'at', 'in'];
    const toKeywords = ['to', 'at'];
    const hasFrom = fromKeywords.some(kw => lowerText.includes(` ${kw} `));
    const hasTo = toKeywords.some(kw => lowerText.includes(` ${kw} `));

    if (intentKeywords.SMART_ORDER.some(kw => lowerText.startsWith(kw)) && hasFrom && hasTo) return { type: 'SMART_ORDER', originalText: text, lang: spokenLang };

    const priceKeyword = intentKeywords.CHECK_PRICE.find(kw => lowerText.includes(kw));
    if (priceKeyword) return { type: 'CHECK_PRICE', productPhrase: lowerText.replace(priceKeyword, '').trim(), originalText: text, lang: spokenLang };

    const removeKeyword = intentKeywords.REMOVE_ITEM.find(kw => lowerText.includes(kw));
    if (removeKeyword) return { type: 'REMOVE_ITEM', productPhrase: lowerText.replace(removeKeyword, '').trim(), originalText: text, lang: spokenLang };

    const detailsKeyword = intentKeywords.SHOW_DETAILS.find(kw => lowerText.includes(kw));
    if (detailsKeyword) return { type: 'SHOW_DETAILS', target: lowerText.replace(detailsKeyword, '').trim(), originalText: text, lang: spokenLang };

    const knowledgeKeyword = intentKeywords.GET_KNOWLEDGE.find(kw => lowerText.startsWith(kw));
    if (knowledgeKeyword) return { type: 'GET_KNOWLEDGE', topic: lowerText.substring(knowledgeKeyword.length).trim(), originalText: text, lang: spokenLang };

    const ashaKeyword = intentKeywords.ASK_ASHA.find(kw => lowerText.includes(kw));
    if (ashaKeyword) return { type: 'ASK_ASHA', originalText: text, lang: spokenLang };

    let bestCommandMatch: { key: string, similarity: number } | null = null;
    for (const key in commands) {
      const commandAliases = getAllAliases(key);
      for (const alias of Object.values(commandAliases).flat()) {
        const similarity = calculateSimilarity(lowerText, alias.toLowerCase());
        if (!bestCommandMatch || similarity > bestCommandMatch.similarity) {
          if (similarity > 0.8) bestCommandMatch = { key, similarity };
        }
      }
    }

    if (bestCommandMatch) {
      if (bestCommandMatch.key === 'get-recipe') {
          const recipeAliases = (getAllAliases('get-recipe')[spokenLang] || ['recipe for']);
          const keyword = recipeAliases.find(alias => lowerText.includes(alias));
          if(keyword) return { type: 'GET_RECIPE', dishName: lowerText.substring(lowerText.indexOf(keyword) + keyword.length).trim(), originalText: text, lang: spokenLang };
      }
      if (intentKeywords.NAVIGATE.some(kw => lowerText.includes(kw))) return { type: 'NAVIGATE', destination: bestCommandMatch.key, originalText: text, lang: spokenLang };
      return { type: 'CONVERSATIONAL', commandKey: bestCommandMatch.key, originalText: text, lang: spokenLang };
    }
    return { type: 'ORDER_ITEM', originalText: text, lang: spokenLang };
  }, [commands, getAllAliases, language]);

  const handleCommand = useCallback(async (commandText: string) => {
    if (lastTranscriptRef.current === commandText) return;
    lastTranscriptRef.current = commandText;

    let spokenLang = determinePhraseLanguage(commandText);
    const replyLang = spokenLang;
    const langWithRegion = replyLang === 'en' ? 'en-IN' : `${replyLang}-IN`;

    if (itemForPriceCheck.current) {
      const context = itemForPriceCheck.current;
      const lowerText = commandText.toLowerCase();
      let chosenVariant: ProductVariant | null = null;
      let requestedQty = 1;

      if (lowerText.includes('yes') || lowerText.includes('add') || lowerText.includes('sare')) {
          chosenVariant = context.variants[0];
      } else if (lowerText.includes('no') || lowerText.includes('cancel')) {
          speak("Okay, cancelled.", langWithRegion, false);
          resetAllContext();
          return;
      }

      if (chosenVariant) {
          addItemToCart({ ...context.product, isAiAssisted: true, matchedAlias: `Price check` }, chosenVariant, requestedQty || 1);
          onOpenCart();
          speak(commands['addItem']?.reply, langWithRegion);
      }
      resetAllContext();
      return;
    }

    if (isWaitingForAddressTypeRef.current) {
        const lowerCommand = commandText.toLowerCase();
        if (lowerCommand.includes('home') || lowerCommand.includes('house')) {
            isWaitingForAddressTypeRef.current = false;
            handleUseHomeAddress();
            speak(commands['homeAddress'].reply, langWithRegion, triggerVoicePrompt);
        } else if (lowerCommand.includes('current') || lowerCommand.includes('location')) {
            isWaitingForAddressTypeRef.current = false;
            handleUseCurrentLocation();
            speak(commands['currentLocation'].reply, langWithRegion, triggerVoicePrompt);
        }
        return;
    }

    const intent = recognizeIntent(commandText, spokenLang);
    switch (intent.type) {
        case 'ASK_ASHA': {
            const role = isAdmin ? 'admin' : (isRestaurantOwner ? 'owner' : 'customer');
            speak("Thinking...", langWithRegion, false);
            const reply = await chatWithAsha({
                history: [],
                message: commandText,
                role: role,
                storeId: activeStoreId || undefined
            });
            speak(reply, langWithRegion);
            break;
        }
        case 'NAVIGATE':
        case 'CONVERSATIONAL': {
            const key = intent.type === 'NAVIGATE' ? intent.destination : intent.commandKey;
            const action = commandActionsRef.current[key];
            const reply = commands[key]?.reply;
            if (reply) speak(reply, langWithRegion, () => action?.({ lang: intent.lang }));
            break;
        }
        case 'ORDER_ITEM': {
            const { product, variant, requestedQty, matchedAlias } = await findProductAndVariant(commandText);
            if (product && variant) {
                addItemToCart({ ...product, matchedAlias: matchedAlias || commandText, isAiAssisted: !!matchedAlias }, variant, requestedQty);
                onOpenCart();
                speak(commands['addItem']?.reply, langWithRegion);
            }
            break;
        }
    }
  }, [firestore, user, language, determinePhraseLanguage, speak, resetAllContext, findProductAndVariant, addItemToCart, onOpenCart, t, locales, commands, getAllAliases, recognizeIntent, aiConfig, handleUseHomeAddress, handleUseCurrentLocation, triggerVoicePrompt, setActiveStoreId, storeAliasMap, profileForm, router, stores, productPrices, showPriceCheck, hidePriceCheck, masterProducts, isAdmin, isRestaurantOwner, activeStoreId]);

  useEffect(() => {
    if (!recognition) return;
    recognition.onresult = (event) => {
      if (isSpeakingRef.current) return;
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      onStatusUpdate(`Processing: "${transcript}"`);
      handleCommand(transcript);
    };
    recognition.onend = () => {
      if (isEnabledRef.current && !isSpeakingRef.current) {
        setTimeout(() => { try { recognition?.start(); } catch (e) {} }, 300);
      }
    };

    commandActionsRef.current = {
      home: () => router.push('/'),
      stores: () => router.push('/stores'),
      cart: () => router.push('/cart'),
      orders: () => router.push('/dashboard/customer/my-orders'),
      myProfile: () => router.push('/dashboard/customer/my-profile'),
      checkout: () => { onCloseCart(); router.push('/checkout'); triggerVoicePrompt(); },
      installApp: onInstallApp,
    };
  }, [handleCommand, onStatusUpdate, router, onCloseCart, triggerVoicePrompt, onInstallApp]);

  return null;
}
