import Link from "next/link";

export default function AdminNotFound() {
  return (
    <main id="content" className="wrap py-16">
      <h1 className="display text-4xl">Nie znaleziono</h1>
      <p className="mt-3 max-w-xl text-muted">Ten lead nie istnieje albo nie masz do niego dostępu.</p>
      <Link href="/admin/leads" className="btn btn-primary mt-6">Wróć do listy</Link>
    </main>
  );
}
