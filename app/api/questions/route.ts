import { NextResponse } from "next/server";
import { createQuestion, getQuestions } from "../../lib/db";
import { parseQuestion } from "../../lib/validate";

// GET /api/questions  -> semua soal
export async function GET() {
  return NextResponse.json(getQuestions());
}

// POST /api/questions -> tambah soal baru
export async function POST(request: Request) {
  const question = parseQuestion(await request.json().catch(() => null));
  if (!question) {
    return NextResponse.json(
      { error: "Data soal tidak valid." },
      { status: 400 },
    );
  }
  return NextResponse.json(createQuestion(question), { status: 201 });
}
