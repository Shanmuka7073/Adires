import { getIngredientsForDishFlow } from '@/ai/flows/recipe-ingredients-flow';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dishName, language } = body;

    if (!dishName) {
      return NextResponse.json({ error: 'Dish name is required' }, { status: 400 });
    }

    const result = await getIngredientsForDishFlow({ dishName, language: language || 'en' });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in ingredients route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
