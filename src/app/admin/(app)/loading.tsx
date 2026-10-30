export default function Loading() {
  return (
    <main id="content" className="wrap py-12" aria-busy="true">
      <p role="status" className="text-muted">Wczytywanie…</p>
      <div aria-hidden="true" className="mt-6 grid gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse bg-paper-deep" />)}
      </div>
    </main>
  );
}
