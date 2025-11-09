
'use server';

import { revalidatePath } from 'next/cache';
import { getStores, getMasterProducts } from '@/lib/data';
import { initServerApp } from '@/firebase/server-init';
import { collection, getDocs, writeBatch, doc, query, where, addDoc } from 'firebase/firestore';

type CommandGroup = {
  display: string;
  reply: string;
  aliases: string[];
};

type LocaleEntry = string | string[];
type Locales = Record<string, Record<string, LocaleEntry>>;


// Reads legacy commands.json for migration purposes. Will be removed later.
async function getFileCommands(): Promise<Record<string, CommandGroup>> {
    try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const LOCALES_DIR = path.join(process.cwd(), 'src', 'lib', 'locales');
        const filePath = path.join(LOCALES_DIR, 'commands.json');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (e) {
        console.warn("commands.json not found or unreadable. Skipping file-based command loading.");
        return {};
    }
}


export async function getCommands(): Promise<Record<string, CommandGroup>> {
    // For now, we still read from the file for the display/reply info,
    // as we haven't built a UI to manage that in Firestore yet.
    // The aliases themselves will come from the voiceAliases collection.
    return getFileCommands();
}

export async function getLocales(): Promise<Locales> {
    const { firestore } = await initServerApp();
    const locales: Locales = {};

    try {
        // 1. Fetch aliases from Firestore
        const aliasSnapshot = await getDocs(collection(firestore, 'voiceAliases'));
        aliasSnapshot.forEach(doc => {
            const data = doc.data();
            const { key, language, alias } = data;
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
        
        // 2. Fetch commands from the file to merge in display/reply text
        const fileCommands = await getFileCommands();
        for (const key in fileCommands) {
            if (!locales[key]) {
                locales[key] = {};
            }
            // This is a temporary hack. We should have a proper command collection.
            Object.assign(locales[key], fileCommands[key]);
        }

        // Normalize single-item arrays back to strings for compatibility
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
        // Fallback to file-based commands if Firestore fails
        return getFileCommands() as Locales;
    }
}

export async function saveCommands(commands: Record<string, CommandGroup>): Promise<{ success: boolean; }> {
    // This function will eventually save command metadata (display, reply) to Firestore.
    // For now, we are still saving this part to a file as a fallback.
     try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const LOCALES_DIR = path.join(process.cwd(), 'src', 'lib', 'locales');
        await fs.mkdir(LOCALES_DIR, { recursive: true });
        const commandsFilePath = path.join(LOCALES_DIR, `commands.json`);
        const commandsJsonContent = JSON.stringify(commands, null, 2);
        await fs.writeFile(commandsFilePath, commandsJsonContent, 'utf-8');
        return { success: true };
    } catch (error) {
        console.error("Error saving commands.json file:", error);
        return { success: false };
    }
}

export async function saveLocales(locales: Locales): Promise<{ success: boolean; }> {
    const { firestore } = await initServerApp();
    const batch = writeBatch(firestore);
    
    // We need to fetch all existing aliases to know which ones to delete.
    const existingAliasesSnap = await getDocs(collection(firestore, 'voiceAliases'));
    const existingAliases = new Map<string, string>(); // Map of "key-lang-alias" -> docId
    existingAliasesSnap.forEach(doc => {
        const { key, language, alias } = doc.data();
        existingAliases.set(`${key}-${language}-${alias}`, doc.id);
    });

    const newAliasesSet = new Set<string>();

    for (const key in locales) {
        const langEntries = locales[key];
        for (const lang in langEntries) {
            // Skip non-alias properties like 'display' and 'reply'
            if (lang === 'display' || lang === 'reply' || lang === 'aliases') continue;

            const aliasEntry = langEntries[lang];
            const aliases = Array.isArray(aliasEntry) ? aliasEntry : [aliasEntry];

            for (const alias of aliases) {
                if (!alias) continue;
                const uniqueId = `${key}-${lang}-${alias}`;
                newAliasesSet.add(uniqueId);
                
                // If this exact alias doesn't exist in our fetched map, it's new. Add it.
                if (!existingAliases.has(uniqueId)) {
                    const newAliasRef = doc(collection(firestore, 'voiceAliases'));
                     batch.set(newAliasRef, {
                        key,
                        language: lang,
                        alias: alias.toLowerCase(),
                        type: Object.keys(await getFileCommands()).includes(key) ? 'command' : 'product', // Heuristic
                    });
                }
            }
        }
    }
    
    // Now, determine which aliases to delete
    existingAliases.forEach((docId, uniqueId) => {
        if (!newAliasesSet.has(uniqueId)) {
            batch.delete(doc(firestore, 'voiceAliases', docId));
        }
    });

    try {
        await batch.commit();
        return { success: true };
    } catch (error) {
        console.error("Error saving locales to Firestore:", error);
        return { success: false };
    }
}

export async function addAliasToLocales(productKey: string, newAlias: string, lang: string): Promise<{ success: boolean }> {
    const { firestore } = await initServerApp();
    const aliasLower = newAlias.toLowerCase();
    
    // Check if alias already exists for this key/lang combination to avoid duplicates
    const q = query(
        collection(firestore, 'voiceAliases'),
        where('key', '==', productKey),
        where('language', '==', lang),
        where('alias', '==', aliasLower)
    );

    try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            // Alias already exists, no need to add again
            return { success: true };
        }
        
        // Add the new alias
        await addDoc(collection(firestore, 'voiceAliases'), {
            key: productKey,
            language: lang,
            alias: aliasLower,
            type: 'product', // Assume it's a product for this function
        });

        return { success: true };
    } catch (error) {
         console.error("Error adding alias to Firestore:", error);
        return { success: false };
    }
}


export async function indexSiteContent() {
    try {
        const { firestore } = await initServerApp();
        console.log('Fetching stores and master products for indexing...');

        const stores = await getStores(firestore as any);
        const masterProducts = await getMasterProducts(firestore as any);

        console.log(`Found ${stores.length} stores.`);
        console.log(`Found ${masterProducts.length} master products.`);

        // In the future, this data can be saved to a new Firestore collection
        // for the voice commander to use.

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

// This file can be extended with more server actions.

    