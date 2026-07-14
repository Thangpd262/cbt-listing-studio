-- 013: store the image/text model a prompt template targets
-- (e.g. gpt-image-1, gemini-2.5-flash-image). Nullable + additive.

ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS model text;
