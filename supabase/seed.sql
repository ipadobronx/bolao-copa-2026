-- ============================================================================
-- Bolão Copa 2026 — Seed Data
-- ============================================================================
-- Sources:
--   - FIFA 2026 final draw (Kennedy Center, 5 dez 2025)
--   - Inter-confederation playoff results (mar 2026)
--   - FIFA / Wikipedia official match calendar (104 jogos)
--   - Cross-checked: Wikipedia (en.wikipedia.org/wiki/2026_FIFA_World_Cup,
--     2026_FIFA_World_Cup_knockout_stage), CNN, ESPN, Yahoo Sports
--
-- Confirmed: Brasil (BRA) no Grupo C com Marrocos (MAR), Haiti (HAI) e
--            Escócia (SCO).
--
-- Sedes: 16 cidades em EUA (11), México (3) e Canadá (2). Estádios em
--        Eastern Time (-04 verão) na maioria dos jogos; sedes mexicanas
--        usam horário local mas FIFA publica em ET — adotamos ET (-04)
--        para o seed e o usuário valida data/hora antes do go-live.
--
-- Idempotência: este seed assume tabelas vazias (rodado pós `supabase db
-- reset`). Re-rodar sem TRUNCATE falha nas constraints UNIQUE — é o
-- comportamento esperado, força reset explícito.
-- ============================================================================

-- ============================================================================
-- 1. SELECOES (48 nações, sorteio FIFA 5 dez 2025)
-- ============================================================================
-- Ordem dos INSERTs determina os IDs auto-incrementados (smallserial):
--   Grupo A → IDs 1-4    Grupo B → 5-8     Grupo C → 9-12
--   Grupo D → 13-16      Grupo E → 17-20   Grupo F → 21-24
--   Grupo G → 25-28      Grupo H → 29-32   Grupo I → 33-36
--   Grupo J → 37-40      Grupo K → 41-44   Grupo L → 45-48
-- Nomes em pt-BR. Códigos ISO 3166-1 alfa-3 (FIFA tri-letter). Bandeiras
-- como pares de regional indicators (Escócia / Inglaterra usam emoji de
-- subdivisão).
-- ============================================================================

INSERT INTO selecoes (nome, codigo_iso, bandeira_emoji, grupo) VALUES
  -- Grupo A
  ('México',          'MEX', '🇲🇽', 'A'),
  ('África do Sul',   'RSA', '🇿🇦', 'A'),
  ('Coreia do Sul',   'KOR', '🇰🇷', 'A'),
  ('República Tcheca','CZE', '🇨🇿', 'A'),

  -- Grupo B
  ('Canadá',                'CAN', '🇨🇦', 'B'),
  ('Bósnia e Herzegovina',  'BIH', '🇧🇦', 'B'),
  ('Catar',                 'QAT', '🇶🇦', 'B'),
  ('Suíça',                 'SUI', '🇨🇭', 'B'),

  -- Grupo C — CONFIRMADO
  ('Brasil',   'BRA', '🇧🇷', 'C'),
  ('Marrocos', 'MAR', '🇲🇦', 'C'),
  ('Haiti',    'HAI', '🇭🇹', 'C'),
  ('Escócia',  'SCO', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'C'),

  -- Grupo D
  ('Estados Unidos', 'USA', '🇺🇸', 'D'),
  ('Paraguai',       'PAR', '🇵🇾', 'D'),
  ('Austrália',      'AUS', '🇦🇺', 'D'),
  ('Turquia',        'TUR', '🇹🇷', 'D'),

  -- Grupo E
  ('Alemanha',     'GER', '🇩🇪', 'E'),
  ('Curaçao',      'CUW', '🇨🇼', 'E'),
  ('Costa do Marfim', 'CIV', '🇨🇮', 'E'),
  ('Equador',      'ECU', '🇪🇨', 'E'),

  -- Grupo F
  ('Países Baixos', 'NED', '🇳🇱', 'F'),
  ('Japão',         'JPN', '🇯🇵', 'F'),
  ('Suécia',        'SWE', '🇸🇪', 'F'),
  ('Tunísia',       'TUN', '🇹🇳', 'F'),

  -- Grupo G
  ('Bélgica',       'BEL', '🇧🇪', 'G'),
  ('Egito',         'EGY', '🇪🇬', 'G'),
  ('Irã',           'IRN', '🇮🇷', 'G'),
  ('Nova Zelândia', 'NZL', '🇳🇿', 'G'),

  -- Grupo H
  ('Espanha',       'ESP', '🇪🇸', 'H'),
  ('Cabo Verde',    'CPV', '🇨🇻', 'H'),
  ('Arábia Saudita','KSA', '🇸🇦', 'H'),
  ('Uruguai',       'URU', '🇺🇾', 'H'),

  -- Grupo I
  ('França',  'FRA', '🇫🇷', 'I'),
  ('Senegal', 'SEN', '🇸🇳', 'I'),
  ('Iraque',  'IRQ', '🇮🇶', 'I'),
  ('Noruega', 'NOR', '🇳🇴', 'I'),

  -- Grupo J
  ('Argentina', 'ARG', '🇦🇷', 'J'),
  ('Argélia',   'ALG', '🇩🇿', 'J'),
  ('Áustria',   'AUT', '🇦🇹', 'J'),
  ('Jordânia',  'JOR', '🇯🇴', 'J'),

  -- Grupo K
  ('Portugal',       'POR', '🇵🇹', 'K'),
  ('R. D. do Congo', 'COD', '🇨🇩', 'K'),
  ('Uzbequistão',    'UZB', '🇺🇿', 'K'),
  ('Colômbia',       'COL', '🇨🇴', 'K'),

  -- Grupo L
  ('Inglaterra', 'ENG', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'L'),
  ('Croácia',    'CRO', '🇭🇷', 'L'),
  ('Gana',       'GHA', '🇬🇭', 'L'),
  ('Panamá',     'PAN', '🇵🇦', 'L');

-- ============================================================================
-- 2. JOGOS (104 partidas — 72 grupos + 32 mata-mata)
-- ============================================================================
-- IDs de selecao referenciados acima (1-48). Datas/horas em ET (-04, EDT).
-- Chaves placeholder no mata-mata seguem o padrão FIFA:
--   1X / 2X = 1º / 2º colocado do grupo X
--   3X/Y/Z   = 3º colocado vindo de um pool de grupos
--   V Jnn    = vencedor do jogo nn  |  P Jnn = perdedor do jogo nn
-- Rodada 3 da fase de grupos: jogos do mesmo grupo ocorrem em horário
-- simultâneo (regra anti-conluio FIFA).
-- ============================================================================

INSERT INTO jogos (numero_jogo, fase, data_hora, selecao_casa_id, selecao_fora_id, placeholder_casa, placeholder_fora) VALUES
  -- ---------------------------------------------------------------------------
  -- FASE DE GRUPOS — Rodada 1 (11-17 jun)
  -- ---------------------------------------------------------------------------
  (1,  'grupos', '2026-06-11 15:00:00-04',  1,  2, NULL, NULL), -- México x África do Sul
  (2,  'grupos', '2026-06-11 22:00:00-04',  3,  4, NULL, NULL), -- Coreia do Sul x R. Tcheca
  (3,  'grupos', '2026-06-12 15:00:00-04',  5,  6, NULL, NULL), -- Canadá x Bósnia
  (4,  'grupos', '2026-06-12 21:00:00-04', 13, 14, NULL, NULL), -- EUA x Paraguai
  (5,  'grupos', '2026-06-13 00:00:00-04', 15, 16, NULL, NULL), -- Austrália x Turquia
  (6,  'grupos', '2026-06-13 15:00:00-04',  7,  8, NULL, NULL), -- Catar x Suíça
  (7,  'grupos', '2026-06-13 18:00:00-04',  9, 10, NULL, NULL), -- Brasil x Marrocos
  (8,  'grupos', '2026-06-13 21:00:00-04', 11, 12, NULL, NULL), -- Haiti x Escócia
  (9,  'grupos', '2026-06-14 13:00:00-04', 17, 18, NULL, NULL), -- Alemanha x Curaçao
  (10, 'grupos', '2026-06-14 16:00:00-04', 21, 22, NULL, NULL), -- Países Baixos x Japão
  (11, 'grupos', '2026-06-14 19:00:00-04', 23, 24, NULL, NULL), -- Suécia x Tunísia
  (12, 'grupos', '2026-06-14 22:00:00-04', 19, 20, NULL, NULL), -- Costa do Marfim x Equador -- TODO confirmar data/hora
  (13, 'grupos', '2026-06-15 12:00:00-04', 29, 30, NULL, NULL), -- Espanha x Cabo Verde
  (14, 'grupos', '2026-06-15 15:00:00-04', 25, 26, NULL, NULL), -- Bélgica x Egito
  (15, 'grupos', '2026-06-15 18:00:00-04', 31, 32, NULL, NULL), -- Arábia Saudita x Uruguai
  (16, 'grupos', '2026-06-15 21:00:00-04', 27, 28, NULL, NULL), -- Irã x Nova Zelândia
  (17, 'grupos', '2026-06-16 15:00:00-04', 33, 34, NULL, NULL), -- França x Senegal
  (18, 'grupos', '2026-06-16 18:00:00-04', 35, 36, NULL, NULL), -- Iraque x Noruega
  (19, 'grupos', '2026-06-16 21:00:00-04', 37, 38, NULL, NULL), -- Argentina x Argélia
  (20, 'grupos', '2026-06-17 00:00:00-04', 39, 40, NULL, NULL), -- Áustria x Jordânia
  (21, 'grupos', '2026-06-17 13:00:00-04', 41, 42, NULL, NULL), -- Portugal x DR Congo
  (22, 'grupos', '2026-06-17 16:00:00-04', 45, 46, NULL, NULL), -- Inglaterra x Croácia
  (23, 'grupos', '2026-06-17 19:00:00-04', 47, 48, NULL, NULL), -- Gana x Panamá
  (24, 'grupos', '2026-06-17 22:00:00-04', 43, 44, NULL, NULL), -- Uzbequistão x Colômbia

  -- ---------------------------------------------------------------------------
  -- FASE DE GRUPOS — Rodada 2 (18-23 jun)
  -- ---------------------------------------------------------------------------
  (25, 'grupos', '2026-06-18 12:00:00-04',  4,  2, NULL, NULL), -- R. Tcheca x África do Sul
  (26, 'grupos', '2026-06-18 15:00:00-04',  8,  6, NULL, NULL), -- Suíça x Bósnia
  (27, 'grupos', '2026-06-18 18:00:00-04',  5,  7, NULL, NULL), -- Canadá x Catar
  (28, 'grupos', '2026-06-18 21:00:00-04',  1,  3, NULL, NULL), -- México x Coreia do Sul
  (29, 'grupos', '2026-06-19 15:00:00-04', 13, 15, NULL, NULL), -- EUA x Austrália
  (30, 'grupos', '2026-06-19 18:00:00-04', 10, 12, NULL, NULL), -- Marrocos x Escócia
  (31, 'grupos', '2026-06-19 20:30:00-04',  9, 11, NULL, NULL), -- Brasil x Haiti
  (32, 'grupos', '2026-06-19 23:00:00-04', 16, 14, NULL, NULL), -- Turquia x Paraguai
  (33, 'grupos', '2026-06-20 00:00:00-04', 24, 22, NULL, NULL), -- Tunísia x Japão -- TODO confirmar data/hora
  (34, 'grupos', '2026-06-20 13:00:00-04', 21, 23, NULL, NULL), -- Países Baixos x Suécia
  (35, 'grupos', '2026-06-20 16:00:00-04', 17, 19, NULL, NULL), -- Alemanha x Costa do Marfim
  (36, 'grupos', '2026-06-20 20:00:00-04', 20, 18, NULL, NULL), -- Equador x Curaçao
  (37, 'grupos', '2026-06-21 12:00:00-04', 29, 31, NULL, NULL), -- Espanha x Arábia Saudita
  (38, 'grupos', '2026-06-21 15:00:00-04', 25, 27, NULL, NULL), -- Bélgica x Irã
  (39, 'grupos', '2026-06-21 18:00:00-04', 32, 30, NULL, NULL), -- Uruguai x Cabo Verde
  (40, 'grupos', '2026-06-21 21:00:00-04', 28, 26, NULL, NULL), -- Nova Zelândia x Egito
  (41, 'grupos', '2026-06-22 13:00:00-04', 37, 39, NULL, NULL), -- Argentina x Áustria
  (42, 'grupos', '2026-06-22 17:00:00-04', 33, 35, NULL, NULL), -- França x Iraque
  (43, 'grupos', '2026-06-22 20:00:00-04', 36, 34, NULL, NULL), -- Noruega x Senegal
  (44, 'grupos', '2026-06-22 23:00:00-04', 40, 38, NULL, NULL), -- Jordânia x Argélia
  (45, 'grupos', '2026-06-23 13:00:00-04', 41, 43, NULL, NULL), -- Portugal x Uzbequistão
  (46, 'grupos', '2026-06-23 16:00:00-04', 45, 47, NULL, NULL), -- Inglaterra x Gana
  (47, 'grupos', '2026-06-23 19:00:00-04', 48, 46, NULL, NULL), -- Panamá x Croácia
  (48, 'grupos', '2026-06-23 22:00:00-04', 44, 42, NULL, NULL), -- Colômbia x DR Congo

  -- ---------------------------------------------------------------------------
  -- FASE DE GRUPOS — Rodada 3 (24-27 jun) — jogos simultâneos por grupo
  -- ---------------------------------------------------------------------------
  -- Grupos A e B: 24 jun
  (49, 'grupos', '2026-06-24 16:00:00-04',  4,  1, NULL, NULL), -- R. Tcheca x México (A)
  (50, 'grupos', '2026-06-24 16:00:00-04',  2,  3, NULL, NULL), -- África do Sul x Coreia (A)
  (51, 'grupos', '2026-06-24 21:00:00-04',  8,  5, NULL, NULL), -- Suíça x Canadá (B)
  (52, 'grupos', '2026-06-24 21:00:00-04',  7,  6, NULL, NULL), -- Catar x Bósnia (B)
  -- Grupos C e D: 24-25 jun
  (53, 'grupos', '2026-06-24 18:00:00-04', 12,  9, NULL, NULL), -- Escócia x Brasil (C)
  (54, 'grupos', '2026-06-24 18:00:00-04', 10, 11, NULL, NULL), -- Marrocos x Haiti (C)
  (55, 'grupos', '2026-06-25 22:00:00-04', 16, 13, NULL, NULL), -- Turquia x EUA (D)
  (56, 'grupos', '2026-06-25 22:00:00-04', 14, 15, NULL, NULL), -- Paraguai x Austrália (D)
  -- Grupos E e F: 25 jun
  (57, 'grupos', '2026-06-25 16:00:00-04', 18, 19, NULL, NULL), -- Curaçao x Costa do Marfim (E)
  (58, 'grupos', '2026-06-25 16:00:00-04', 20, 17, NULL, NULL), -- Equador x Alemanha (E) -- TODO confirmar pareamento
  (59, 'grupos', '2026-06-25 19:00:00-04', 22, 23, NULL, NULL), -- Japão x Suécia (F)
  (60, 'grupos', '2026-06-25 19:00:00-04', 24, 21, NULL, NULL), -- Tunísia x Países Baixos (F)
  -- Grupos G e H: 26 jun
  (61, 'grupos', '2026-06-26 16:00:00-04', 30, 31, NULL, NULL), -- Cabo Verde x Arábia Saudita (H)
  (62, 'grupos', '2026-06-26 16:00:00-04', 32, 29, NULL, NULL), -- Uruguai x Espanha (H) -- TODO confirmar pareamento
  (63, 'grupos', '2026-06-26 21:00:00-04', 26, 27, NULL, NULL), -- Egito x Irã (G)
  (64, 'grupos', '2026-06-26 21:00:00-04', 28, 25, NULL, NULL), -- Nova Zelândia x Bélgica (G)
  -- Grupo I: 26 jun
  (65, 'grupos', '2026-06-26 13:00:00-04', 36, 33, NULL, NULL), -- Noruega x França (I)
  (66, 'grupos', '2026-06-26 13:00:00-04', 34, 35, NULL, NULL), -- Senegal x Iraque (I)
  -- Grupos J, K e L: 27 jun
  (67, 'grupos', '2026-06-27 17:00:00-04', 38, 39, NULL, NULL), -- Argélia x Áustria (J)
  (68, 'grupos', '2026-06-27 17:00:00-04', 40, 37, NULL, NULL), -- Jordânia x Argentina (J)
  (69, 'grupos', '2026-06-27 19:30:00-04', 47, 46, NULL, NULL), -- Gana x Croácia (L) -- TODO confirmar horário
  (70, 'grupos', '2026-06-27 19:30:00-04', 48, 45, NULL, NULL), -- Panamá x Inglaterra (L) -- TODO confirmar horário
  (71, 'grupos', '2026-06-27 22:00:00-04', 41, 44, NULL, NULL), -- Portugal x Colômbia (K)
  (72, 'grupos', '2026-06-27 22:00:00-04', 42, 43, NULL, NULL), -- R.D. Congo x Uzbequistão (K)

  -- ---------------------------------------------------------------------------
  -- 16AVOS DE FINAL (28 jun - 3 jul) — 16 jogos
  -- ---------------------------------------------------------------------------
  (73, '16avos', '2026-06-28 16:00:00-04', NULL, NULL, '2A', '2B'),
  (74, '16avos', '2026-06-29 13:00:00-04', NULL, NULL, '1E', '3 A/B/C/D/F'),
  (75, '16avos', '2026-06-29 16:00:00-04', NULL, NULL, '1F', '2C'),
  (76, '16avos', '2026-06-29 21:00:00-04', NULL, NULL, '1C', '2F'),
  (77, '16avos', '2026-06-30 13:00:00-04', NULL, NULL, '1I', '3 C/D/F/G/H'),
  (78, '16avos', '2026-06-30 16:00:00-04', NULL, NULL, '2E', '2I'),
  (79, '16avos', '2026-06-30 21:00:00-04', NULL, NULL, '1A', '3 C/E/F/H/I'),
  (80, '16avos', '2026-07-01 16:00:00-04', NULL, NULL, '1L', '3 E/H/I/J/K'),
  (81, '16avos', '2026-07-01 19:00:00-04', NULL, NULL, '1D', '3 B/E/F/I/J'),
  (82, '16avos', '2026-07-01 22:00:00-04', NULL, NULL, '1G', '3 A/E/H/I/J'),
  (83, '16avos', '2026-07-02 16:00:00-04', NULL, NULL, '2K', '2L'),
  (84, '16avos', '2026-07-02 19:00:00-04', NULL, NULL, '1H', '2J'),
  (85, '16avos', '2026-07-02 22:00:00-04', NULL, NULL, '1B', '3 E/F/G/I/J'),
  (86, '16avos', '2026-07-03 16:00:00-04', NULL, NULL, '1J', '2H'),
  (87, '16avos', '2026-07-03 19:00:00-04', NULL, NULL, '1K', '3 D/E/I/J/L'),
  (88, '16avos', '2026-07-03 22:00:00-04', NULL, NULL, '2D', '2G'),

  -- ---------------------------------------------------------------------------
  -- OITAVAS DE FINAL (4-7 jul) — 8 jogos
  -- ---------------------------------------------------------------------------
  (89, 'oitavas', '2026-07-04 16:00:00-04', NULL, NULL, 'V J74', 'V J77'),
  (90, 'oitavas', '2026-07-04 20:00:00-04', NULL, NULL, 'V J73', 'V J75'),
  (91, 'oitavas', '2026-07-05 16:00:00-04', NULL, NULL, 'V J76', 'V J78'),
  (92, 'oitavas', '2026-07-05 20:00:00-04', NULL, NULL, 'V J79', 'V J80'),
  (93, 'oitavas', '2026-07-06 16:00:00-04', NULL, NULL, 'V J83', 'V J84'),
  (94, 'oitavas', '2026-07-06 20:00:00-04', NULL, NULL, 'V J81', 'V J82'),
  (95, 'oitavas', '2026-07-07 16:00:00-04', NULL, NULL, 'V J86', 'V J88'),
  (96, 'oitavas', '2026-07-07 20:00:00-04', NULL, NULL, 'V J85', 'V J87'),

  -- ---------------------------------------------------------------------------
  -- QUARTAS DE FINAL (9-11 jul) — 4 jogos
  -- ---------------------------------------------------------------------------
  (97,  'quartas', '2026-07-09 21:00:00-04', NULL, NULL, 'V J89', 'V J90'),
  (98,  'quartas', '2026-07-10 21:00:00-04', NULL, NULL, 'V J93', 'V J94'),
  (99,  'quartas', '2026-07-11 16:00:00-04', NULL, NULL, 'V J91', 'V J92'),
  (100, 'quartas', '2026-07-11 20:00:00-04', NULL, NULL, 'V J95', 'V J96'),

  -- ---------------------------------------------------------------------------
  -- SEMIFINAIS (14-15 jul) — 2 jogos
  -- ---------------------------------------------------------------------------
  (101, 'semis', '2026-07-14 21:00:00-04', NULL, NULL, 'V J97', 'V J98'),
  (102, 'semis', '2026-07-15 21:00:00-04', NULL, NULL, 'V J99', 'V J100'),

  -- ---------------------------------------------------------------------------
  -- DISPUTA DE 3º LUGAR (18 jul) — Miami Gardens
  -- ---------------------------------------------------------------------------
  (103, 'disputa_terceiro', '2026-07-18 16:00:00-04', NULL, NULL, 'P J101', 'P J102'),

  -- ---------------------------------------------------------------------------
  -- FINAL (19 jul) — MetLife Stadium, East Rutherford NJ
  -- ---------------------------------------------------------------------------
  (104, 'final', '2026-07-19 16:00:00-04', NULL, NULL, 'V J101', 'V J102');

-- ============================================================================
-- 3. COPA_RESULTADOS (singleton — admin atualiza durante/após a Copa)
-- ============================================================================

INSERT INTO copa_resultados (id, finalizada) VALUES (1, false);
