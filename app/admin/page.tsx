import AdminEditor from "./AdminEditor";
import { getContent, getQuestions } from "../lib/db";

// Dirender ulang di setiap permintaan supaya selalu menampilkan isi database terbaru
export const dynamic = "force-dynamic";

// Server Component: membaca data dari SQLite, lalu mengirimnya ke editor (client)
export default function AdminPage() {
  return (
    <AdminEditor
      initialQuestions={getQuestions()}
      initialContent={getContent()}
    />
  );
}
