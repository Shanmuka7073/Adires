
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * BACKEND: Audio Upload Handler
 * Receives multipart/form-data, validates size/type, and saves to public/uploads.
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('audio') as File;

        if (!file) {
            return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
        }

        // 1. SECURITY: Check file type and size (2MB limit)
        if (!file.type.startsWith('audio/')) {
            return NextResponse.json({ error: "Invalid file type. Only audio allowed." }, { status: 400 });
        }
        if (file.size > 2 * 1024 * 1024) {
            return NextResponse.json({ error: "File too large. Max 2MB." }, { status: 400 });
        }

        // 2. PREPARE STORAGE: Ensure public/uploads exists
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        const uploadDir = join(process.cwd(), 'public', 'uploads');
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
        }

        // 3. SAVE FILE: Generate unique filename
        const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;
        const path = join(uploadDir, filename);
        
        await writeFile(path, buffer);
        
        // 4. RETURN URL: Publicly accessible path
        const url = `/uploads/${filename}`;
        
        return NextResponse.json({ url });

    } catch (error: any) {
        console.error("Upload API Error:", error);
        return NextResponse.json({ error: "Server failed to process upload" }, { status: 500 });
    }
}
