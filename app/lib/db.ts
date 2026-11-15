// Lapisan database (hanya dipakai di server: API route & Server Component).
// Versi Turso/libSQL: SQL-nya tetap SQLite, tapi semua fungsi sekarang ASYNC.
// Tanpa variabel env, otomatis memakai file lokal batagor.db (untuk npm run dev).
import { createClient, type Client, type InStatement } from "@libsql/client";
import {
  defaultContent,
  defaultQuestions,
  type Bi,
  type ContentKey,
  type QuizQuestion,
} from "./data";
import type { StoredQuestion } from "./types";

// Simpan koneksi di globalThis supaya hot reload tidak membuat koneksi baru.
const globalForDb = globalThis as unknown as {
  batagorDb?: Client;
  batagorReady?: Promise<void>;
};

function getClient(): Client {
  if (!globalForDb.batagorDb) {
    globalForDb.batagorDb = createClient({
      url: process.env.TURSO_DATABASE_URL ?? "file:batagor.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return globalForDb.batagorDb;
}

// Buat tabel + isi data awal (sekali per proses), lalu kembalikan koneksi.
async function getDb(): Promise<Client> {
  const db = getClient();
  if (!globalForDb.batagorReady) {
    globalForDb.batagorReady = init(db).catch((error) => {
      globalForDb.batagorReady = undefined; // izinkan coba lagi
      throw error;
    });
  }
  await globalForDb.batagorReady;
  return db;
}

async function init(db: Client): Promise<void> {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS questions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id TEXT    NOT NULL,
        question_en TEXT    NOT NULL,
        options     TEXT    NOT NULL,
        answer      INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS content (
        key     TEXT PRIMARY KEY,
        text_id TEXT NOT NULL,
        text_en TEXT NOT NULL
      )`,
    ],
    "write",
  );

  const count = await db.execute("SELECT COUNT(*) AS total FROM questions");
  const statements: InStatement[] = [];
  if (Number(count.rows[0].total) === 0) {
    for (const q of defaultQuestions) {
      statements.push({
        sql: "INSERT INTO questions (question_id, question_en, options, answer) VALUES (?, ?, ?, ?)",
        args: [
          q.question.id,
          q.question.en,
          JSON.stringify(q.options),
          q.answer,
        ],
      });
    }
  }
  for (const [key, text] of Object.entries(defaultContent)) {
    statements.push({
      sql: "INSERT OR IGNORE INTO content (key, text_id, text_en) VALUES (?, ?, ?)",
      args: [key, text.id, text.en],
    });
  }
  if (statements.length > 0) await db.batch(statements, "write");
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
  const db = await getDb();
  const result = await db.execute("SELECT * FROM questions ORDER BY id");
  return result.rows.map(toQuestion);
}

export async function countQuestions(): Promise<number> {
  const db = await getDb();
  const result = await db.execute("SELECT COUNT(*) AS total FROM questions");
  return Number(result.rows[0].total);
}

export async function createQuestion(q: QuizQuestion): Promise<StoredQuestion> {
  const db = await getDb();
  const result = await db.execute({
    sql: "INSERT INTO questions (question_id, question_en, options, answer) VALUES (?, ?, ?, ?)",
    args: [q.question.id, q.question.en, JSON.stringify(q.options), q.answer],
  });
  return { ...q, id: Number(result.lastInsertRowid) };
}

export async function updateQuestion(
  id: number,
  q: QuizQuestion,
): Promise<StoredQuestion | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: "UPDATE questions SET question_id = ?, question_en = ?, options = ?, answer = ? WHERE id = ?",
    args: [
      q.question.id,
      q.question.en,
      JSON.stringify(q.options),
      q.answer,
      id,
    ],
  });
  return result.rowsAffected > 0 ? { ...q, id } : null;
}

export async function deleteQuestion(id: number): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute({
    sql: "DELETE FROM questions WHERE id = ?",
    args: [id],
  });
  return result.rowsAffected > 0;
}

/* ===================== TEKS KONTEN ===================== */

function upsertStatements(content: Record<ContentKey, Bi>): InStatement[] {
  return Object.entries(content).map(([key, text]) => ({
    sql: `INSERT INTO content (key, text_id, text_en) VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET text_id = excluded.text_id, text_en = excluded.text_en`,
    args: [key, text.id, text.en],
  }));
}

export async function getContent(): Promise<Record<ContentKey, Bi>> {
  const db = await getDb();
  const result = await db.execute("SELECT * FROM content");
  // Mulai dari teks bawaan, lalu timpa dengan yang ada di database
  const content = JSON.parse(JSON.stringify(defaultContent)) as Record<
    ContentKey,
    Bi
  >;
  for (const row of result.rows) {
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
  const db = await getDb();
  await db.batch(upsertStatements(content), "write");
}

export async function resetContent(): Promise<Record<ContentKey, Bi>> {
  const db = await getDb();
  await db.batch(
    ["DELETE FROM content", ...upsertStatements(defaultContent)],
    "write",
  );
  return getContent();
}
