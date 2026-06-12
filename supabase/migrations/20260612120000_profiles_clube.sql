-- Clube do coração (curado manualmente) para exibir escudo no ranking.
-- Slug minúsculo, ex.: 'nautico', 'corinthians'. NULL = sem escudo.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clube text;
