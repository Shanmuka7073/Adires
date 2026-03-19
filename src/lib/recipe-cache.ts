
'use server';

import { Firestore, FieldValue } from 'firebase-admin/firestore';
import type { CachedRecipe, GetIngredientsOutput } from './types';

/**
 * Sanitize dish name for Firestore document ID.
 */
const createSlug = (text: string): string => {
    if (!text) return '';
    return text
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
};

/**
 * Retrieves a cached result from Firestore.
 * Optimized to handle documents with partial data fields and varying field names.
 */
export async function getCachedRecipe(db: Firestore, dishName: string, language: 'en' | 'te'): Promise<GetIngredientsOutput | null> {
    const normalizedDishName = createSlug(dishName);
    const targetDocId = `${normalizedDishName}_${language}`;
    const targetDocRef = db.collection('cachedRecipes').doc(targetDocId);
    
    try {
        const docSnap = await targetDocRef.get();
        
        if (docSnap.exists) {
            const data = docSnap.data() as any;
            
            // Standardize the components list by checking both common field names
            const components = data.components || data.ingredients || [];
            
            return {
                isSuccess: true,
                itemType: data.itemType || 'food',
                title: data.dishName || dishName, // Fallback to provided name
                components: components,
                steps: data.steps || [],
                nutrition: data.nutrition || { calories: 0, protein: 0 },
            };
        }
        
        // Fallback to English cache if regional language is missing
        if (language !== 'en') {
            const englishDocId = `${normalizedDishName}_en`;
            const englishDocRef = db.collection('cachedRecipes').doc(englishDocId);
            const englishDocSnap = await englishDocRef.get();
            if (englishDocSnap.exists) {
                 const data = englishDocSnap.data() as any;
                 const components = data.components || data.ingredients || [];
                 return {
                    isSuccess: true,
                    itemType: data.itemType || 'food',
                    title: data.dishName || dishName,
                    components: components,
                    steps: data.steps || [],
                    nutrition: data.nutrition || { calories: 0, protein: 0 },
                };
            }
        }

        return null;
    } catch (error) {
        console.error("Error fetching cached recipe:", error);
        return null;
    }
}

/**
 * Caches a new result in Firestore to prevent future AI calls.
 */
export async function cacheRecipe(db: Firestore, dishName: string, language: 'en' | 'te', data: GetIngredientsOutput): Promise<void> {
    const normalizedDishName = createSlug(dishName);
    const docId = `${normalizedDishName}_${language}`;
    const docRef = db.collection('cachedRecipes').doc(docId);

    const recipeData: CachedRecipe = {
        id: docId,
        dishName: data.title || dishName,
        itemType: data.itemType || 'food',
        components: data.components || [],
        steps: data.steps || [],
        nutrition: data.nutrition || { calories: 0, protein: 0 },
        createdAt: FieldValue.serverTimestamp(),
    };

    try {
        await docRef.set(recipeData);
    } catch (error) {
        console.error("Firestore cache write failed:", error);
        throw error;
    }
}
