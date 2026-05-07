'use client';

import { useEffect } from 'react';
import { captureAffiliateRef } from '@/lib/afiliados/track';

/**
 * Captura `?ref=codigo` da URL no mount e persiste em localStorage (TTL 30d).
 * Inserir no app/layout.tsx pra cobrir todas as rotas (landing, dashboard, etc.).
 * Não renderiza nada.
 */
export function AffiliateRefCapture() {
  useEffect(() => {
    captureAffiliateRef();
  }, []);

  return null;
}
