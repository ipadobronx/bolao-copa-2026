// Public env: keys with NEXT_PUBLIC_ prefix are inlined into both server and
// browser bundles by Next.js. Safe to import from Client Components.
// Server-only secrets (e.g. SUPABASE_SERVICE_ROLE_KEY) live in `./env-server.ts`
// behind `import 'server-only'`.
import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  console.error('❌ Invalid public environment variables:', fieldErrors);
  throw new Error(
    `Invalid public environment variables: ${JSON.stringify(fieldErrors)}. Check .env.local against .env.local.example.`,
  );
}

export const env = parsed.data;
