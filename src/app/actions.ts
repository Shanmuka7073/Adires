

'use server';

import { revalidatePath } from 'next/cache';
import { firestore as adminFirestore } from '@/firebase/admin-init';
// Use only the admin SDK on the server. The client 'firebase/firestore' imports were incorrect.

type CommandGroup = {
  display: string;
  reply: string;
};

type LocaleEntry = string | string[];
type Locales = Record<string, Record<string, LocaleEntry>>;
type VoiceAlias = { id?: string; key: string; language: string; alias: string; type: string };


// --- REWRITTEN FIRESTORE-BASED DATA FETCHING using ADMIN SDK ---

async function fetchAliasesFromFirestore(): Promise<VoiceAlias[]> {
    const aliasCollection = adminFirestore.collection('voiceAliases');
    const snapshot = await aliasCollection.get();
    if (snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VoiceAlias));
}

// --- REFACTORED PUBLIC FUNCTIONS ---

export async function getCommands(): Promise<Record<string, CommandGroup>> {
    const aliases = await fetchAliasesFromFirestore();
    const commandAliases = aliases.filter(a => a.type === 'command');
    
    const commands: Record<string, CommandGroup> = {};

    commandAliases.forEach(aliasDoc => {
         if (aliasDoc.language === 'display' || aliasDoc.language === 'reply') {
            if (!commands[aliasDoc.key]) {
                commands[aliasDoc.key] = { display: '', reply: '' };
            }
            if (aliasDoc.language === 'display') commands[aliasDoc.key].display = aliasDoc.alias;
            if (aliasDoc.language === 'reply') commands[aliasDoc.key].reply = aliasDoc.alias;
        }
    });

    return commands;
}


export async function getLocales(): Promise<Locales> {
    const aliases = await fetchAliasesFromFirestore();
    const locales: Locales = {};

    aliases.forEach(aliasDoc => {
        // Exclude the special 'display' and 'reply' types used for commands
        if (aliasDoc.language === 'display' || aliasDoc.language === 'reply') return;

        if (!locales[aliasDoc.key]) {
            locales[aliasDoc.key] = {};
        }

        const langEntry = locales[aliasDoc.key][aliasDoc.language];
        
        if (Array.isArray(langEntry)) {
            langEntry.push(aliasDoc.alias);
        } else if (typeof langEntry === 'string') {
            // Convert to array if it's currently a string
            locales[aliasDoc.key][aliasDoc.language] = [langEntry, aliasDoc.alias];
        } else {
            // First alias for this key-lang pair
            locales[aliasDoc.key][aliasDoc.language] = aliasDoc.alias;
        }
    });
    
    return locales;
}


// --- REFACTORED FIRESTORE-BASED SAVING using ADMIN SDK ---

export async function saveCommands(commands: Record<string, CommandGroup>): Promise<{ success: boolean; }> {
    try {
        const batch = adminFirestore.batch();
        const aliasCollection = adminFirestore.collection('voiceAliases');
        
        // Query existing command display/reply docs to delete them before writing new ones
        const q = aliasCollection.where('type', '==', 'command').where('language', 'in', ['display', 'reply']);
        const existingDocs = await q.get();

        existingDocs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Add new/updated display and reply docs
        for (const key in commands) {
            const { display, reply } = commands[key];
            if (!display && !reply) continue; // Skip empty command entries

            // Add display name as a special alias
            if(display) {
                const displayDocRef = aliasCollection.doc(); // Auto-generate ID
                batch.set(displayDocRef, { key, language: 'display', alias: display, type: 'command' });
            }
            
            // Add reply as a special alias
             if(reply) {
                const replyDocRef = aliasCollection.doc(); // Auto-generate ID
                batch.set(replyDocRef, { key, language: 'reply', alias: reply, type: 'command' });
            }
        }
        
        await batch.commit();

        revalidatePath('/dashboard/voice-commands');
        return { success: true };
    } catch (error) {
        console.error("Error saving commands to Firestore:", error);
        return { success: false };
    }
}

export async function saveLocales(locales: Locales): Promise<{ success: boolean; }> {
     try {
        const batch = adminFirestore.batch();
        const aliasCollection = adminFirestore.collection('voiceAliases');

        // First, delete all existing aliases that are not 'display' or 'reply'
        const q = aliasCollection.where('language', 'not-in', ['display', 'reply']);
        const existingDocs = await q.get();
        existingDocs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Now, add all the new aliases from the locales object
        for (const key in locales) {
            const langMap = locales[key];
            const itemType = determineItemType(key); // You'll need this helper

            for (const lang in langMap) {
                const aliases = Array.isArray(langMap[lang]) ? langMap[lang] as string[] : [langMap[lang] as string];
                for (const alias of aliases) {
                    if (alias) { // Ensure alias is not empty
                        const newDocRef = aliasCollection.doc(); // Auto-generate ID
                        batch.set(newDocRef, { key, language: lang, alias, type: itemType });
                    }
                }
            }
        }

        await batch.commit();
        revalidatePath('/dashboard/voice-commands');
        return { success: true };
    } catch (error) {
        console.error("Error saving locales to Firestore:", error);
        return { success: false };
    }
}

function determineItemType(key: string): 'product' | 'store' | 'command' {
    // This is a simplified heuristic. A more robust system might involve checking against
    // actual product/store lists or having the type passed in.
    if (key.includes('-')) return 'product';
    if (key.startsWith('go') || key.endsWith('Changes') || key.endsWith('Order')) return 'command';
    return 'store';
}


export async function addAliasToLocales(productKey: string, newAlias: string, lang: string): Promise<{ success: boolean }> {
    // This function is no longer the primary way to add aliases, but we can adapt it.
    // It's simpler to just add a new document.
    try {
        const aliasCollection = adminFirestore.collection('voiceAliases');
        const itemType = determineItemType(productKey);

        await aliasCollection.add({
            key: productKey,
            language: lang,
            alias: newAlias.toLowerCase(),
            type: itemType
        });
        
        revalidatePath('/dashboard/voice-commands');
        return { success: true };
    } catch (error) {
         console.error("Error adding alias to Firestore:", error);
        return { success: false };
    }
}

// This function is not related to locales and can remain as is.
export async function indexSiteContent() {
    try {
        console.log('This function is for demonstration and does not perform a real search index.');
        return {
            success: true,
            message: `Demonstration of site indexing complete.`,
        }

    } catch (error) {
        console.error('Error indexing site content:', error);
        return {
            success: false,
            message: 'Failed to index site content. Check server logs for details.',
        };
    }
}

export async function getSystemStatus(): Promise<{ userCount: number, status: 'ok' | 'error' }> {
    try {
        const usersSnapshot = await adminFirestore.collection('users').get();
        return {
            status: 'ok',
            userCount: usersSnapshot.size,
        };
    } catch (error) {
        console.error("System Status Check Failed:", error);
        return {
            status: 'error',
            userCount: 0,
        };
    }
}
