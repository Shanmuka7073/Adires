
'use server';

import { revalidatePath } from 'next/cache';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getStores, getMasterProducts } from '@/lib/data';
import { initServerApp } from '@/firebase/server-init';

const LOCALES_DIR = path.join(process.cwd(), 'src', 'lib', 'locales');

type CommandGroup = {
  display: string;
  reply: string;
  aliases: string[];
};

type LocaleEntry = string | string[];
type Locales = Record<string, Record<string, LocaleEntry>>;

async function readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            console.warn(`File not found: ${filePath}`);
            return null;
        }
        console.error(`Error reading or parsing JSON file: ${filePath}`, error);
        throw new Error(`Could not load data from ${path.basename(filePath)}.`);
    }
}

export async function getCommands(): Promise<Record<string, CommandGroup>> {
    const filePath = path.join(LOCALES_DIR, 'commands.json');
    const commandLocales = await readJsonFile<any>(filePath);
    
    const commands: Record<string, CommandGroup> = {};
    if (commandLocales) {
      for (const key in commandLocales) {
        const potentialCommand = commandLocales[key];
        if (potentialCommand && typeof potentialCommand.reply === 'string' && typeof potentialCommand.display === 'string') {
          commands[key] = {
            display: potentialCommand.display,
            reply: potentialCommand.reply,
            aliases: potentialCommand.aliases || []
          };
        }
      }
    }
    
    if (Object.keys(commands).length === 0) {
        const legacyPath = path.join(process.cwd(), 'src', 'lib', 'commands.json');
        try {
            const legacyCommands = await readJsonFile<Record<string, CommandGroup>>(legacyPath);
            if (legacyCommands) {
                 await fs.unlink(legacyPath); 
                 return legacyCommands;
            }
        } catch(e) {
            // ignore if not found
        }
    }
    
    return commands;
}

export async function saveCommands(commands: Record<string, CommandGroup>): Promise<{ success: boolean; }> {
    const allLocales = await getLocales();

    for (const key in commands) {
      if (!allLocales[key]) {
        allLocales[key] = {};
      }
      Object.assign(allLocales[key], commands[key]);
    }
    
    return saveLocales(allLocales);
}

export async function getLocales(): Promise<Locales> {
    const mergedLocales: Locales = {};
    try {
        const files = await fs.readdir(LOCALES_DIR);
        const jsonFiles = files.filter(file => file.endsWith('.json'));

        for (const file of jsonFiles) {
            const filePath = path.join(LOCALES_DIR, file);
            const content = await readJsonFile<Locales>(filePath);
            if (content) {
                Object.assign(mergedLocales, content);
            }
        }
        
        return mergedLocales;
    } catch (error) {
        console.error("Error reading locales directory:", error);
        throw new Error("Could not load locale files.");
    }
}

export async function saveLocales(locales: Locales): Promise<{ success: boolean; }> {
    try {
        for (const key in locales) {
            if (Object.prototype.hasOwnProperty.call(locales, key)) {
                const filePath = path.join(LOCALES_DIR, `${key}.json`);
                const content = { [key]: locales[key] };
                const jsonContent = JSON.stringify(content, null, 2);
                await fs.writeFile(filePath, jsonContent, 'utf-8');
            }
        }
        return { success: true };
    } catch (error) {
        console.error("Error writing locale files:", error);
        throw new Error("Could not save locales to individual files.");
    }
}


export async function addAliasToLocales(productKey: string, newAlias: string, lang: string): Promise<{ success: boolean }> {
    const locales = await getLocales();
    
    if (!locales[productKey]) {
        locales[productKey] = {};
    }

    const langEntry = locales[productKey][lang];
    const newAliasLower = newAlias.toLowerCase();

    if (!langEntry) {
        locales[productKey][lang] = newAliasLower;
    } else if (Array.isArray(langEntry)) {
        if (!langEntry.includes(newAliasLower)) {
            langEntry.push(newAliasLower);
        }
    } else { // It's a single string
        if (langEntry !== newAliasLower) {
            locales[productKey][lang] = [langEntry, newAliasLower];
        }
    }

    return saveLocales(locales);
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
