// Lapisan database SQLite (hanya dipakai di server: API route & Server Component).
// Pengganti lib/store.ts yang dulu memakai localStorage.
import Database from "better-sqlite3";
import path from "node:path";
import {
  defaultContent,
  defaultQuestions,
  type Bi,
  type ContentKey,
  type QuizQuestion,
} from "./data";
import type { StoredQuestion } from "./types";

// Saat `next dev`, file ini bisa dimuat ulang berkali-kali (hot reload).
// Koneksi disimpan di globalThis supaya tidak membuka database berulang-ulang.
const globalForDb = globalThis as unknown as { batagorDb?: Database.Database };

function createDb(): Database.Database {
  // File database dibuat otomatis di folder utama project
  const db = new Database(path.join(process.cwd(), "batagor.db"));
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id TEXT    NOT NULL,   -- teks soal (Indonesia)
      question_en TEXT    NOT NULL,   -- teks soal (Inggris)
      options     TEXT    NOT NULL,   -- 4 pilihan jawaban, disimpan sebagai JSON
      answer      INTEGER NOT NULL    -- index jawaban benar (0-3)
    );

    CREATE TABLE IF NOT EXISTS content (
      key     TEXT PRIMARY KEY,       -- contoh: homeTitle
      text_id TEXT NOT NULL,
      text_en TEXT NOT NULL
    );
  `);

  seed(db);
  return db;
}

// Isi data awal hanya jika tabel masih kosong
function seed(db: Database.Database) {
  const { total } = db
    .prepare("SELECT COUNT(*) AS total FROM questions")
    .get() as {
    total: number;
  };

  const insertQuestion = db.prepare(
    "INSERT INTO questions (question_id, question_en, options, answer) VALUES (?, ?, ?, ?)",
  );
  const insertContent = db.prepare(
    "INSERT OR IGNORE INTO content (key, text_id, text_en) VALUES (?, ?, ?)",
  );

  db.transaction(() => {
    if (total === 0) {
      for (const q of defaultQuestions) {
        insertQuestion.run(
          q.question.id,
          q.question.en,
          JSON.stringify(q.options),
          q.answer,
        );
      }
    }
    for (const [key, text] of Object.entries(defaultContent)) {
      insertContent.run(key, text.id, text.en);
    }
  })();
}

function getDb(): Database.Database {
  if (!globalForDb.batagorDb) globalForDb.batagorDb = createDb();
  return globalForDb.batagorDb;
}

/* ===================== SOAL KUIS ===================== */

interface QuestionRow {
  id: number;
  question_id: string;
  question_en: string;
  options: string;
  answer: number;
}

function toQuestion(row: QuestionRow): StoredQuestion {
  return {
    id: row.id,
    question: { id: row.question_id, en: row.question_en },
    options: JSON.parse(row.options) as Bi[],
    answer: row.answer,
  };
}

export function getQuestions(): StoredQuestion[] {
  const rows = getDb()
    .prepare("SELECT * FROM questions ORDER BY id")
    .all() as QuestionRow[];
  return rows.map(toQuestion);
}

export function countQuestions(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS total FROM questions")
    .get() as { total: number };
  return row.total;
}

export function createQuestion(q: QuizQuestion): StoredQuestion {
  const result = getDb()
    .prepare(
      "INSERT INTO questions (question_id, question_en, options, answer) VALUES (?, ?, ?, ?)",
    )
    .run(q.question.id, q.question.en, JSON.stringify(q.options), q.answer);
  return { ...q, id: Number(result.lastInsertRowid) };
}

export function updateQuestion(
  id: number,
  q: QuizQuestion,
): StoredQuestion | null {
  const result = getDb()
    .prepare(
      "UPDATE questions SET question_id = ?, question_en = ?, options = ?, answer = ? WHERE id = ?",
    )
    .run(q.question.id, q.question.en, JSON.stringify(q.options), q.answer, id);
  return result.changes > 0 ? { ...q, id } : null;
}

export function deleteQuestion(id: number): boolean {
  return (
    getDb().prepare("DELETE FROM questions WHERE id = ?").run(id).changes > 0
  );
}

/* ===================== TEKS KONTEN ===================== */

interface ContentRow {
  key: ContentKey;
  text_id: string;
  text_en: string;
}

export function getContent(): Record<ContentKey, Bi> {
  const rows = getDb().prepare("SELECT * FROM content").all() as ContentRow[];
  // Mulai dari teks bawaan, lalu timpa dengan yang ada di database
  const content = JSON.parse(JSON.stringify(defaultContent)) as Record<
    ContentKey,
    Bi
  >;
  for (const row of rows) {
    if (row.key in content)
      content[row.key] = { id: row.text_id, en: row.text_en };
  }
  return content;
}

export function saveContent(content: Record<ContentKey, Bi>): void {
  const upsert = getDb().prepare(
    `INSERT INTO content (key, text_id, text_en) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET text_id = excluded.text_id, text_en = excluded.text_en`,
  );
  getDb().transaction(() => {
    for (const [key, text] of Object.entries(content)) {
      upsert.run(key, text.id, text.en);
    }
  })();
}

export function resetContent(): Record<ContentKey, Bi> {
  getDb().prepare("DELETE FROM content").run();
  saveContent(defaultContent);
  return getContent();
}
