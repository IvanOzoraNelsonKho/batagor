// Lapisan database (hanya dipakai di server: API route & Server Component).
// Versi Neon / PostgreSQL. Semua fungsi ASYNC, nama fungsi sama dengan versi SQLite.
// Wajib ada variabel env DATABASE_URL (Vercel: Settings > Environment Variables;
// lokal: file .env.local).
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import {
  defaultContent,
  defaultQuestions,
  type Bi,
  type ContentKey,
  type QuizQuestion,
} from "./data";
import type { StoredQuestion } from "./types";

// Mode default: hasil query berupa array baris (bukan array-of-array, bukan FullQueryResults).
type Sql = NeonQueryFunction<false, false>;

// Simpan koneksi di globalThis supaya hot reload tidak membuat koneksi baru.
const globalForDb = globalThis as unknown as {
  batagorSql?: Sql;
  batagorReady?: Promise<void>;
};

// Dibuat saat dipakai (bukan saat file diimpor), supaya `next build`
// tidak error ketika DATABASE_URL belum ada.
function getClient(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL belum diisi. Tambahkan di Vercel (Environment Variables) atau di .env.local",
    );
  }
  if (!globalForDb.batagorSql) globalForDb.batagorSql = neon(url);
  return globalForDb.batagorSql;
}

// Buat tabel + isi data awal (sekali per proses), lalu kembalikan koneksi.
async function getSql(): Promise<Sql> {
  const sql = getClient();
  if (!globalForDb.batagorReady) {
    globalForDb.batagorReady = init(sql).catch((error) => {
      globalForDb.batagorReady = undefined; // izinkan coba lagi
      throw error;
    });
  }
  await globalForDb.batagorReady;
  return sql;
}

async function init(sql: Sql): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS questions (
    id          SERIAL PRIMARY KEY,
    question_id TEXT    NOT NULL,
    question_en TEXT    NOT NULL,
    options     TEXT    NOT NULL,
    answer      INTEGER NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS content (
    key     TEXT PRIMARY KEY,
    text_id TEXT NOT NULL,
    text_en TEXT NOT NULL
  )`;

  const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM questions`;
  if (Number(total) === 0) {
    await sql.transaction(
      defaultQuestions.map(
        (
          q,
        ) => sql`INSERT INTO questions (question_id, question_en, options, answer)
                   VALUES (${q.question.id}, ${q.question.en}, ${JSON.stringify(q.options)}, ${q.answer})`,
      ),
    );
  }
  await sql.transaction(
    Object.entries(defaultContent).map(
      ([key, text]) => sql`INSERT INTO content (key, text_id, text_en)
                           VALUES (${key}, ${text.id}, ${text.en})
                           ON CONFLICT (key) DO NOTHING`,
    ),
  );
}

/* ===================== SOAL KUIS ===================== */

function toQuestion(row: Record<string, unknown>): StoredQuestion {
  return {
    id: Number(row.id),
    question: { id: String(row.question_id), en: String(row.question_en) },
    options: JSON.parse(String(row.options)) as Bi[],
    answer: Number(row.answer),
  };
}

export async function getQuestions(): Promise<StoredQuestion[]> {
  const sql = await getSql();
  const rows = await sql`SELECT * FROM questions ORDER BY id`;
  return rows.map(toQuestion);
}

export async function countQuestions(): Promise<number> {
  const sql = await getSql();
  const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM questions`;
  return Number(total);
}

export async function createQuestion(q: QuizQuestion): Promise<StoredQuestion> {
  const sql = await getSql();
  const [row] =
    await sql`INSERT INTO questions (question_id, question_en, options, answer)
                          VALUES (${q.question.id}, ${q.question.en}, ${JSON.stringify(q.options)}, ${q.answer})
                          RETURNING id`;
  return { ...q, id: Number(row.id) };
}

export async function updateQuestion(
  id: number,
  q: QuizQuestion,
): Promise<StoredQuestion | null> {
  const sql = await getSql();
  const rows = await sql`UPDATE questions
                         SET question_id = ${q.question.id}, question_en = ${q.question.en},
                             options = ${JSON.stringify(q.options)}, answer = ${q.answer}
                         WHERE id = ${id}
                         RETURNING id`;
  return rows.length > 0 ? { ...q, id } : null;
}

export async function deleteQuestion(id: number): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql`DELETE FROM questions WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

/* ===================== TEKS KONTEN ===================== */

export async function getContent(): Promise<Record<ContentKey, Bi>> {
  const sql = await getSql();
  const rows = await sql`SELECT * FROM content`;
  // Mulai dari teks bawaan, lalu timpa dengan yang ada di database
  const content = JSON.parse(JSON.stringify(defaultContent)) as Record<
    ContentKey,
    Bi
  >;
  for (const row of rows) {
    const key = String(row.key) as ContentKey;
    if (key in content) {
      content[key] = { id: String(row.text_id), en: String(row.text_en) };
    }
  }
  return content;
}

export async function saveContent(
  content: Record<ContentKey, Bi>,
): Promise<void> {
  const sql = await getSql();
  await sql.transaction(
    Object.entries(content).map(
      ([key, text]) => sql`INSERT INTO content (key, text_id, text_en)
                           VALUES (${key}, ${text.id}, ${text.en})
                           ON CONFLICT (key) DO UPDATE
                           SET text_id = EXCLUDED.text_id, text_en = EXCLUDED.text_en`,
    ),
  );
}

export async function resetContent(): Promise<Record<ContentKey, Bi>> {
  const sql = await getSql();
  await sql.transaction([
    sql`DELETE FROM content`,
    ...Object.entries(defaultContent).map(
      ([key, text]) => sql`INSERT INTO content (key, text_id, text_en)
                           VALUES (${key}, ${text.id}, ${text.en})`,
    ),
  ]);
  return getContent();
}
