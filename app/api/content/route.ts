import { NextResponse } from "next/server";
import { getContent, resetContent, saveContent } from "../../lib/db";
import { parseContent } from "../../lib/validate";

// GET /api/content -> semua teks yang bisa diedit admin
export async function GET() {
  return NextResponse.json(await getContent());
}

// PUT /api/content -> simpan perubahan teks
export async function PUT(request: Request) {
  const content = parseContent(await request.json().catch(() => null));
  if (!content) {
    return NextResponse.json(
      { error: "Data konten tidak valid." },
      { status: 400 },
    );
  }
  await saveContent(content);
  return NextResponse.json(await getContent());
}

// DELETE /api/content -> kembalikan semua teks ke bawaan
export async function DELETE() {
  return NextResponse.json(await resetContent());
}
