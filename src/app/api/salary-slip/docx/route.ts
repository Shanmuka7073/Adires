import { NextResponse } from "next/server";

/**
 * Placeholder API route for salary slip document processing.
 * Currently, DOCX generation is handled on the client side for performance.
 */
export async function GET() {
  return NextResponse.json({ message: "Endpoint active. Use client-side generation for now." }, { status: 404 });
}
