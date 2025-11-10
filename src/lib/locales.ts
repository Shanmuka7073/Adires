

'use client';
import type { VoiceAlias } from './types';
export type { VoiceAlias };

export type LocaleEntry = string | string[];
export type Locales = Record<string, Record<string, LocaleEntry>>;

// This is a simplified, placeholder translation store.
// In a real app, this would be managed by a proper i18n library.
const TRANSLATIONS: Record<string, Record<string, string>> = {
  'en': {
      'should-i-deliver-to-home-or-current-speech': "Should I set the delivery for your saved home address or use your current location?",
      'your-cart-is-empty-speech': "Your cart is empty. Please add some items before checking out.",
      'which-store-should-fulfill-speech': "Which store should fulfill this order?",
      'finalConfirmPrompt': "Your total is {total}. Shall I place the order?",
      'okay-ordering-from-speech': "Okay, ordering from {storeName}.",
      'could-not-find-store-speech': "I'm sorry, I couldn't find a store named {storeName}. Please try again.",
      'did-not-understand-address-type-speech': "I'm sorry, I didn't understand. Please say 'home address' or 'current location'.",
      'setting-delivery-to-home-speech': "Okay, I've set the delivery to your saved home address.",
      'using-current-location-speech': "Okay, using your current location for delivery.",
      'placing-your-order-now-speech': "Placing your order now.",
      'no-changes-to-save-speech': "I don't see any changes to save on this page.",
      'im-ready-for-order-speech': "I'm ready. Please list the items you want to order.",
      'cannot-create-order-no-profile-speech': "I can't create a voice order because your profile is incomplete. Please add your address first.",
      'sent-list-to-stores-speech': "Great. I've sent your list to the stores. You can view it in your 'My Orders' page.",
      'failed-to-create-voice-order-speech': "I'm sorry, there was an error creating your voice order. Please try again.",
      'proceeding-to-checkout-speech': "Your total is {total}. Proceeding to checkout.",
      'sorry-i-didnt-understand-that': "I'm sorry, I didn't understand that. Can you please rephrase?",
      'no-price-found-speech': "I'm sorry, I couldn't find a price for {productName}.",
      'could-not-find-item-speech': "I'm sorry, I couldn't find an item called {itemName}.",
      'adding-item-speech': "Okay, I've added {quantity} {weight} of {productName} to your cart.",
      'ive-added-to-your-cart': "I've added {items} to your cart",
      'but-i-couldnt-find': "but I couldn't find {items}",
      'sorry-i-couldnt-find-any-items': "I'm sorry, I couldn't find any of the items you mentioned.",
      'could-not-find-product-in-order-speech': "I'm sorry, I couldn't identify a product in your order. Please try again, for example, 'order 1kg of onions'.",
      'could-not-identify-store-speech': "I found your items, but couldn't identify the store. Please select a store to continue.",
      'cannot-deliver-home-no-address-speech': "I can't deliver to your home because you haven't saved an address. I'm taking you to your profile page to add one.",
      'preparing-order-speech': "Okay, preparing an order for {items} from {storeName}. I'm taking you to the checkout page to confirm.",
      'price-check-reply-speech': "The price for {productName} is {prices}.",
      'price-check-variant-speech': "{weight} for {price}",
  },
  'te': {
      'should-i-deliver-to-home-or-current-speech': "డెలివరీని మీ ఇంటి చిరునామాకు సెట్ చేయాలా లేదా మీ ప్రస్తుత స్థానాన్ని ఉపయోగించాలా?",
      'your-cart-is-empty-speech': "మీ కార్ట్ ఖాళీగా ఉంది. దయచేసి చెక్అవుట్ చేయడానికి ముందు కొన్ని వస్తువులను జోడించండి.",
      'which-store-should-fulfill-speech': "ఈ ఆర్డర్‌ను ఏ స్టోర్ నుండి పంపాలి?",
      'finalConfirmPrompt': "మీ మొత్తం {total}. నేను ఆర్డర్ చేయాలా?",
      'okay-ordering-from-speech': "సరే, {storeName} నుండి ఆర్డర్ చేస్తున్నాను.",
      'could-not-find-store-speech': "క్షమించండి, {storeName} అనే స్టోర్ నాకు కనబడలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.",
      'did-not-understand-address-type-speech': "క్షమించండి, నాకు అర్థం కాలేదు. దయచేసి 'ఇంటి చిరునామా' లేదా 'ప్రస్తుత స్థానం' అని చెప్పండి.",
      'setting-delivery-to-home-speech': "సరే, నేను డెలివరీని మీ ఇంటి చిరునామాకు సెట్ చేశాను.",
      'using-current-location-speech': "సరే, డెలివరీ కోసం మీ ప్రస్తుత స్థానాన్ని ఉపయోగిస్తున్నాను.",
      'placing-your-order-now-speech': "మీ ఆర్డర్‌ను ఇప్పుడు ప్లేస్ చేస్తున్నాను.",
      'no-changes-to-save-speech': "ఈ పేజీలో సేవ్ చేయడానికి ఎలాంటి మార్పులు కనబడలేదు.",
      'im-ready-for-order-speech': "నేను సిద్ధంగా ఉన్నాను. దయచేసి మీరు ఆర్డర్ చేయాలనుకుంటున్న వస్తువుల జాబితాను చెప్పండి.",
      'cannot-create-order-no-profile-speech': "మీ ప్రొఫైల్ అసంపూర్ణంగా ఉన్నందున నేను వాయిస్ ఆర్డర్ உருவாக்கలేను. దయచేసి ముందుగా మీ చిరునామాను జోడించండి.",
      'sent-list-to-stores-speech': "చాలా మంచిది. నేను మీ జాబితాను స్టోర్లకు పంపాను. మీరు దానిని మీ 'My Orders' పేజీలో చూడవచ్చు.",
      'failed-to-create-voice-order-speech': "క్షమించండి, మీ వాయిస్ ఆర్డర్ உருவாக்கడంలో లోపం ஏற்பட்டது. దయచేసి మళ్లీ ప్రయత్నించండి.",
      'proceeding-to-checkout-speech': "మీ మొత్తం {total}. చెక్అవుట్‌కు కొనసాగుతున్నాను.",
      'sorry-i-didnt-understand-that': "క్షమించండి, నాకు అది అర్థం కాలేదు. దయచేసి మళ్ళీ చెప్పగలరా?",
      'no-price-found-speech': "{productName} కోసం నాకు ధర కనుగొనబడలేదు.",
      'could-not-find-item-speech': "{itemName} అనే వస్తువును నేను కనుగొనలేకపోయాను.",
      'adding-item-speech': "సరే, నేను మీ కార్ట్‌కి {quantity} {weight} {productName} జోడించాను.",
      'ive-added-to-your-cart': "నేను మీ కార్ట్‌కు {items} జోడించాను",
      'but-i-couldnt-find': "కానీ నేను {items} కనుగొనలేకపోయాను",
      'sorry-i-couldnt-find-any-items': "క్షమించండి, మీరు చెప్పిన వస్తువులలో ఏదీ నేను కనుగొనలేకపోయాను.",
      'could-not-find-product-in-order-speech': "క్షమించండి, మీ ఆర్డర్‌లో నేను ఉత్పత్తిని గుర్తించలేకపోయాను. దయచేసి మళ్లీ ప్రయత్నించండి, ఉదాహరణకు '1kg ఉల్లిపాయలు ఆర్డర్ చేయండి'.",
      'could-not-identify-store-speech': "నేను మీ వస్తువులను కనుగొన్నాను, కానీ స్టోర్‌ను గుర్తించలేకపోయాను. కొనసాగించడానికి దయచేసి ఒక స్టోర్‌ను ఎంచుకోండి.",
      'cannot-deliver-home-no-address-speech': "మీరు చిరునామాను சேవ్ చేయనందున నేను మీ ఇంటికి డెలివరీ చేయలేను. ఒకటి జోడించడానికి నేను మిమ్మల్ని మీ ప్రొఫైల్ పేజీకి తీసుకెళ్తున్నాను.",
      'preparing-order-speech': "{storeName} నుండి {items} కోసం ఆర్డర్‌ను సిద్ధం చేస్తున్నాను. உறுதிப்படுத்தడానికి నేను మిమ్మల్ని చెక్అவுట్ పేజీకి తీసుకెళ్తున్నాను.",
      'price-check-reply-speech': "{productName} ధర {prices}.",
      'price-check-variant-speech': "{weight} కి {price}",
  },
};

let aliasTranslations: Locales | null = null;

export function initializeTranslations(initialData: Locales) {
    if (!aliasTranslations) {
        aliasTranslations = initialData;
    }
}

// Client-side synchronous translation function
export function t(key: string, lang: string = 'en', type: 'alias' | 'display' | 'reply' = 'alias'): string {
    // First, try the static translations for core UI/speech text
    const langCode = lang.split('-')[0];
    const staticTranslation = TRANSLATIONS[langCode]?.[key];
    if (staticTranslation) {
        return staticTranslation;
    }

    // If not found, try the dynamic alias translations from the database
    if (!aliasTranslations) {
        // Fallback for when translations are not yet loaded
        return key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    const entry = aliasTranslations[key];
    if (!entry) {
        return key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // For 'display' or 'reply', we expect a single string under that specific key.
    if (type === 'display' || type === 'reply') {
      return (entry[type] as string) || key.replace(/-/g, ' ');
    }

    // For 'alias', we check the specific language, then fallback to English.
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
    if (!aliasTranslations) return {};
    const entry = aliasTranslations[key];
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
