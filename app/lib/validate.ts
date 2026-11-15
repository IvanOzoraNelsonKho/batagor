// Memeriksa data kiriman dari browser sebelum disimpan ke database.
// Data dari luar tidak boleh dipercaya begitu saja.
import type { Bi, ContentKey, QuizQuestion } from "./data";

const CONTENT_KEYS: ContentKey[] = [
  "homeTitle",
  "homeIntro",
  "aboutTitle",
  "aboutIntro",
  "historyTitle",
  "historyIntro",
];

function isBi(value: unknown): value is Bi {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.trim() !== "" &&
    typeof v.en === "string" &&
    v.en.trim() !== ""
  );
}

export function parseQuestion(body: unknown): QuizQuestion | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  if (!isBi(b.question)) return null;
  if (
    !Array.isArray(b.options) ||
    b.options.length !== 4 ||
    !b.options.every(isBi)
  )
    return null;
  if (
    typeof b.answer !== "number" ||
    !Number.isInteger(b.answer) ||
    b.answer < 0 ||
    b.answer > 3
  ) {
    return null;
  }

  return {
    question: { id: b.question.id.trim(), en: b.question.en.trim() },
    options: (b.options as Bi[]).map((o) => ({
      id: o.id.trim(),
      en: o.en.trim(),
    })),
    answer: b.answer,
  };
}

export function parseContent(body: unknown): Record<ContentKey, Bi> | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  const result = {} as Record<ContentKey, Bi>;
  for (const key of CONTENT_KEYS) {
    const item = b[key];
    if (!isBi(item)) return null;
    result[key] = { id: item.id.trim(), en: item.en.trim() };
  }
  return result;
}
