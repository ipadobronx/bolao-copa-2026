import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt =
  'Mala na Copa — Bolão da Copa do Mundo 2026 · R$ 10.000 em prêmios';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const FLAGS_ISO = [
  'fr',
  'es',
  'gb-eng',
  'br',
  'ar',
  'pt',
  'de',
  'nl',
  'no',
  'ch',
  'be',
  'co',
  'uy',
] as const;

async function loadBebasNeue(): Promise<ArrayBuffer | null> {
  try {
    const cssRes = await fetch(
      'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap',
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const fontUrl = css.match(/url\((https:\/\/[^)]+\.(?:woff2|ttf))\)/)?.[1];
    if (!fontUrl) return null;
    const fontRes = await fetch(fontUrl);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const bebas = await loadBebasNeue();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            'radial-gradient(circle at 85% 15%, rgba(16,185,129,0.18) 0%, transparent 45%), linear-gradient(135deg, #0a0e1a 0%, #111827 100%)',
          padding: '60px 80px',
          fontFamily: bebas ? 'Bebas Neue' : 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              color: '#f8fafc',
              fontSize: 64,
              letterSpacing: '0.04em',
              display: 'flex',
            }}
          >
            MALA na COPA
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: '#10b981',
              }}
            />
            <div
              style={{
                color: '#10b981',
                fontSize: 22,
                fontFamily: 'monospace',
                letterSpacing: '0.1em',
                display: 'flex',
              }}
            >
              RANKING AO VIVO
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            gap: 20,
          }}
        >
          <div
            style={{
              color: '#facc15',
              fontSize: 180,
              lineHeight: 0.9,
              letterSpacing: '-0.02em',
              display: 'flex',
            }}
          >
            R$ 10.000
          </div>
          <div
            style={{
              color: '#f8fafc',
              fontSize: 64,
              letterSpacing: '0.04em',
              display: 'flex',
            }}
          >
            EM PRÊMIOS
          </div>
          <div
            style={{
              color: '#cbd5e1',
              fontSize: 30,
              fontFamily: 'sans-serif',
              marginTop: 20,
              display: 'flex',
            }}
          >
            Bolão da Copa 2026 · PIX · Top 3 leva tudo
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              display: 'flex',
              gap: 14,
              justifyContent: 'center',
            }}
          >
            {FLAGS_ISO.map((iso) => (
              <img
                key={iso}
                src={`https://flagcdn.com/w40/${iso}.png`}
                width={48}
                height={32}
                style={{ borderRadius: 4 }}
                alt=""
              />
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              color: '#94a3b8',
              fontFamily: 'monospace',
              fontSize: 24,
            }}
          >
            malanacopa.com.br
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: bebas
        ? [{ name: 'Bebas Neue', data: bebas, style: 'normal', weight: 400 }]
        : [],
    },
  );
}
