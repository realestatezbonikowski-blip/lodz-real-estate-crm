# Supabase project: how to verify URL, region and keys safely

You never need to paste a key or password into chat. Add values to `.env.local` yourself, in your editor.
The Supabase dashboard layout changes over time, so if a menu name differs, search the dashboard for the item.

## 1. Project URL

Dashboard → your project → **Project Settings → API** (or the "Connect" button). The URL looks like
`https://<20-character-ref>.supabase.co`. The 20-character part is the project ref.

## 2. Region

Dashboard → **Project Settings → General**. The dev project's region is **West EU (Ireland), `eu-west-1`**
(confirmed by the owner; it stays as is). The URL does not reveal the region, and a region **cannot be changed**
after creation (it means building a new project and migrating). The production project is a separate decision;
choose its region deliberately, with the data controller, before it is created.

## 3. Keys: which one is safe

Dashboard → **Project Settings → API Keys**.

| Key | Looks like | Browser-safe? | Where it goes |
|---|---|---|---|
| **Publishable key** | `sb_publishable_...` | ✅ Yes, designed for it (safe only because RLS is default-deny) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Legacy `anon` key | long JWT (`eyJ...`) | ✅ Same role as the publishable key | same variable, only if no publishable key exists |
| **Secret key** | `sb_secret_...` | ❌ **Never** | `SUPABASE_SECRET_KEY`, server only, Phase 3 onward, never with a `NEXT_PUBLIC_` prefix |
| Legacy `service_role` key | long JWT | ❌ **Never** | same as secret key |
| Database password | chosen at creation | ❌ **Never in the repo or chat** | Your password manager. Typed into the CLI when linking |

## 4. Adding the values yourself

1. In VS Code, copy `.env.example` to a new file named `.env.local` in the project root. It is git-ignored.
2. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Leave `SUPABASE_SECRET_KEY` unset for now.
3. Run `npm run check:env`. It prints only variable names and ✔/✖, never values. It checks that:
   - the three required variables are filled;
   - the URL has the right shape;
   - the public key is a publishable (or legacy anon) key, not a secret or `service_role` key;
   - no `NEXT_PUBLIC_` variable looks like a secret.

## 5. Auth settings to confirm before staff accounts exist

- Email signups **disabled** (Authentication → sign-in/providers settings).
- Site URL and redirect URLs set to `http://localhost:3000` for development.
- TOTP MFA available (Authentication → MFA).
- Data API exposes only the `public` schema (Project Settings → API / Data API). Do not add `private`.
- If you do not plan to use GraphQL, check whether it can be disabled.
