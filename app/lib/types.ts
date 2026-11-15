// Tipe data yang dipakai bersama oleh server (database) dan client (halaman).
// File ini sengaja TIDAK mengimpor better-sqlite3 supaya aman dipakai di client.
import type { QuizQuestion } from "./data";

/** Soal kuis yang sudah tersimpan di database (punya id dari SQLite). */
export type StoredQuestion = QuizQuestion & { id: number };
