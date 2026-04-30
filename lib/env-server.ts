import 'server-only';
import { z } from 'zod';

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const parsed = schema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  console.error('❌ Invalid server environment variables:', fieldErrors);
  throw new Error(
    `Invalid server environment variables: ${JSON.stringify(fieldErrors)}. Check .env.local against .env.local.example.`,
  );
}

export const serverEnv = parsed.data;
