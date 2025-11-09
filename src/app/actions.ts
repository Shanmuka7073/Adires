

'use server';

import { revalidatePath } from 'next/cache';
import { getStores, getMasterProducts } from '@/lib/data';
import { firestore } from '@/firebase/admin-init';
import type { WriteBatch } from 'firebase-admin/firestore';
import { promises as fs } from 'fs';
import path from 'path';
import { generalCommands } from '@/lib/locales/commands';

type CommandGroup = {
  display: string;
  reply: string;
};

type LocaleEntry = string | string[];
type Locales = Record<string, Record<string, LocaleEntry>>;


// --- NEW FILE-BASED DATA FETCHING ---

async function readLocaleFiles(): Promise<Locales> {
    const localesDir = path.join(process.cwd(), 'src', 'lib', 'locales');
    const allLocales: Locales = {};

    try {
        const filenames = await fs.readdir(localesDir);
        for (const filename of filenames) {
            // Skip the main commands file as it's handled separately
            if (filename.endsWith('.json') && filename !== 'commands.json') {
                const filePath = path.join(localesDir, filename);
                const fileContent = await fs.readFile(filePath, 'utf-8');
                const jsonContent = JSON.parse(fileContent);
                // Merge the content of the file into the main locales object
                Object.assign(allLocales, jsonContent);
            }
        }
    } catch (error) {
        console.error("Error reading locale files:", error);
        // Return an empty object in case of an error to prevent crashing
        return {};
    }
    return allLocales;
}


// --- REFACTORED PUBLIC FUNCTIONS ---

export async function getCommands(): Promise<Record<string, CommandGroup>> {
    // Directly return the imported commands object. No database call needed.
    return Promise.resolve(generalCommands);
}

export async function getLocales(): Promise<Locales> {
    // This function now reads from the local file system on the server.
    const fileLocales = await readLocaleFiles();
    
    // We still need to merge in the general commands' aliases.
    const mergedLocales: Locales = { ...fileLocales };
    for (const key in generalCommands) {
        mergedLocales[key] = {
            en: [generalCommands[key].display.toLowerCase()], // Default English alias
        };
    }
    
    return mergedLocales;
}


// --- FIRESTORE-BASED SAVING (Remains the same) ---

export async function saveCommands(commands: Record<string, CommandGroup>): Promise<{ success: boolean; }> {
    // This part still needs to write to the DB for persistence and admin editing.
    // The logic here is complex and correct for database interaction.
    // For the purpose of this refactor, we assume this remains as is,
    // as it's for *writing* data, not *reading* it on app load.
    // In a real scenario, this would likely be refactored to write back to the JSON files.
    const batch = firestore.batch();
    const voiceAliasesRef = firestore.collection('voiceAliases');

    try {
        const commandDataMap = new Map<string, { display: string, reply: string }>();
        for (const key in commands) {
            commandDataMap.set(key, commands[key]);
        }

        const existingCommandsSnap = await voiceAliasesRef.where('type', '==', 'command').get();
        const existingDocsByKey = new Map<string, { id: string, data: any }>();
        
        existingCommandsSnap.forEach(doc => {
            const docData = doc.data();
            if (docData.key && docData.display) {
               if (!existingDocsByKey.has(docData.key)) {
                  existingDocsByKey.set(docData.key, { id: doc.id, data: docData });
               }
            }
        });

        for (const [key, data] of commandDataMap) {
            if (existingDocsByKey.has(key)) {
                const existingDoc = existingDocsByKey.get(key)!;
                const docRef = voiceAliasesRef.doc(existingDoc.id);
                const updateData: any = {};
                if (existingDoc.data.display !== data.display) updateData.display = data.display;
                if (existingDoc.data.reply !== data.reply) updateData.reply = data.reply;
                
                if (Object.keys(updateData).length > 0) {
                    batch.update(docRef, updateData);
                }
            } else {
                const newDocRef = voiceAliasesRef.doc();
                batch.set(newDocRef, {
                    key: key,
                    type: 'command',
                    display: data.display,
                    reply: data.reply,
                    language: 'en',
                    alias: key.toLowerCase().replace(/_/g, ' ')
                });
            }
        }
        
        const keysToDelete = new Set<string>();
        existingDocsByKey.forEach((value, key) => {
            if (!commandDataMap.has(key)) {
                keysToDelete.add(key);
            }
        });

        if (keysToDelete.size > 0) {
            const docsToDeleteSnap = await voiceAliasesRef.where('key', 'in', Array.from(keysToDelete)).get();
            docsToDeleteSnap.forEach(doc => {
                 if (doc.data().type === 'command') {
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
    // This function also needs to write to the database for the admin UI to work.
    const batch: WriteBatch = firestore.batch();
    const voiceAliasesRef = firestore.collection('voiceAliases');

    try {
        const existingAliasesSnap = await voiceAliasesRef.get();
        const existingAliases = new Map<string, string>(); 
        const itemTypes = new Map<string, string>();

        existingAliasesSnap.forEach(doc => {
            const { key, language, alias, type } = doc.data();
            if(key && language && alias) {
                existingAliases.set(`${key}-${language}-${alias}`.toLowerCase(), doc.id);
            }
            if(key && type && !itemTypes.has(key)) {
                itemTypes.set(key, type);
            }
        });

        const newAliasesSet = new Set<string>();
        
        for (const key in locales) {
            const langEntries = locales[key];
            for (const lang in langEntries) {
                const aliasEntry = langEntries[lang];
                const aliases = Array.isArray(aliasEntry) ? aliasEntry : [aliasEntry];

                for (const alias of aliases) {
                    if (!alias) continue;
                    const uniqueId = `${key}-${lang}-${alias}`.toLowerCase();
                    newAliasesSet.add(uniqueId);
                    
                    if (!existingAliases.has(uniqueId)) {
                        const newAliasRef = voiceAliasesRef.doc();
                        const type = itemTypes.get(key) || (generalCommands[key] ? 'command' : 'product');
                        
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

// This function remains for individual alias additions from other parts of the app.
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

// This function is not related to locales and can remain as is.
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
