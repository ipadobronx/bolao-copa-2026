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
  title: 'Bolão Copa 2026',
  description: 'Bolão da Copa do Mundo FIFA 2026.',
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
