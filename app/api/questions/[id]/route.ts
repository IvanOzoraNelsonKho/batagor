import { NextResponse } from "next/server";
import {
  countQuestions,
  deleteQuestion,
  updateQuestion,
} from "../../../lib/db";
import { parseQuestion } from "../../../lib/validate";

type Context = { params: Promise<{ id: string }> };

// PUT /api/questions/3 -> ubah soal dengan id 3
export async function PUT(request: Request, { params }: Context) {
  const id = Number((await params).id);
  const question = parseQuestion(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !question) {
    return NextResponse.json(
      { error: "Data soal tidak valid." },
      { status: 400 },
    );
  }
  const updated = await updateQuestion(id, question);
  if (!updated) {
    return NextResponse.json(
      { error: "Soal tidak ditemukan." },
      { status: 404 },
    );
  }
  return NextResponse.json(updated);
}

// DELETE /api/questions/3 -> hapus soal dengan id 3
export async function DELETE(_request: Request, { params }: Context) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  }
  if ((await countQuestions()) <= 1) {
    return NextResponse.json(
      { error: "Kuis harus memiliki minimal satu soal." },
      { status: 400 },
    );
  }
  if (!(await deleteQuestion(id))) {
    return NextResponse.json(
      { error: "Soal tidak ditemukan." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
