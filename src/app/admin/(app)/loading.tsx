import { getT } from "@/features/admin-prefs/server";

// Shown immediately while a page of the panel loads (a navigation is already under way, so this is
// feedback, not a wait of its own). The skeleton rows keep the layout stable: no jump when data arrives.
export default async function Loading() {
  const { t } = await getT();
  return (
    <main id="content" className="wrap py-12" aria-busy="true">
      <p role="status" className="text-muted">{t("common.loading")}</p>
      <div aria-hidden="true" className="mt-6 grid gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-14" />)}
      </div>
    </main>
  );
}
