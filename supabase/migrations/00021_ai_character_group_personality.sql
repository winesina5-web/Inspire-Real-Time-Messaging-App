ALTER TABLE public.group_ai_characters
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'Match the group language'
    CHECK (char_length(language) <= 80),
  ADD COLUMN IF NOT EXISTS temperature numeric(3,2) NOT NULL DEFAULT 0.85
    CHECK (temperature >= 0.2 AND temperature <= 1.2),
  ADD COLUMN IF NOT EXISTS response_length text NOT NULL DEFAULT 'balanced'
    CHECK (response_length IN ('short', 'balanced', 'detailed')),
  ADD COLUMN IF NOT EXISTS sample_dialogue text NOT NULL DEFAULT ''
    CHECK (char_length(sample_dialogue) <= 1000);
