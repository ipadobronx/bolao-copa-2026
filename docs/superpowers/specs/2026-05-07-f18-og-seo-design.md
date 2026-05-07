# Feature 18 — Open Graph image dinâmica + SEO completo

**Data:** 2026-05-07
**Status:** Aprovado para implementação
**Autor:** Spec direto (sem brainstorming pesado, escopo bem-definido pelo Jonatas)
**Próximo passo:** plan F18 → execução inline → PR squash final

---

## 1. Contexto e motivação

Décima oitava feature da seção 5 do `CLAUDE.md`. F1–F17 entregues (F17 ainda em PR aberto na hora deste spec — F18 é cortada de `feat/f17-termos-privacidade` por dependência das pages `termos/` e `privacidade/`; rebase em `main` quando F17 mergear).

Sistema em produção em `https://malanacopa.com.br`. Hoje, qualquer link do site compartilhado em WhatsApp / Instagram / X / LinkedIn aparece sem preview rico — só a URL, sem imagem, título genérico ("Bolão Copa 2026"), sem descrição. O resultado é menos clique, menos viralização orgânica, fricção desnecessária pra conversão.

Esta feature entrega o pacote SEO/OG completo:

- **Imagem OG dinâmica** server-rendered (1200×630) gerada pelo Next via `ImageResponse`.
- **Metadata global** rica em `app/layout.tsx` (title.template, description, keywords, openGraph, twitter, robots).
- **Favicon e apple-icon** dinâmicos via `app/icon.tsx` / `app/apple-icon.tsx`.
- **Metadata específico por rota** em `termos/` e `privacidade/`.
- **`robots.ts` e `sitemap.ts`** pra indexação correta em buscadores.
- **Validação manual** pós-deploy via opengraph.xyz, twitter validator e teste real no WhatsApp.

---

## 2. Decisões técnicas registradas

| # | Pergunta | Escolha | Motivação |
|---|----------|---------|-----------|
| Q1 | Bebas Neue na OG image — fetch Google Fonts ou fallback? | **Fetch via Google Fonts CSS API com fallback graceful pra system font.** Se o fetch falhar (503, parsing) o `ImageResponse` ainda renderiza com sans-serif default, sem crashar a edge function. | Brand consistency vale a pena, mas CDN externa não pode bloquear a feature crítica de OG. Try/catch + fallback. |
| Q2 | Bandeiras das 13 seleções de cashback no rodapé? | **Sim, via `<img src="https://flagcdn.com/w40/{iso}.png" />` em linha única.** Sem fallback se flagcdn cair — preview sai sem bandeiras, mas headline + URL ainda aparecem. | User pediu explicitamente. flagcdn é estável e leve (40px PNGs ≈ 1kb cada × 13 = ~13kb). Fica dentro do budget edge (1MB). |
| Q3 | Inglaterra no flagcdn — `gb` ou `gb-eng`? | **`gb-eng`** (flag inglesa real, não Union Jack). | Bolão é da Copa do Mundo FIFA — Inglaterra joga separado da Escócia/Gales. `gb-eng` existe no flagcdn. |
| Q4 | Title.template no root — sufixo "· Mala na Copa"? | **Sim, `template: '%s · Mala na Copa'`.** Subpages declaram só o prefixo (`'Termos de Uso'`, `'Política de Privacidade'`). | Consistência. F17 declarou title completo (`'Termos de Uso · Mala na Copa'`) — F18 ajusta pra usar template, evitando duplicação se futuramente o sufixo mudar. |
| Q5 | Cache da OG image — revalidate? | **Sem `revalidate` (default Next: imagem cacheia por 1 ano via headers do Vercel CDN).** Se quisermos atualizar, basta novo deploy (URL muda via hash de build). | OG image não muda com state do banco — é estática por deploy. Cachear forte é o comportamento certo. |
| Q6 | Tamanho do icon dinâmico vs PNG estático? | **Dinâmico via TSX.** Não temos `public/` no projeto, e adicionar PNGs estáticos só pra favicon não compensa. Edge function de 32×32 é trivial. | Mantém o projeto limpo, sem assets binários no repo. |
| Q7 | Sitemap inclui rotas autenticadas? | **Não. Apenas `/`, `/login`, `/termos`, `/privacidade`.** | `/dashboard`, `/comprar/*`, `/admin/*`, `/ranking/*` exigem auth ou são dinâmicas — não fazem sentido em sitemap público. |
| Q8 | Tests automatizados? | **Não.** OG image e metadata são artefatos visuais — testes unitários não capturam o problema (fonte feia, layout quebrado, preview ruim). Validação manual via opengraph.xyz + WhatsApp real. | Custo/benefício ruim. Smoke test de "endpoint retorna 200" é tautológico — Next garante isso. |

---

## 3. Arquivos novos e modificados

### 3.1 Modificados

| Arquivo | Mudança |
|---------|---------|
| `app/layout.tsx` | Reescreve `metadata` exportado: adiciona `metadataBase`, `title.template`, `description` longa, `keywords`, `openGraph`, `twitter`, `robots`. Remove o objeto antigo de 5 linhas. |
| `app/(public)/termos/page.tsx` | Ajusta `metadata.title` de `'Termos de Uso · Mala na Copa'` pra `'Termos de Uso'` (template global aplica sufixo). |
| `app/(public)/privacidade/page.tsx` | Idem — `'Política de Privacidade'` sem sufixo. |

### 3.2 Novos

| Arquivo | Propósito |
|---------|-----------|
| `app/opengraph-image.tsx` | OG image 1200×630 dinâmica (edge runtime). Fonte Bebas Neue via fetch + fallback. |
| `app/icon.tsx` | Favicon 32×32 dinâmico — "M" amarela em fundo dark. |
| `app/apple-icon.tsx` | Apple touch icon 180×180 — mesma identidade. |
| `app/robots.ts` | `MetadataRoute.Robots` com allow `/` e disallow `/admin`, `/api`. Aponta sitemap. |
| `app/sitemap.ts` | `MetadataRoute.Sitemap` com 4 rotas públicas. |
| `docs/superpowers/specs/2026-05-07-f18-og-seo-design.md` | Este spec. |
| `docs/superpowers/plans/2026-05-07-f18-og-seo.md` | Plan de execução. |

---

## 4. Conteúdo da OG image (referência visual)

Layout vertical em 1200×630, área útil com padding de ~80px lateral e 60px vertical:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  MALA na COPA                              ● AO VIVO        │  ← top: wordmark 64px + dot verde
│                                                             │
│                                                             │
│                                                             │
│              R$ 10.000                                      │  ← center: 180px, accent #facc15
│              EM PRÊMIOS                                     │     2 linhas, Bebas Neue tight
│                                                             │
│         Bolão da Copa 2026 · PIX · Top 3 leva tudo          │  ← sub: 28px, body white
│                                                             │
│                                                             │
│  🇫🇷 🇪🇸 🇬🇧 🇧🇷 🇦🇷 🇵🇹 🇩🇪 🇳🇱 🇳🇴 🇨🇭 🇧🇪 🇨🇴 🇺🇾                  │  ← bandeiras row
│                                                             │
│                              malanacopa.com.br              │  ← footer: mono 24px
└─────────────────────────────────────────────────────────────┘
```

**Cores (alinhadas com `globals.css`):**

- Background: gradient `from-#0a0e1a to-#111827` com radial verde-amarelo sutil no canto sup-direito.
- Wordmark "MALA na COPA": branco `#f8fafc`, Bebas Neue tracking-wide.
- Headline "R$ 10.000": amarelo `#facc15`, Bebas Neue.
- Sub-headline: cinza claro `#cbd5e1`.
- AO VIVO: dot verde `#10b981` + texto `#10b981` em mono.
- Footer URL: mono cinza `#94a3b8`.

**ISO codes do flagcdn (na ordem visual acima — tier 1× → 2× → 3× → 5×):**

`fr`, `es`, `gb-eng`, `br`, `ar`, `pt`, `de`, `nl`, `no`, `ch`, `be`, `co`, `uy`

URLs: `https://flagcdn.com/w40/{iso}.png`

---

## 5. Conteúdo dos icons

### 5.1 `app/icon.tsx` (32×32)

- Background: `#0a0e1a` (bg-dark do projeto).
- Letra "M" central em Bebas Neue ~24px, cor `#facc15`.
- Border-radius implícito do navegador.

### 5.2 `app/apple-icon.tsx` (180×180)

- Mesmas cores.
- Letra "M" central em Bebas Neue ~140px.
- Sem border-radius (iOS aplica máscara).

Ambos compartilham a mesma estrutura — diferem só em `size`.

---

## 6. Estrutura do `robots.ts` e `sitemap.ts`

Especificadas literalmente no brief do Jonatas. Ver §5 e §6 do prompt original. Implementação inline:

```ts
// app/robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }],
    sitemap: 'https://malanacopa.com.br/sitemap.xml',
  };
}
```

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://malanacopa.com.br';
  const lastModified = new Date();
  return [
    { url: base, lastModified, priority: 1 },
    { url: `${base}/login`, lastModified, priority: 0.8 },
    { url: `${base}/termos`, lastModified, priority: 0.5 },
    { url: `${base}/privacidade`, lastModified, priority: 0.5 },
  ];
}
```

---

## 7. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Fetch Google Fonts falha em build/edge | Try/catch — sem fonts custom, ImageResponse cai pra system sans. Visual menos refinado, mas funciona. |
| flagcdn.com indisponível no momento da geração | ImageResponse renderiza imagem ainda assim — `<img>` quebrada some, layout flexbox absorve. Headline + URL preservam a mensagem. |
| Edge function size limit (1MB) | 13 PNGs de 40px (~13kb) + Bebas woff2 (~12kb) = bem abaixo do limite. Sem risco. |
| Cache antigo nas redes sociais após deploy | WhatsApp/Twitter/Facebook cacheiam previews por dias. Validação inicial com `?v=1` no fim da URL pra forçar re-fetch. |
| Title duplicado se F17 mergear depois com sufixo antigo | F18 PR depende de F17 em branch. Após F17 merge, F18 rebase em main e o ajuste em termos/privacidade já está embutido. |
| Build local não consegue acessar Google Fonts | Edge runtime em dev tem fetch — funciona. Se isolated/offline, fallback graceful. |

---

## 8. Validação pós-deploy

Não há tests automatizados. Validação manual em ordem:

1. **Build local**: `pnpm typecheck && pnpm lint && pnpm build` — sem erros.
2. **Dev server**: `pnpm dev` → abrir `http://localhost:3000/opengraph-image` → confere imagem renderizada.
3. **Vercel preview**: PR cria preview deploy automático.
4. **opengraph.xyz**: colar URL do preview → conferir todos os campos OG/Twitter.
5. **Twitter validator**: cards-dev.twitter.com/validator (legacy mas ainda útil).
6. **WhatsApp real**: enviar URL pra contato pessoal → preview deve ter imagem + título + descrição.
7. **Lighthouse SEO**: rodar em `/` e `/termos` → score > 95.

---

## 9. Critérios de aceite

- [ ] `app/opengraph-image.tsx` renderiza imagem 1200×630 em edge runtime sem warnings.
- [ ] `app/icon.tsx` e `app/apple-icon.tsx` renderizam corretamente.
- [ ] `app/layout.tsx` exporta metadata com `metadataBase`, `title.template`, `openGraph`, `twitter`, `robots` corretos.
- [ ] `app/(public)/termos/page.tsx` e `privacidade/page.tsx` declaram só o prefixo do title.
- [ ] `app/robots.ts` e `app/sitemap.ts` retornam estruturas válidas.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` — todos verde.
- [ ] Preview deploy do PR mostra OG correto em opengraph.xyz.
- [ ] PR squash mergeado em main após F17 mergear.

---

## 10. Fora de escopo

- Imagens OG diferentes por rota (ex: ranking, termos). Pode ser feature futura se houver demanda — root opengraph-image.tsx aplica como fallback pra todas.
- JSON-LD structured data (schema.org). SEO incremental — pode ser F19 se útil.
- Sitemap dinâmico (rotas dinâmicas como `/ranking/[bilheteId]`). Não faz sentido sitemap-ar perfis públicos por enquanto.
- PWA manifest (`manifest.ts`). Outra feature, fora do escopo de SEO.

---

Vamos sempre à luta. ⚽🏆
