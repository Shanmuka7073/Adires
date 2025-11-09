

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
        // Query for documents that are commands and have a 'display' field.
        // This implicitly filters for the "primary" document of each command key.
        const aliasSnapshot = await firestore.collection('voiceAliases')
            .where('type', '==', 'command')
            .get();

        aliasSnapshot.forEach(doc => {
            const data = doc.data();
            const key = data.key;
            // Only add if it has a display property and we haven't already processed this key.
            if (key && data.display && !commands[key]) {
                commands[key] = {
                    display: data.display,
                    reply: data.reply || `Executing ${key}...`
                };
            }
        });
    } catch (error) {
        console.error("Error fetching commands from Firestore:", error);
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
            const { key, language, alias } = data;
            
            if (!key || !language || !alias) return;

            // Initialize the key entry if it doesn't exist.
            if (!locales[key]) {
                locales[key] = {};
            }

            // Initialize the language array if it doesn't exist.
            if (!locales[key][language]) {
                locales[key][language] = [];
            }
            
            const langEntry = locales[key][language];
            // Push the new alias if it's not already in the array.
            if (Array.isArray(langEntry) && !langEntry.includes(alias)) {
                langEntry.push(alias);
            }
        });

        // After grouping, normalize single-item arrays back to strings for compatibility.
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
        return {}; 
    }
}

export async function saveCommands(commands: Record<string, CommandGroup>): Promise<{ success: boolean; }> {
    const batch = firestore.batch();
    const voiceAliasesRef = firestore.collection('voiceAliases');

    try {
        // Create a map from the incoming command data.
        const commandDataMap = new Map<string, { display: string, reply: string }>();
        for (const key in commands) {
            commandDataMap.set(key, commands[key]);
        }

        // Query for all existing command documents.
        const existingCommandsSnap = await voiceAliasesRef.where('type', '==', 'command').get();
        const existingDocsByKey = new Map<string, { id: string, data: any }>();
        
        // Find the primary document for each key (the one with the 'display' field).
        existingCommandsSnap.forEach(doc => {
            const docData = doc.data();
            if (docData.key && docData.display) { // A primary doc must have a display name
               if (!existingDocsByKey.has(docData.key)) {
                  existingDocsByKey.set(docData.key, { id: doc.id, data: docData });
               }
            }
        });

        for (const [key, data] of commandDataMap) {
            if (existingDocsByKey.has(key)) {
                // If command key exists, update its display name and reply on the primary doc.
                const existingDoc = existingDocsByKey.get(key)!;
                const docRef = voiceAliasesRef.doc(existingDoc.id);

                const updateData: any = {};
                if (existingDoc.data.display !== data.display) updateData.display = data.display;
                if (existingDoc.data.reply !== data.reply) updateData.reply = data.reply;
                
                if (Object.keys(updateData).length > 0) {
                    batch.update(docRef, updateData);
                }
            } else {
                // If command is new, create a new primary document for it.
                const newDocRef = voiceAliasesRef.doc(); // Firestore will auto-generate an ID.
                batch.set(newDocRef, {
                    key: key,
                    type: 'command',
                    display: data.display,
                    reply: data.reply,
                    language: 'en', // default language for the primary doc
                    alias: key.toLowerCase().replace(/_/g, ' ') // a default alias
                });
            }
        }
        
        // Find which keys were deleted by the user.
        const keysToDelete = new Set<string>();
        existingDocsByKey.forEach((value, key) => {
            if (!commandDataMap.has(key)) {
                keysToDelete.add(key);
            }
        });

        if (keysToDelete.size > 0) {
            // We need to fetch ALL documents for the keys to be deleted, not just the primary one.
            const docsToDeleteSnap = await voiceAliasesRef.where('key', 'in', Array.from(keysToDelete)).get();
            docsToDeleteSnap.forEach(doc => {
                 if (doc.data().type === 'command') { // Ensure we only delete commands
                    batch.delete(doc.ref);
                }
            });
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
                // Use a consistent key format for comparison.
                existingAliases.set(`${key}-${language}-${alias}`.toLowerCase(), doc.id);
            }
        });

        const newAliasesSet = new Set<string>();
        // Pre-fetch all known types to avoid lookups inside the loop.
        const itemTypes = new Map<string, string>();
        existingAliasesSnap.forEach(doc => {
            const { key, type } = doc.data();
            if(key && type && !itemTypes.has(key)) {
                itemTypes.set(key, type);
            }
        });
        
        for (const key in locales) {
            const langEntries = locales[key];
            for (const lang in langEntries) {
                if (lang === 'display' || lang === 'reply') continue;

                const aliasEntry = langEntries[lang];
                const aliases = Array.isArray(aliasEntry) ? aliasEntry : [aliasEntry];

                for (const alias of aliases) {
                    if (!alias) continue;
                    const uniqueId = `${key}-${lang}-${alias}`.toLowerCase();
                    newAliasesSet.add(uniqueId);
                    
                    if (!existingAliases.has(uniqueId)) {
                        const newAliasRef = voiceAliasesRef.doc();
                        // Determine type based on our pre-fetched map, defaulting to 'product'.
                        const type = itemTypes.get(key) || 'product';
                        
                        batch.set(newAliasRef, {
                            key,
                            language: lang,
                            alias: alias.toLowerCase(),
                            type,
                        });
                    }
                }
            }
        }
        
        // Delete aliases that exist in Firestore but not in the new state.
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
