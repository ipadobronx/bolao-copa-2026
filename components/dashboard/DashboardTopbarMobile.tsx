'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { DashboardNav } from '@/components/dashboard/DashboardNav';

export type DashboardTopbarMobileProps = {
  nome: string;
  email: string;
};

export function DashboardTopbarMobile({ nome, email }: DashboardTopbarMobileProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <header className="bg-bg-dark/95 border-border fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b px-4 backdrop-blur-md md:hidden">
        <span className="font-display flex items-center gap-2 text-xl tracking-[2px]">
          <span
            aria-hidden="true"
            className="bg-accent text-bg-dark flex h-7 w-7 -rotate-[5deg] items-center justify-center rounded-md text-base font-black"
          >
            B
          </span>
          <span>
            BOLÃO<span className="text-accent">26</span>
          </span>
        </span>
        <Dialog.Trigger asChild>
          <button
            type="button"
            aria-label="Abrir menu"
            className="hover:bg-bg-elevated rounded-lg p-2"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </Dialog.Trigger>
      </header>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 md:hidden" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 outline-none md:hidden">
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <Dialog.Description className="sr-only">
            Navegação do painel do apostador
          </Dialog.Description>
          <DashboardNav onItemClick={() => setOpen(false)} showUser={{ nome, email }} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
