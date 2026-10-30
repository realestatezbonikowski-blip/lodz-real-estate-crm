import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <main id="content" className="wrap py-24">
      <h1 className="display text-5xl sm:text-6xl">{t("title")}</h1>
      <p className="mt-4 max-w-xl text-muted">{t("body")}</p>
      <Link href="/" className="btn btn-primary mt-8">{t("back")}</Link>
    </main>
  );
}
