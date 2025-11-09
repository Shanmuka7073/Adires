
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
    
    // The command file now contains aliases too, we need to extract the command-specific fields
    const commands: Record<string, CommandGroup> = {};
    if (commandLocales) {
      for (const key in commandLocales) {
        // A simple heuristic: if it has a 'reply' field, it's a command.
        // This relies on the structure from the old commands.json
        // A more robust way might be needed if structures diverge.
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
    
    // Fallback to legacy commands.json if it exists
    if (Object.keys(commands).length === 0) {
        const legacyPath = path.join(process.cwd(), 'src', 'lib', 'commands.json');
        try {
            const legacyCommands = await readJsonFile<Record<string, CommandGroup>>(legacyPath);
            if (legacyCommands) {
                 await fs.unlink(legacyPath); // remove legacy file
                 return legacyCommands;
            }
        } catch(e) {
            // ignore if not found
        }
    }
    
    return commands;
}

export async function saveCommands(commands: Record<string, CommandGroup>): Promise<{ success: boolean; }> {
    const filePath = path.join(LOCALES_DIR, 'commands.json');
     try {
        // When saving commands, we need to merge them with any existing aliases in that file
        const existingFileContent = await readJsonFile<Locales>(filePath) || {};
        
        Object.entries(commands).forEach(([key, value]) => {
            if (!existingFileContent[key]) {
                existingFileContent[key] = {};
            }
            // Merge command-specific data with locale data
            Object.assign(existingFileContent[key], value);
        });

        const jsonContent = JSON.stringify(existingFileContent, null, 2);
        await fs.writeFile(filePath, jsonContent, 'utf-8');
        return { success: true };
    } catch (error) {
        console.error("Error writing commands file:", error);
        throw new Error("Could not save commands to file.");
    }
}

export async function getLocales(): Promise<Locales> {
    const mergedLocales: Locales = {};
    try {
        const files = await fs.readdir(LOCALES_DIR);
        const jsonFiles = files.filter(file => file.endsWith('.json') && file !== 'locales.json');

        for (const file of jsonFiles) {
            const filePath = path.join(LOCALES_DIR, file);
            const content = await readJsonFile<Locales>(filePath);
            if (content) {
                Object.assign(mergedLocales, content);
            }
        }
        
        // Handle legacy locales.json if it exists
        const legacyFilePath = path.join(LOCALES_DIR, 'locales.json');
        try {
             const legacyContent = await fs.readFile(legacyFilePath, 'utf-8');
             if (legacyContent.trim()) {
                 const legacyLocales = JSON.parse(legacyContent);
                 Object.assign(mergedLocales, legacyLocales);
                 // Overwrite with empty after processing to prevent re-processing
                 await fs.writeFile(legacyFilePath, '{}', 'utf-8');
             }
        } catch (e) {
             // File might not exist, which is fine
             if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
                console.warn("Could not process legacy locales.json", e);
             }
        }

        return mergedLocales;
    } catch (error) {
        console.error("Error reading locales directory:", error);
        throw new Error("Could not load locale files.");
    }
}

async function getAllLocalesByCategory(): Promise<Record<string, Locales>> {
    const allLocales: Record<string, Locales> = {};
    try {
        const files = await fs.readdir(LOCALES_DIR);
        const jsonFiles = files.filter(file => file.endsWith('.json') && file !== 'locales.json');

        for (const file of jsonFiles) {
            const category = path.basename(file, '.json');
            const filePath = path.join(LOCALES_DIR, file);
            const content = await readJsonFile<Locales>(filePath);
            if (content) {
                allLocales[category] = content;
            }
        }
    } catch (error) {
        console.error("Error reading locales directory:", error);
    }
    return allLocales;
}

export async function saveLocales(locales: Locales): Promise<{ success: boolean; }> {
    try {
        const localesByCategory = await getAllLocalesByCategory();
        const groceryData = await readJsonFile<any>(path.join(process.cwd(), 'src', 'lib', 'grocery-data.json'));
        
        if (!groceryData) {
            throw new Error("Could not load grocery-data.json to determine categories.");
        }

        const productToCategoryMap = new Map<string, string>();
        groceryData.categories.forEach(category => {
            const categorySlug = category.categoryName.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
            category.items.forEach(item => {
                // This slug generation MUST match the keys in the locale files (e.g., 'potatoes', 'green-chilies')
                const productSlug = item.toLowerCase().replace(/\s*\(.*\)\s*/g, '').replace(/\s+/g, '-');
                 productToCategoryMap.set(productSlug, categorySlug);
            });
        });
        
        const newCategoryFiles: Record<string, Locales> = {};

        for (const key in locales) {
            let category = productToCategoryMap.get(key);

            if (!category) {
                // If not in the grocery-data map, check which existing file it belongs to.
                for(const cat in localesByCategory) {
                    if (localesByCategory[cat][key]) {
                        category = cat;
                        break;
                    }
                }
                 // Default to a file based on existing structure or a default name
                if (!category) {
                   category = 'miscellaneous';
                   if (localesByCategory.commands && localesByCategory.commands[key]) {
                       category = 'commands';
                   } else if(localesByCategory.stores && localesByCategory.stores[key]) {
                       category = 'stores';
                   }
                }
            }
            
            // Special handling for category names themselves, which are their own files
            const isCategoryKey = groceryData.categories.some(c => c.categoryName.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-') === key);
            if (isCategoryKey) {
                category = key;
            }


            if (!newCategoryFiles[category]) {
                newCategoryFiles[category] = {};
            }
            newCategoryFiles[category][key] = locales[key];
        }

        for (const category in newCategoryFiles) {
            const filePath = path.join(LOCALES_DIR, `${category}.json`);
            const jsonContent = JSON.stringify(newCategoryFiles[category], null, 2);
            await fs.writeFile(filePath, jsonContent, 'utf-8');
        }
        return { success: true };

    } catch (error) {
        console.error("Error writing locales files:", error);
        throw new Error("Could not save locales to files.");
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
