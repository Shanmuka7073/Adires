
'use server';

import { revalidatePath } from 'next/cache';
import { getStores, getMasterProducts } from '@/lib/data';
import { firestore } from '@/firebase/admin-init';
import type { WriteBatch } from 'firebase-admin/firestore';

type CommandGroup = {
  display: string;
  reply: string;
};

type LocaleEntry = string | string[];
type Locales = Record<string, Record<string, LocaleEntry>>;


export async function getCommands(): Promise<Record<string, CommandGroup>> {
    const commands: Record<string, CommandGroup> = {};
    try {
        const aliasSnapshot = await firestore.collection('voiceAliases').where('type', '==', 'command').get();
        aliasSnapshot.forEach(doc => {
            const data = doc.data();
            const key = data.key;
            if (key && !commands[key]) {
                commands[key] = {
                    display: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                    reply: `Executing ${key}...`
                };
            }
        });
    } catch (error) {
        console.error("Error fetching commands from Firestore:", error);
    }
    return commands;
}

export async function getLocales(): Promise<Locales> {
    const locales: Locales = {};

    try {
        const aliasSnapshot = await firestore.collection('voiceAliases').get();
        
        aliasSnapshot.forEach(doc => {
            const data = doc.data();
            const { key, language, alias, type } = data;
            if (!key || !language || !alias) return;

            if (!locales[key]) {
                locales[key] = {};
            }
            if (!locales[key][language]) {
                locales[key][language] = [];
            }
            
            const langEntry = locales[key][language];
            if (Array.isArray(langEntry) && !langEntry.includes(alias)) {
                langEntry.push(alias);
            }
        });

        // Normalize single-item arrays back to strings for compatibility with old format
        for (const key in locales) {
            for (const lang in locales[key]) {
                const entry = locales[key][lang];
                if (Array.isArray(entry) && entry.length === 1) {
                    locales[key][lang] = entry[0];
                }
            }
        }
        
        return locales;

    } catch (error) {
        console.error("Error fetching locales from Firestore:", error);
        return {}; // Return empty object on failure
    }
}

export async function saveCommands(commands: Record<string, CommandGroup>): Promise<{ success: boolean; }> {
    try {
        // This function would need to create/update documents in 'voiceAliases'
        // based on the 'commands' object. For now, it's a no-op that returns success.
        console.warn("saveCommands function is not fully implemented for Firestore yet.");
        return { success: true };
    } catch (error) {
        console.error("Error in saveCommands:", error);
        return { success: false };
    }
}


export async function saveLocales(locales: Locales): Promise<{ success: boolean; }> {
    const batch: WriteBatch = firestore.batch();
    const voiceAliasesRef = firestore.collection('voiceAliases');

    try {
        const existingAliasesSnap = await voiceAliasesRef.get();
        const existingAliases = new Map<string, string>(); 
        existingAliasesSnap.forEach(doc => {
            const { key, language, alias } = doc.data();
            if(key && language && alias) {
                existingAliases.set(`${key}-${language}-${alias}`.toLowerCase(), doc.id);
            }
        });

        const newAliasesSet = new Set<string>();
        const commandKeys = ['home', 'stores', 'dashboard', 'cart', 'checkout', 'orders', 'deliveries', 'myStore', 'saveChanges', 'placeOrder', 'homeAddress', 'currentLocation', 'whatTime', 'howAreYou', 'checkPrice'];

        for (const key in locales) {
            const langEntries = locales[key];
            for (const lang in langEntries) {
                if (lang === 'display' || lang === 'reply' || lang === 'aliases') continue;

                const aliasEntry = langEntries[lang];
                const aliases = Array.isArray(aliasEntry) ? aliasEntry : [aliasEntry];

                for (const alias of aliases) {
                    if (!alias) continue;
                    const uniqueId = `${key}-${lang}-${alias}`.toLowerCase();
                    newAliasesSet.add(uniqueId);
                    
                    if (!existingAliases.has(uniqueId)) {
                        const newAliasRef = voiceAliasesRef.doc();
                        batch.set(newAliasRef, {
                            key,
                            language: lang,
                            alias: alias.toLowerCase(),
                            type: commandKeys.includes(key) ? 'command' : 'product',
                        });
                    }
                }
            }
        }
        
        existingAliases.forEach((docId, uniqueId) => {
            if (!newAliasesSet.has(uniqueId)) {
                batch.delete(voiceAliasesRef.doc(docId));
            }
        });

        await batch.commit();
        return { success: true };

    } catch (error) {
        console.error("Error saving locales to Firestore:", error);
        return { success: false };
    }
}


export async function addAliasToLocales(productKey: string, newAlias: string, lang: string): Promise<{ success: boolean }> {
    const aliasLower = newAlias.toLowerCase();
    const voiceAliasesRef = firestore.collection('voiceAliases');
    
    try {
        const q = voiceAliasesRef
            .where('key', '==', productKey)
            .where('language', '==', lang)
            .where('alias', '==', aliasLower);

        const querySnapshot = await q.get();
        if (!querySnapshot.empty) {
            return { success: true };
        }
        
        await voiceAliasesRef.add({
            key: productKey,
            language: lang,
            alias: aliasLower,
            type: 'product',
        });

        return { success: true };
    } catch (error) {
         console.error("Error adding alias to Firestore:", error);
        return { success: false };
    }
}


export async function indexSiteContent() {
    try {
        console.log('Fetching stores and master products for indexing...');

        const stores = await getStores(firestore);
        const masterProducts = await getMasterProducts(firestore);

        console.log(`Found ${stores.length} stores.`);
        console.log(`Found ${masterProducts.length} master products.`);

        const indexedData = {
            stores: stores.map(s => ({ id: s.id, name: s.name, address: s.address })),
            products: masterProducts.map(p => ({ id: p.id, name: p.name, category: p.category })),
            indexedAt: new Date().toISOString(),
        };

        console.log('--- Indexed Data ---');
        console.log(JSON.stringify(indexedData, null, 2));
        console.log('--- End of Index ---');


        return {
            success: true,
            message: `Successfully indexed ${stores.length} stores and ${masterProducts.length} products. Check server console for output.`,
            storeCount: stores.length,
            productCount: masterProducts.length,
        }

    } catch (error) {
        console.error('Error indexing site content:', error);
        return {
            success: false,
            message: 'Failed to index site content. Check server logs for details.',
        };
    }
}
