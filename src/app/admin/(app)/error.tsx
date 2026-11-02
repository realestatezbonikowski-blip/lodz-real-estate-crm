"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { useT } from "@/features/admin-prefs/provider";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  const { t } = useT();
  const router = useRouter();
  // The error object is not rendered: it could contain internal details.
  // reset() alone only re-renders the cached server error; refresh() fetches the page from the server again.
  return (
    <main id="content" className="wrap py-16">
      <h1 className="display text-4xl">{t("err.title")}</h1>
      <p role="alert" className="mt-3 max-w-xl text-muted">{t("err.text")}</p>
      <button onClick={() => startTransition(() => { router.refresh(); reset(); })} className="btn btn-primary mt-6">{t("err.retry")}</button>
    </main>
  );
}
