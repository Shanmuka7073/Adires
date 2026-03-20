'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import type { Store, CartItem, User, FailedVoiceCommand, ProductVariant, SiteConfig, MenuItem, Menu, Product } from '@/lib/types';
import { calculateSimilarity } from '@/lib/calculate-similarity';
import { useCart } from '@/lib/cart';
import { useAppStore, useProfileFormStore, useMyStorePageStore, type ProfileFormValues } from '@/lib/store';
import { t } from '@/lib/locales';
import { doc, serverTimestamp, addDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useCheckoutStore } from '@/lib/checkout-store';
import { useVoiceCommanderContext } from './voice-commander-context';
import { getIngredientsForDish } from '@/app/actions';
import { runNLU, extractQuantityAndProduct } from '@/lib/nlu/voice-integration';
import { useAdminAuth } from '@/hooks/use-admin-auth';

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

type Intent =
  | { type: 'SMART_ORDER', originalText: string, lang: string }
  | { type: 'CHECK_PRICE', productPhrase: string, originalText: string, lang: string }
  | { type: 'ORDER_ITEM', originalText: string, lang: string }
  | { type: 'REMOVE_ITEM', productPhrase: string, originalText: string, lang: string }
  | { type: 'NAVIGATE', destination: string, originalText: string, lang: string }
  | { type: 'CONVERSATIONAL', commandKey: string, originalText: string, lang: string }
  | { type: 'GET_RECIPE', dishName: string, originalText: string, lang: string }
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
  MATH: ['+', '-', '*', '/', 'plus', 'minus', 'times', 'divided by'],
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
  const { hidePriceCheck } = useVoiceCommanderContext();
  const { isRestaurantOwner, isAdmin } = useAdminAuth();

  const { stores, language, getAllAliases, locales, commands } = useAppStore();

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
  const itemForPriceCheck = useRef<any | null>(null);
  const lastTranscriptRef = useRef<string>('');

  const userProfileRef = useRef<User | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [speechSynthesisVoices, setSpeechSynthesisVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [hasRunCheckoutPrompt, setHasRunCheckoutPrompt] = useState(false);

  // Business Focus: We fetch the current menu locally if on a menu page
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

  const storeAliasMap = useMemo(() => {
    const map = new Map<string, Store>();
    if (!stores) return map;

    for (const s of stores) {
      const aliases = [
        s.name.toLowerCase(),
        ...(s.teluguName ? [s.teluguName.toLowerCase()] : []),
      ];
      for (const term of [...new Set(aliases)]) {
         if (term) {
            map.set(term, s);
            map.set(term.replace(/\s/g, ''), { ...s });
        }
      }
    }
    return map;
  }, [stores]);

  const resetAllContext = useCallback(() => {
    itemForPriceCheck.current = null;
    hidePriceCheck();
    isWaitingForStoreNameRef.current = false;
    isWaitingForAddressTypeRef.current = false;
    setIsWaitingForQuickOrderConfirmation(false);
    formFieldToFillRef.current = null;
    useCheckoutStore.getState().setShouldPlaceOrderDirectly(false);
    setHasRunCheckoutPrompt(false);
  }, [setIsWaitingForQuickOrderConfirmation, hidePriceCheck]);

  const determinePhraseLanguage = useCallback((text: string): string => {
    const lowerText = text.toLowerCase();
    if (/[\u0C00-\u0C7F]/.test(lowerText)) return 'te';
    if (['naku', 'kavali', 'dhara'].some(kw => lowerText.includes(kw))) return 'te';
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

  const findMenuItem = useCallback((phrase: string): { product: Product, variant: ProductVariant, qty: number } | null => {
      if (!isMenuPage || !localMenu) return null;
      
      const nlu = runNLU(phrase, language);
      const { qty, productPhrase } = extractQuantityAndProduct(nlu);
      const search = productPhrase.toLowerCase().trim();

      let bestMatch: { item: MenuItem, score: number } | null = null;
      for (const item of localMenu.items) {
          const score = calculateSimilarity(search, item.name.toLowerCase());
          if (score > 0.8 && (!bestMatch || score > bestMatch.score)) {
              bestMatch = { item, score };
          }
      }

      if (bestMatch) {
          const it = bestMatch.item;
          return {
              product: { id: it.id, name: it.name, storeId: menuStoreId!, imageId: 'cat-restaurant', isMenuItem: true, price: it.price, description: it.description || '' },
              variant: { sku: `${it.id}-default`, weight: '1 pc', price: it.price, stock: 999 },
              qty: qty || 1
          };
      }
      return null;
  }, [isMenuPage, localMenu, language, menuStoreId]);

  const recognizeIntent = useCallback((text: string, spokenLang: string): Intent => {
    const lowerText = text.toLowerCase().trim();

    for (const key in commands) {
      const aliases = getAllAliases(key);
      for (const alias of Object.values(aliases).flat()) {
        if (calculateSimilarity(lowerText, alias.toLowerCase()) > 0.8) return { type: 'CONVERSATIONAL', commandKey: key, originalText: text, lang: spokenLang };
      }
    }
    return { type: 'ORDER_ITEM', originalText: text, lang: spokenLang };
  }, [commands, getAllAliases]);

  const handleCommand = useCallback(async (commandText: string) => {
    if (lastTranscriptRef.current === commandText) return;
    lastTranscriptRef.current = commandText;

    let spokenLang = determinePhraseLanguage(commandText);
    const langWithRegion = `${spokenLang}-IN`;

    const intent = recognizeIntent(commandText, spokenLang);
    switch (intent.type) {
        case 'CONVERSATIONAL': {
            const action = commandActionsRef.current[intent.commandKey];
            const reply = commands[intent.commandKey]?.reply;
            if (reply) speak(reply, langWithRegion, () => action?.({ lang: intent.lang }));
            break;
        }
        case 'ORDER_ITEM': {
            const match = findMenuItem(commandText);
            if (match) {
                addItemToCart(match.product, match.variant, match.qty);
                onOpenCart();
                speak(commands['addItem']?.reply, langWithRegion);
            }
            break;
        }
    }
  }, [determinePhraseLanguage, recognizeIntent, speak, findMenuItem, addItemToCart, onOpenCart, commands]);

  useEffect(() => {
    if (!recognition) return;
    recognition.onresult = (e) => { if (!isSpeakingRef.current) handleCommand(e.results[e.results.length - 1][0].transcript.trim()); };
    recognition.onend = () => { if (isEnabledRef.current && !isSpeakingRef.current) setTimeout(() => { try { recognition?.start(); } catch(e){} }, 300); };
    commandActionsRef.current = {
      home: () => router.push('/'),
      stores: () => router.push('/stores'),
      cart: () => router.push('/cart'),
      orders: () => router.push('/dashboard/customer/my-orders'),
      myProfile: () => router.push('/dashboard/customer/my-profile'),
      installApp: onInstallApp,
    };
  }, [handleCommand, router, onInstallApp]);

  return null;
}
