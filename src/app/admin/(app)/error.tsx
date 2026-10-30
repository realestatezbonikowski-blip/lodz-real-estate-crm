"use client";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  // The error object is not rendered: it could contain internal details.
  return (
    <main id="content" className="wrap py-16">
      <h1 className="display text-4xl">Coś poszło nie tak</h1>
      <p role="alert" className="mt-3 max-w-xl text-muted">Nie udało się wczytać danych. Sprawdź połączenie i spróbuj ponownie. Jeśli problem się powtarza, skontaktuj się z administratorem.</p>
      <button onClick={reset} className="btn btn-primary mt-6">Spróbuj ponownie</button>
    </main>
  );
}
