
-- Quotes table (approved, public quotes)
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_text TEXT NOT NULL,
  formatted_quote JSONB,
  speaker_count INTEGER NOT NULL DEFAULT 1,
  character_names TEXT[] DEFAULT '{}',
  date_added TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Suggestions table (pending review)
CREATE TABLE public.suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_text TEXT NOT NULL,
  parsed_speakers JSONB,
  speaker_count INTEGER NOT NULL DEFAULT 1,
  date_submitted TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Both tables are public (no auth needed)
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

-- Anyone can read quotes
CREATE POLICY "Anyone can read quotes" ON public.quotes FOR SELECT USING (true);

-- Anyone can insert suggestions
CREATE POLICY "Anyone can insert suggestions" ON public.suggestions FOR INSERT WITH CHECK (true);

-- Anyone can read suggestions (admin will filter client-side)
CREATE POLICY "Anyone can read suggestions" ON public.suggestions FOR SELECT USING (true);

-- Anyone can delete suggestions (admin actions)
CREATE POLICY "Anyone can delete suggestions" ON public.suggestions FOR DELETE USING (true);

-- Anyone can insert quotes (admin approve action)
CREATE POLICY "Anyone can insert quotes" ON public.quotes FOR INSERT WITH CHECK (true);

-- Anyone can update quotes (admin edit)
CREATE POLICY "Anyone can update quotes" ON public.quotes FOR UPDATE USING (true);

-- Anyone can delete quotes (admin delete)
CREATE POLICY "Anyone can delete quotes" ON public.quotes FOR DELETE USING (true);

-- Anyone can update suggestions (admin edit before approve)
CREATE POLICY "Anyone can update suggestions" ON public.suggestions FOR UPDATE USING (true);
