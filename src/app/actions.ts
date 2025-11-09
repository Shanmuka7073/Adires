
'use server';

import { revalidatePath } from 'next/cache';
import { getStores, getMasterProducts } from '@/lib/data';
import { firestore } from '@/firebase/admin-init'; // Import the initialized admin firestore instance
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
                    display: data.display || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                    reply: data.reply || `Executing ${key}...`
                };
            }
        });
    } catch (error) {
        console.error("Error fetching commands from Firestore:", error);
        // In case of error, return an empty object to avoid breaking the app layout
        return {};
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
        // Return empty object on failure to prevent breaking the layout
        return {}; 
    }
}

export async function saveCommands(commands: Record<string, CommandGroup>): Promise<{ success: boolean; }> {
    const batch = firestore.batch();
    const voiceAliasesRef = firestore.collection('voiceAliases');

    try {
        // Create a map to hold command data, keyed by the command key.
        const commandDataMap = new Map<string, { display: string, reply: string }>();
        for (const key in commands) {
            commandDataMap.set(key, commands[key]);
        }

        // Query for all existing command documents to update them or find their IDs.
        const existingCommandsSnap = await voiceAliasesRef.where('type', '==', 'command').get();
        const existingDocsByKey = new Map<string, { id: string, data: any }>();
        existingCommandsSnap.forEach(doc => {
            existingDocsByKey.set(doc.data().key, { id: doc.id, data: doc.data() });
        });

        for (const [key, data] of commandDataMap) {
            if (existingDocsByKey.has(key)) {
                // If command exists, update its display name and reply.
                const existingDoc = existingDocsByKey.get(key)!;
                const docRef = voiceAliasesRef.doc(existingDoc.id);
                // Only update if there's a change to avoid unnecessary writes.
                if (existingDoc.data.display !== data.display || existingDoc.data.reply !== data.reply) {
                    batch.update(docRef, { display: data.display, reply: data.reply });
                }
                // Mark this key as handled.
                existingDocsByKey.delete(key);
            } else {
                // If command is new, create a new document for it.
                const newDocRef = voiceAliasesRef.doc(); // Firestore will auto-generate an ID.
                batch.set(newDocRef, {
                    key: key,
                    type: 'command',
                    display: data.display,
                    reply: data.reply,
                    // Aliases are handled by saveLocales, but we create the command doc here.
                    language: 'en', // default language
                    alias: key.toLowerCase().replace(/_/g, ' ') // a default alias
                });
            }
        }

        // Any keys remaining in existingDocsByKey were deleted by the user.
        for (const [key, docInfo] of existingDocsByKey) {
            const docToDeleteRef = voiceAliasesRef.doc(docInfo.id);
            batch.delete(docToDeleteRef);
        }

        await batch.commit();
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
        const commandKeysQuery = await voiceAliasesRef.where('type', '==', 'command').get();
        const commandKeys = new Set(commandKeysQuery.docs.map(d => d.data().key));
        
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
                         // Determine type: check if it's a known command key, otherwise default to product.
                        const docData = await voiceAliasesRef.where('key', '==', key).limit(1).get();
                        const existingType = docData.empty ? (commandKeys.has(key) ? 'command' : 'product') : docData.docs[0].data().type;
                        
                        batch.set(newAliasRef, {
                            key,
                            language: lang,
                            alias: alias.toLowerCase(),
                            type: existingType,
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

        // Pass the admin firestore instance to the data functions
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
