'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'

export type TabelaPalpite = { id: string; numero: number; pontos: number }

export function PalpitarButton({ jogoId, tabelas }: { jogoId: number; tabelas: TabelaPalpite[] }) {
  const [open, setOpen] = useState(false)

  if (tabelas.length === 0) {
    return (
      <Link href={'/comprar' as Route} className="btn-sm">
        Palpitar
      </Link>
    )
  }

  if (tabelas.length === 1) {
    return (
      <Link href={`/palpites/${tabelas[0]!.id}?jogo=${jogoId}` as Route} className="btn-sm">
        Palpitar
      </Link>
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="btn-sm">Palpitar</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#1b1b1e] bg-[#08080a] p-5 text-text-primary outline-none">
          <Dialog.Title className="mb-1 text-base font-bold">Qual tabela?</Dialog.Title>
          <Dialog.Description className="mb-3 text-xs text-text-muted">
            Escolha a tabela pra palpitar nesse jogo.
          </Dialog.Description>
          <div className="space-y-2">
            {tabelas.map((t) => (
              <Link
                key={t.id}
                href={`/palpites/${t.id}?jogo=${jogoId}` as Route}
                className="bg-bg-elevated border-border hover:border-border-strong flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm"
              >
                <span className="font-semibold">Tabela nº{t.numero}</span>
                <span className="font-mono text-text-muted">
                  <strong className="text-accent">{t.pontos}</strong> pts
                </span>
              </Link>
            ))}
          </div>
          <Dialog.Close className="mt-4 w-full rounded-lg bg-bg-elevated py-2 text-sm font-semibold text-text-muted hover:text-text-primary">
            Fechar
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
