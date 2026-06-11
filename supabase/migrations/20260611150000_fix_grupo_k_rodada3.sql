-- Migration: corrige confrontos duplicados no Grupo K (rodada 3)
--
-- Bug reportado por cliente: "Congo x Portugal aparece 2x na fase de grupos".
-- A fase de grupos da Copa é turno único (6 jogos por grupo, cada par 1x).
-- A rodada 3 do Grupo K repetia a rodada 1 em vez de trazer os confrontos
-- que faltavam:
--   jogo 71: era Congo(42) x Portugal(41)   -> duplicata do jogo 21
--   jogo 72: era Uzbequistão(43) x Colômbia(44) -> duplicata do jogo 24
-- Confrontos que faltavam no grupo: Portugal x Colômbia e Congo x Uzbequistão.
--
-- Demais grupos (A-J, L) já estavam corretos. data_hora/numero_jogo preservados.
-- Palpites já feitos nesses jogos são MANTIDOS (decisão do dono); usuários serão
-- avisados pra revisar/refazer antes de 27/jun.

UPDATE jogos
   SET selecao_casa_id = 41, selecao_fora_id = 44  -- Portugal x Colômbia
 WHERE numero_jogo = 71;

UPDATE jogos
   SET selecao_casa_id = 42, selecao_fora_id = 43  -- R.D. Congo x Uzbequistão
 WHERE numero_jogo = 72;
