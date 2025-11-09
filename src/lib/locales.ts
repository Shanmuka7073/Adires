

'use client';
import type { VoiceAlias } from './types';
export type { VoiceAlias };

export type LocaleEntry = string | string[];
export type Locales = Record<string, Record<string, LocaleEntry>>;

let translations: Locales | null = null;

export function initializeTranslations(initialData: Locales) {
    if (!translations) {
        translations = initialData;
    }
}

// Client-side synchronous translation function
export function t(key: string, lang: string = 'en', type: 'display' | 'reply' | 'alias' = 'alias'): string {
    if (!translations) {
        return key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    const langCode = lang.split('-')[0];
    const entry = translations[key];
    
    // For 'display' or 'reply', we expect a single string.
    if (type === 'display' || type === 'reply') {
      return (entry?.[type] as string) || key.replace(/-/g, ' ');
    }

    // For 'alias', we check the specific language, then fallback to English.
    if (entry && entry[langCode]) {
        const regionalEntry = entry[langCode];
        return Array.isArray(regionalEntry) ? regionalEntry[0] : regionalEntry;
    }
    if (entry && entry['en']) {
        const fallbackEntry = entry['en'];
        return Array.isArray(fallbackEntry) ? fallbackEntry[0] : fallbackEntry;
    }
    
    return key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function getAllAliases(key: string): Record<string, string[]> {
    if (!translations) return {};
    const entry = translations[key];
    const result: Record<string, string[]> = {};

    if (entry) {
        for (const langCode in entry) {
             if (langCode === 'display' || langCode === 'reply') continue;
            const langAliases = entry[langCode];
            result[langCode] = (Array.isArray(langAliases) ? langAliases : [langAliases]).filter(Boolean);
        }
    }
    
    return result;
}

// This function is now only used for initializing the store from the fetched aliases.
export function buildLocalesFromAliases(aliases: VoiceAlias[]): Locales {
    const locales: Locales = {};
    aliases.forEach(aliasDoc => {
        if (!locales[aliasDoc.key]) {
            locales[aliasDoc.key] = {};
        }
        const langEntry = locales[aliasDoc.key][aliasDoc.language];
        if (Array.isArray(langEntry)) {
            langEntry.push(aliasDoc.alias);
        } else if (typeof langEntry === 'string') {
            locales[aliasDoc.key][aliasDoc.language] = [langEntry, aliasDoc.alias];
        } else {
            locales[aliasDoc.key][aliasDoc.language] = aliasDoc.alias;
        }
    });
    return locales;
}
