import type { Metadata } from 'next';
import { Bebas_Neue, Archivo, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
});

const archivo = Archivo({
  weight: ['400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://malanacopa.com.br'),
  title: {
    default: 'Mala na Copa 2026 — Bolão da Copa do Mundo FIFA',
    template: '%s · Mala na Copa',
  },
  description:
    'R$ 10.000 em prêmios. Bolão da Copa do Mundo 2026 com palpites rodada por rodada, ranking ao vivo, PIX e cashback até 5× em seleções azarões.',
  keywords: [
    'bolão copa do mundo 2026',
    'bolão FIFA',
    'bolão amigos online',
    'palpite copa do mundo',
    'bolão R$ 10.000',
    'bolão PIX',
  ],
  authors: [{ name: 'Equipe Mala na Copa' }],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://malanacopa.com.br',
    siteName: 'Mala na Copa',
    title: 'Mala na Copa 2026 — Bolão da Copa do Mundo FIFA',
    description:
      'R$ 10.000 em prêmios. Bolão da Copa do Mundo 2026 com palpites rodada por rodada e cashback até 5×.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mala na Copa 2026',
    description: 'R$ 10.000 em prêmios · Bolão da Copa 2026',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${bebasNeue.variable} ${archivo.variable} ${jetBrainsMono.variable}`}
    >
      <body>
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: 'font-body',
            },
          }}
        />
      </body>
    </html>
  );
}
