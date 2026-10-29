import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Locale routing for public pages only. /admin, /api and static files are excluded.
  matcher: "/((?!api|admin|_next|_vercel|.*\..*).*)",
};
