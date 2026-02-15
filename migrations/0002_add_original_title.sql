-- Migration: Add original_title column to articles table
ALTER TABLE articles ADD COLUMN original_title TEXT;

-- Migration: Add pmid column for PubMed reference
ALTER TABLE articles ADD COLUMN pmid TEXT;
