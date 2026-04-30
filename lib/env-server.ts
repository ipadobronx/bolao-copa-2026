import 'server-only';
import { z } from 'zod';

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  MERCADOPAGO_ACCESS_TOKEN: z.string().min(1),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().min(1),
});

const parsed = schema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN,
  MERCADOPAGO_WEBHOOK_SECRET: process.env.MERCADOPAGO_WEBHOOK_SECRET,
});

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  console.error('❌ Invalid server environment variables:', fieldErrors);
  throw new Error(
    `Invalid server environment variables: ${JSON.stringify(fieldErrors)}. Check .env.local against .env.local.example.`,
  );
}

export const serverEnv = parsed.data;
