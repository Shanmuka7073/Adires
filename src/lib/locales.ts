
'use client';
import type { VoiceAliasGroup } from './types';

export type LocaleEntry = string | string[];
export type Locales = Record<string, VoiceAliasGroup>;

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'en': {
      'should-i-deliver-to-home-or-current-speech': "Should I deliver to home or use your current location?",
      'your-cart-is-empty-speech': "Your cart is empty.",
      'okay-ordering-from-speech': "Okay, ordering from {storeName}.",
      'placing-your-order-now-speech': "Placing your order now.",
      'proceeding-to-checkout-speech': "Your total is {total}. Opening checkout.",
      'sorry-i-didnt-understand-that': "I didn't understand that.",
      'adding-item-speech': "Okay, added to your cart.",
  },
  'te': {
      'should-i-deliver-to-home-or-current-speech': "డెలివరీని మీ ఇంటి చిరునామాకు సెట్ చేయాలా లేదా మీ ప్రస్తుత స్థానాన్ని ఉపయోగించాలా?",
      'your-cart-is-empty-speech': "మీ కార్ట్ ఖాళీగా ఉంది.",
      'okay-ordering-from-speech': "సరే, {storeName} నుండి ఆర్డర్ చేస్తున్నాను.",
      'placing-your-order-now-speech': "మీ ఆర్డర్‌ను ఇప్పుడు ప్లేస్ చేస్తున్నాను.",
      'sorry-i-didnt-understand-that': "క్షమించండి, నాకు అది అర్థం కాలేదు.",
  },
};

let combinedLocales: Locales = {};

export function initializeTranslations(locales: Locales) {
    combinedLocales = locales;
}

export function t(key: string, lang: string = 'en', type: 'alias' | 'display' | 'reply' = 'alias'): string {
    const langCode = lang.split('-')[0];
    const staticTranslation = TRANSLATIONS[langCode]?.[key];
    if (staticTranslation) return staticTranslation;

    const entry = combinedLocales[key];
    if (!entry) return key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    if (type === 'display' || type === 'reply') return (entry as any)[type] || key.replace(/-/g, ' ');

    const regionalEntry = entry[langCode];
    if (regionalEntry) return Array.isArray(regionalEntry) ? regionalEntry[0] : regionalEntry;
    
    const fallbackEntry = entry['en'];
    if (fallbackEntry) return Array.isArray(fallbackEntry) ? fallbackEntry[0] : fallbackEntry;
    
    return key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function getAllAliases(locales: Locales, key: string): Record<string, string[]> {
    if (!locales) return {};
    const entry = locales[key];
    const result: Record<string, string[]> = {};
    if (entry) {
        for (const langCode in entry) {
            if (['display', 'reply', 'type', 'id'].includes(langCode)) continue;
            const val = entry[langCode];
            result[langCode] = (Array.isArray(val) ? val : [val]).filter(Boolean);
        }
    }
    return result;
}

export function buildLocalesFromAliasGroups(groups: VoiceAliasGroup[]): Locales {
    const locales: Locales = {};
    groups.forEach(group => { if (group.id) locales[group.id] = group; });
    return locales;
}
