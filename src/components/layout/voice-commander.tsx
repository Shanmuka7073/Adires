
'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import type { Store, CartItem, User, ProductVariant, Menu, Product, MenuItem } from '@/lib/types';
import { calculateSimilarity } from '@/lib/calculate-similarity';
import { useCart } from '@/lib/cart';
import { useAppStore, useProfileFormStore, useMyStorePageStore, type ProfileFormValues } from '@/lib/store';
import { t } from '@/lib/locales';
import { doc, serverTimestamp, addDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useCheckoutStore } from '@/lib/checkout-store';
import { useVoiceCommanderContext } from './voice-commander-context';
import { getIngredientsForDish } from '@/app/actions';
import { runNLU, extractQuantityAndProduct } from '@/lib/nlu/voice-integration';

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
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  recognition = new SpeechRecognition();
}

type Intent =
  | { type: 'NAVIGATE', destination: string, originalText: string, lang: string }
  | { type: 'CONVERSATIONAL', commandKey: string, originalText: string, lang: string }
  | { type: 'ORDER_ITEM', originalText: string, lang: string }
  | { type: 'UNKNOWN', originalText: string, lang: string };

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
  const { addItem: addItemToCart, activeStoreId, setActiveStoreId, cartTotal } = useCart();
  const { hidePriceCheck } = useVoiceCommanderContext();

  const { stores, language, getAllAliases, locales, commands } = useAppStore();

  const isSpeakingRef = useRef(false);
  const isEnabledRef = useRef(enabled);
  const commandActionsRef = useRef<any>({});
  const lastTranscriptRef = useRef<string>('');

  const [hasMounted, setHasMounted] = useState(false);
  const [speechSynthesisVoices, setSpeechSynthesisVoices] = useState<SpeechSynthesisVoice[]>([]);

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

  const determinePhraseLanguage = useCallback((text: string): string => {
    const lowerText = text.toLowerCase();
    if (/[\u0C00-\u0C7F]/.test(lowerText)) return 'te';
    return 'en'; 
  }, []);

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

    if (typeof textOrReply === 'object' && textOrReply !== null) {
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

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    let voice = speechSynthesisVoices.find(v => v.lang.startsWith(targetLang)) || speechSynthesisVoices.find(v => v.default);
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

  const handleCommand = useCallback(async (commandText: string) => {
    if (lastTranscriptRef.current === commandText) return;
    lastTranscriptRef.current = commandText;

    let spokenLang = determinePhraseLanguage(commandText);
    const langWithRegion = `${spokenLang}-IN`;

    const match = findMenuItem(commandText);
    if (match) {
        addItemToCart(match.product, match.variant, match.qty);
        onOpenCart();
        speak("Added to your order.", langWithRegion);
    } else {
        const lowerText = commandText.toLowerCase();
        if (lowerText.includes('home')) router.push('/');
        else if (lowerText.includes('cart')) router.push('/cart');
        else if (lowerText.includes('order')) router.push('/dashboard/customer/my-orders');
    }
  }, [determinePhraseLanguage, speak, findMenuItem, addItemToCart, onOpenCart, router]);

  useEffect(() => {
    if (!recognition) return;
    recognition.onresult = (e) => { if (!isSpeakingRef.current) handleCommand(e.results[e.results.length - 1][0].transcript.trim()); };
    recognition.onend = () => { if (isEnabledRef.current && !isSpeakingRef.current) setTimeout(() => { try { recognition?.start(); } catch(e){} }, 300); };
  }, [handleCommand]);

  return null;
}
