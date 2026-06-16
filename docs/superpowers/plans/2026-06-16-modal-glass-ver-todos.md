# "Ver todos" + liquid glass no modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No modal de perfil, mostrar por padrão só o dia de jogo mais recente (resto atrás de "Ver todos os palpites") e dar ao modal um visual liquid glass com scrollbar discreta.

**Architecture:** Mudança só no client `PerfilModal` (estado `verTodos` + fatiar `agruparPorDia`) e uma classe utilitária `.scrollbar-glass` no `globals.css` (scrollbar fina + fade de bordas via mask). Sem tocar rota/helper/dados.

**Tech Stack:** Next.js 14 App Router, TS strict, Tailwind v4 (CSS-first, `globals.css`), `@radix-ui/react-dialog`, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-06-16-modal-glass-ver-todos-design.md`

---

## File structure
- Modify `app/globals.css` — classe `.scrollbar-glass`.
- Modify `components/ranking/PerfilModal.tsx` — `verTodos` + fatiamento + botão + classes glass.
- Modify `components/ranking/__tests__/PerfilModal.test.tsx` — teste do novo comportamento.

---

## Task 1: Classe `.scrollbar-glass` no globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Adicionar a classe no fim do arquivo**

Acrescente ao FINAL de `app/globals.css`:
```css

/* Scrollbar fina + fade líquido nas bordas (usada no modal de perfil). */
.scrollbar-glass {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent,
    #000 14px,
    #000 calc(100% - 14px),
    transparent
  );
  mask-image: linear-gradient(
    to bottom,
    transparent,
    #000 14px,
    #000 calc(100% - 14px),
    transparent
  );
}
.scrollbar-glass::-webkit-scrollbar {
  width: 6px;
}
.scrollbar-glass::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-glass::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.18);
  border-radius: 9999px;
}
.scrollbar-glass::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat(ranking): classe .scrollbar-glass (scrollbar fina + fade de bordas)"
```

*(O build que valida o CSS roda na Task 3.)*

---

## Task 2: `PerfilModal` — "Ver todos" + classes glass

**Files:**
- Modify: `components/ranking/PerfilModal.tsx`
- Modify: `components/ranking/__tests__/PerfilModal.test.tsx`

- [ ] **Step 1: Atualizar o teste de palpites (novo comportamento)**

Em `components/ranking/__tests__/PerfilModal.test.tsx`:

(a) Adicione `fireEvent` ao import do testing-library. A primeira linha vira:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
```

(b) Substitua o teste atual `it('mostra a seção de palpites nos jogos (finalizado + em andamento)', ...)` (inteiro) por:
```tsx
  it('mostra só o dia mais recente e revela o resto no "Ver todos"', async () => {
    mockFetch({
      campeao: null, artilheiro: null, tabelas: [], totalTabelas: 0,
      palpites: [
        { numeroJogo: 7, dataHora: '2026-06-13T22:00:00Z', casa: 'Brasil', fora: 'Marrocos', bandeiraCasa: null, bandeiraFora: null, palpiteCasa: 2, palpiteFora: 1, realCasa: 1, realFora: 1, finalizado: true, pontos: 2 },
        { numeroJogo: 15, dataHora: '2026-06-15T22:00:00Z', casa: 'Arábia Saudita', fora: 'Uruguai', bandeiraCasa: null, bandeiraFora: null, palpiteCasa: 1, palpiteFora: 1, realCasa: null, realFora: null, finalizado: false, pontos: null },
      ],
    })
    render(<PerfilModal entry={entry} total={100} onClose={() => {}} />)
    // dia mais recente (15/06) visível
    expect(await screen.findByText('Arábia Saudita')).toBeInTheDocument()
    expect(screen.getByText('em andamento')).toBeInTheDocument()
    // jogo do dia mais antigo (13/06) escondido até "Ver todos"
    expect(screen.queryByText('Brasil')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /ver todos os palpites/i }))
    expect(screen.getByText('Brasil')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run components/ranking/__tests__/PerfilModal.test.tsx`
Expected: FAIL — hoje a seção mostra TODOS os dias, então "Brasil" aparece de cara e não existe botão "Ver todos os palpites".

- [ ] **Step 3: Estado `verTodos` + reset no effect**

Em `PerfilModal.tsx`, troque o bloco de estado:
```tsx
  const [data, setData] = useState<PerfilData | null>(null)
  const [loading, setLoading] = useState(false)
  const bilheteId = entry?.melhorBilheteId ?? null
```
por:
```tsx
  const [data, setData] = useState<PerfilData | null>(null)
  const [loading, setLoading] = useState(false)
  const [verTodos, setVerTodos] = useState(false)
  const bilheteId = entry?.melhorBilheteId ?? null
```
E no início do corpo do `useEffect`, adicione `setVerTodos(false)` como primeira linha (antes do `if (!bilheteId)`):
```tsx
  useEffect(() => {
    setVerTodos(false)
    if (!bilheteId) {
      setData(null)
      return
    }
```
*(O resto do effect fica igual.)*

- [ ] **Step 4: Calcular `grupos` após o `selo`**

Logo após a linha `const selo = entry ? tituloDesempenho(entry.posicao, total) : null`, adicione:
```tsx
  const grupos = data ? agruparPorDia(data.palpites) : []
  const gruposVisiveis = verTodos ? grupos : grupos.slice(0, 1)
  const escondidos = grupos.slice(1).reduce((n, g) => n + g.jogos.length, 0)
```

- [ ] **Step 5: Trocar a seção de palpites por uma fatiada + botão**

Substitua o bloco INTEIRO `{data && data.palpites.length > 0 && ( ... )}` (a seção "Palpites nos jogos") por:
```tsx
              {grupos.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">Palpites nos jogos</div>
                  {gruposVisiveis.map((grupo) => (
                    <div key={grupo.dia} className="space-y-1">
                      <div className="font-mono text-[10px] text-text-muted">{grupo.label}</div>
                      {grupo.jogos.map((j) => (
                        <div key={j.numeroJogo} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center gap-1">
                            <BandeiraImg emoji={j.bandeiraCasa} nome={j.casa} size={14} />
                            <span className="truncate">{j.casa}</span>
                            {j.palpiteCasa != null && j.palpiteFora != null ? (
                              <strong className="px-1 tabular-nums">{j.palpiteCasa}×{j.palpiteFora}</strong>
                            ) : (
                              <span className="px-1 text-text-muted">— sem palpite</span>
                            )}
                            <span className="truncate">{j.fora}</span>
                            <BandeiraImg emoji={j.bandeiraFora} nome={j.fora} size={14} />
                          </span>
                          <span className="shrink-0 font-mono text-text-muted">
                            {j.finalizado ? (
                              <>
                                real {j.realCasa}×{j.realFora}
                                {j.palpiteCasa != null && (
                                  <strong className="text-accent"> · +{j.pontos ?? 0}</strong>
                                )}
                              </>
                            ) : (
                              'em andamento'
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {grupos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setVerTodos((v) => !v)}
                      className="w-full rounded-lg border border-white/10 py-1.5 text-xs font-semibold text-text-muted hover:text-text-primary"
                    >
                      {verTodos ? 'Ver menos' : `Ver todos os palpites (+${escondidos})`}
                    </button>
                  )}
                </div>
              )}
```
*(Conteúdo de cada jogo idêntico ao atual; muda só: itera `gruposVisiveis` em vez de `agruparPorDia(...)`, e adiciona o botão.)*

- [ ] **Step 6: Classes liquid glass no `Dialog.Content`**

Troque a className do `Dialog.Content`. De:
```tsx
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[#1f1f23] bg-[#0c0c0e] p-5 text-text-primary outline-none">
```
para:
```tsx
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-[#0c0c0e]/70 p-5 text-text-primary shadow-2xl shadow-black/50 outline-none backdrop-blur-2xl scrollbar-glass">
```

- [ ] **Step 7: Rodar testes + typecheck**

Run: `npx tsc --noEmit && npx vitest run components/ranking/__tests__/PerfilModal.test.tsx`
Expected: tsc limpo; 4 testes passam (o reescrito + os 3 antigos). Avisos de `act()` do Radix são cosméticos.

- [ ] **Step 8: Commit**

```bash
git add components/ranking/PerfilModal.tsx components/ranking/__tests__/PerfilModal.test.tsx
git commit -m "feat(ranking): modal mostra só o dia recente (+Ver todos) e ganha liquid glass"
```

---

## Task 3: Verificação final

- [ ] **Step 1: tsc + lint + testes + build**

Run:
```bash
npx tsc --noEmit && npx eslint components/ranking && npx vitest run && npx next build
```
Expected: tudo limpo; suíte verde; `✓ Compiled successfully` (valida que o CSS de `.scrollbar-glass` compila no Tailwind v4).

- [ ] **Step 2: Checagem manual em `/ranking`**

- Abrir o modal de quem tem jogos em vários dias: por padrão só o **dia mais recente** aparece; botão "Ver todos os palpites (+N)" revela o resto e vira "Ver menos".
- Trocar de apostador (fechar/abrir outro) reinicia colapsado.
- Visual: modal fosco (vidro), borda sutil, scrollbar fina translúcida; conteúdo "derrete" no topo/baixo ao rolar; cabeçalho (avatar) e botão "Fechar" não ficam apagados em repouso.

---

## Fora de escopo
- Mexer em rota/helper/dados de palpites.
- Aplicar o glass em outros modais/telas.
