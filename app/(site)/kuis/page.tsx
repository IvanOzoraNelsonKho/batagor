import QuizGame from "../../components/QuizGame";
import { getQuestions } from "../../lib/db";

// Server Component: membaca soal dari SQLite, lalu mengirimnya ke komponen kuis
export default function KuisPage() {
  const questions = getQuestions();
  return <QuizGame questions={questions} />;
}
