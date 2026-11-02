import Link from "next/link";
import { getT } from "@/features/admin-prefs/server";

export default async function AdminNotFound() {
  const { t } = await getT();
  return (
    <main id="content" className="wrap py-16">
      <h1 className="display text-4xl">{t("nf.title")}</h1>
      <p className="mt-3 max-w-xl text-muted">{t("nf.text")}</p>
      <Link href="/admin/leads" className="btn btn-primary mt-6">{t("nf.back")}</Link>
    </main>
  );
}
