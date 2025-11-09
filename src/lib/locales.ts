
import { getLocales as fetchAllLocales } from '@/app/actions';

type LocaleEntry = string | string[];
type Locales = Record<string, Record<string, LocaleEntry>>;

// This variable will act as a server-side cache.
let translations: Locales | null = null;

async function getTranslations(): Promise<Locales> {
    if (translations) {
        return translations;
    }
    // If not cached, fetch and then cache it.
    translations = await fetchAllLocales();
    return translations;
}

// Client-side synchronous translation function
// Note: This relies on the data being pre-fetched and available.
export function t(key: string, lang: string = 'en'): string {
    const allTranslations = translations;
    if (!allTranslations || Object.keys(allTranslations).length === 0) {
        return key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    const langCode = lang.split('-')[0];
    const entry = allTranslations[key as keyof typeof allTranslations];
    
    if (entry && entry[langCode]) {
        const regionalEntry = entry[langCode];
        // Return the first alias if it's an array
        return Array.isArray(regionalEntry) ? regionalEntry[0] : regionalEntry;
    }
    
    // Fallback for keys that might not be in the JSON, like dynamic product names
    return key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Client-side synchronous alias getter
export function getAllAliases(key: string): Record<string, string[]> {
    const allTranslations = translations;
    if (!allTranslations) return {};
    const entry = allTranslations[key as keyof typeof allTranslations];
    const result: Record<string, string[]> = {};

    if (entry) {
        for (const langCode in entry) {
            const langAliases = entry[langCode];
            result[langCode] = (Array.isArray(langAliases) ? langAliases : [langAliases]).filter(Boolean);
        }
    }
    
    return result;
}
