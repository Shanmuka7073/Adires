

'use client';

// This new version no longer uses server actions.
// It will be powered by client-side Firestore queries.

export type LocaleEntry = string | string[];
export type Locales = Record<string, Record<string, LocaleEntry>>;

// This variable will act as a client-side cache.
let translations: Locales | null = null;

// Function to initialize or refresh the translations cache on the client.
export function initializeTranslations(initialData: Locales) {
    if (!translations) {
        translations = initialData;
    }
}

// Client-side synchronous translation function
export function t(key: string, lang: string = 'en'): string {
    if (!translations) {
        // Fallback for when translations aren't loaded yet.
        return key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    const langCode = lang.split('-')[0];
    const entry = translations[key];
    
    if (entry && entry[langCode]) {
        const regionalEntry = entry[langCode];
        return Array.isArray(regionalEntry) ? regionalEntry[0] : regionalEntry;
    }
     if (entry && entry['en']) {
        const fallbackEntry = entry['en'];
        return Array.isArray(fallbackEntry) ? fallbackEntry[0] : fallbackEntry;
    }
    
    // Fallback for keys that might not be in the JSON, like dynamic product names
    return key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Client-side synchronous alias getter
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

// loadLocales is no longer needed as data is fetched directly in components.
export async function loadLocales() {
    return translations;
}
