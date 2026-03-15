
'use client';

export const cachedRecipesCodeText = [
    {
        path: 'src/lib/recipe-cache.ts',
        content: `
'use client';

import { Firestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { CachedRecipe, GetIngredientsOutput } from './types';

/**
 * Retrieves a cached item from Firestore.
 */
export async function getCachedRecipe(db: Firestore, dishName: string, language: 'en' | 'te'): Promise<GetIngredientsOutput | null> {
    const normalizedDishName = dishName.toLowerCase().replace(/\\s+/g, '-');
    const targetDocId = \`\${normalizedDishName}_\${language}\`;
    const targetDocRef = doc(db, 'cachedRecipes', targetDocId);
    
    try {
        const docSnap = await getDoc(targetDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data() as CachedRecipe;
            return {
                isSuccess: true,
                itemType: data.itemType || 'food',
                title: data.dishName,
                components: data.components || [],
                steps: data.steps || [],
                nutrition: data.nutrition || { calories: 0, protein: 0 },
            };
        }
        
        return null;
    } catch (error) {
        console.error("Error fetching cached recipe:", error);
        return null;
    }
}

/**
 * Caches a new item in Firestore.
 */
export function cacheRecipe(db: Firestore, dishName: string, language: 'en' | 'te', data: GetIngredientsOutput): Promise<void> {
    const normalizedDishName = dishName.toLowerCase().replace(/\\s+/g, '-');
    const docId = \`\${normalizedDishName}_\${language}\`;
    const docRef = doc(db, 'cachedRecipes', docId);

    const recipeData: CachedRecipe = {
        id: docId,
        dishName: data.title || dishName,
        itemType: data.itemType || 'food',
        components: data.components || [],
        steps: data.steps || [],
        nutrition: data.nutrition || { calories: 0, protein: 0 },
        createdAt: serverTimestamp(),
    };

    return setDoc(docRef, recipeData);
}
`,
    },
];
