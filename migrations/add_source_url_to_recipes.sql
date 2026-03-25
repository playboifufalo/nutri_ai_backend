-- Migration: Add source_url column to generated_recipes table
-- Purpose: Store links to original recipe sources

-- Add source_url column
ALTER TABLE generated_recipes 
ADD COLUMN source_url TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_generated_recipes_source_url 
ON generated_recipes(source_url);

-- Update existing records to have NULL source_url (already default, but explicit)
UPDATE generated_recipes 
SET source_url = NULL 
WHERE source_url IS NULL;
