import { NextResponse } from "next/server";

/**
 * API route for salary slip document generation.
 * Currently serves as a placeholder for Next.js build validation.
 */
export async function GET() {
  return NextResponse.json({ message: "Docx generation endpoint active." }, { status: 200 });
}
