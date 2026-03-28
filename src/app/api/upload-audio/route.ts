
import { NextRequest, NextResponse } from 'next/server';
import { getAdminServices } from '@/firebase/admin-init';

/**
 * BACKEND: Audio Upload Handler (Cloud Storage Edition)
 * Receives multipart/form-data and uploads directly to Firebase Storage.
 * Bypasses Vercel's read-only filesystem limitations.
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

        // 2. GET STORAGE BUCKET
        const { storage } = await getAdminServices();
        const bucket = storage.bucket();

        // 3. PREPARE CLOUD BLOB
        const filename = `voice-messages/${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;
        const blob = bucket.file(filename);
        
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // 4. UPLOAD TO CLOUD
        await blob.save(buffer, {
            metadata: { 
                contentType: file.type || 'audio/webm',
                cacheControl: 'public, max-age=31536000',
            },
            public: true
        });

        // 5. CONSTRUCT PUBLIC URL
        // Note: This URL pattern works if the bucket/file is public.
        const url = `https://storage.googleapis.com/${bucket.name}/${filename}`;
        
        return NextResponse.json({ url });

    } catch (error: any) {
        console.error("Upload API Error:", error);
        return NextResponse.json({ 
            error: error.message || "Server failed to process upload. Ensure your Firebase Storage bucket is created." 
        }, { status: 500 });
    }
}
