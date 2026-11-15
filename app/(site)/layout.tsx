import { LanguageProvider } from "../components/LanguageProvider";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import { getContent } from "../lib/db";
import "./style.css";
import "./responsive.css";
import "./extras.css";

// Halaman dirender ulang di setiap permintaan, supaya perubahan dari admin
// langsung terlihat (tanpa ini Next.js membekukan isi database saat build).
export const dynamic = "force-dynamic";

// Server Component: teks beranda/sejarah dibaca dari database SQLite
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const content = await getContent();

  return (
    <LanguageProvider content={content}>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </LanguageProvider>
  );
}
