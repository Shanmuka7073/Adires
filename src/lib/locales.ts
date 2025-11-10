

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
export function t(key: string, lang: string = 'en', type: 'alias' | 'display' | 'reply' = 'alias'): string {
    if (!translations) {
        // Fallback for when translations are not yet loaded
        return key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    const entry = translations[key];
    if (!entry) {
        return key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // For 'display' or 'reply', we expect a single string under that specific key.
    if (type === 'display' || type === 'reply') {
      return (entry[type] as string) || key.replace(/-/g, ' ');
    }

    // For 'alias', we check the specific language, then fallback to English.
    const langCode = lang.split('-')[0];
    const regionalEntry = entry[langCode];
    if (regionalEntry) {
        return Array.isArray(regionalEntry) ? regionalEntry[0] : regionalEntry;
    }
    
    const fallbackEntry = entry['en'];
    if (fallbackEntry) {
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
        // Exclude display/reply from the main alias structure
        if (aliasDoc.language === 'display' || aliasDoc.language === 'reply') {
            return;
        }

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
