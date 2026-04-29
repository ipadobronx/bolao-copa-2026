import { NextResponse } from 'next/server';

export async function GET() {
  // Handler real entra na Feature 4 (auth).
  // Por enquanto só responde 501 pra não confundir com sucesso.
  return NextResponse.json(
    { error: 'auth callback not implemented yet — see Feature 4' },
    { status: 501 },
  );
}
