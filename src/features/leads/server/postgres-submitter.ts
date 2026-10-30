// Option B adapter: calls public.submit_lead() as the dedicated `lead_intake` Postgres role over a
// direct connection (LEAD_INTAKE_DATABASE_URL, via the Supabase shared pooler). SERVER ONLY: never
// import this from a client component (src/security-guard.test.ts enforces it).
//
// The driver is injected as a small `SqlRunner`, so the mapping logic is unit-tested without a
// network. The real runner is created lazily; nothing connects at import time or at build time.
//
// Errors are mapped to a few typed outcomes. The original error (which can carry host or role
// names) is never logged, returned or rethrown.
import postgres from "postgres";
import {
  InvalidProjectError,
  type LeadSubmitter,
  type SubmitLeadParams,
  type SubmitOutcome,
} from "../handler.ts";

export type SqlRunner = (text: string, params: (string | null)[]) => Promise<ReadonlyArray<Record<string, unknown>>>;

const SQL = "select public.submit_lead($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) as result";
const OUTCOMES: readonly string[] = ["created", "duplicate", "rate_limited"];

export class IntakeError extends Error {}

export function createLeadSubmitter(run: SqlRunner): LeadSubmitter {
  return {
    async submit(p: SubmitLeadParams): Promise<SubmitOutcome> {
      let rows: ReadonlyArray<Record<string, unknown>>;
      try {
        rows = await run(SQL, [
          p.firstName, p.lastName, p.phone, p.email, p.projectSlug, p.message, p.locale,
          p.utmSource, p.utmMedium, p.utmCampaign, p.landingPath, p.referrer, p.privacyNoticeVersion,
        ]);
      } catch (e) {
        const err = e as { code?: string; message?: string };
        // submit_lead raises SQLSTATE 22023 with the message "invalid_project" for an unknown,
        // inactive or unpublished project.
        if (err?.code === "22023" && err.message === "invalid_project") throw new InvalidProjectError();
        throw new IntakeError("submit_lead failed");
      }
      const result = rows[0]?.result;
      if (typeof result !== "string" || !OUTCOMES.includes(result)) throw new IntakeError("unexpected submit_lead result");
      return result as SubmitOutcome;
    },
  };
}

/** Real runner. Transaction-mode pooler friendly: no prepared statements, small pool, TLS required. */
export function createPostgresRunner(connectionUrl: string): SqlRunner {
  let sql: ReturnType<typeof postgres> | undefined;
  return async (text, params) => {
    sql ??= postgres(connectionUrl, {
      prepare: false, // required by the pooler's transaction mode
      max: 2,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: "require", // TODO: verify-full with Supabase's root certificate once the host is final
      onnotice: () => {},
    });
    return sql.unsafe(text, params);
  };
}
