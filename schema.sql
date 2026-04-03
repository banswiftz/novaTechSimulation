-- ============================================================
-- NovaTech Simulation — Database Schema (Supabase)
-- ============================================================

-- Drop old tables to ensure clean slate
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS group_results CASCADE;
DROP TABLE IF EXISTS group_scores CASCADE;
DROP TABLE IF EXISTS company_scores CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS game_state CASCADE;

CREATE TABLE public.company_scores (
  id integer NOT NULL DEFAULT 1,
  cash_flow integer DEFAULT 50,
  brand_trust integer DEFAULT 50,
  employee_morale integer DEFAULT 50,
  CONSTRAINT company_scores_pkey PRIMARY KEY (id)
);

CREATE TABLE public.game_state (
  id integer NOT NULL DEFAULT 1,
  current_situation_index integer DEFAULT -1,
  phase text DEFAULT 'waiting',
  winning_option text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_state_pkey PRIMARY KEY (id)
);

CREATE TABLE public.group_results (
  group_number integer NOT NULL,
  situation_index integer NOT NULL,
  winning_option text NOT NULL,
  CONSTRAINT group_results_pkey PRIMARY KEY (group_number, situation_index)
);

CREATE TABLE public.group_scores (
  group_number integer NOT NULL,
  cash_flow integer DEFAULT 50,
  brand_trust integer DEFAULT 50,
  employee_morale integer DEFAULT 50,
  fire_count integer DEFAULT 0,
  CONSTRAINT group_scores_pkey PRIMARY KEY (group_number)
);

CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  kpi_score integer DEFAULT 50,
  created_at timestamp with time zone DEFAULT now(),
  group_number integer NOT NULL DEFAULT 1,
  is_voter boolean NOT NULL DEFAULT false,
  layoff_reason text,
  CONSTRAINT players_pkey PRIMARY KEY (id),
  CONSTRAINT players_group_number_role_key UNIQUE (group_number, role)
);

CREATE UNIQUE INDEX one_voter_per_group ON public.players (group_number) WHERE is_voter = true;

CREATE TABLE public.votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid,
  situation_index integer NOT NULL,
  choice text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT votes_pkey PRIMARY KEY (id),
  CONSTRAINT votes_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT votes_player_id_situation_index_key UNIQUE (player_id, situation_index)
);

CREATE TABLE public.group_cards (
  id serial PRIMARY KEY,
  group_number integer NOT NULL,
  card_type text NOT NULL,
  is_used boolean DEFAULT false,
  used_at_situation integer,
  card_metadata jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT group_cards_unique UNIQUE (group_number, card_type)
);

-- Insert default rows
INSERT INTO public.game_state (id) VALUES (1);
INSERT INTO public.company_scores (id) VALUES (1);

-- ── RLS Policies (required for Supabase Realtime to work) ────
ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_game_state"  ON public.game_state FOR SELECT USING (true);
CREATE POLICY "public_update_game_state" ON public.game_state FOR UPDATE USING (true);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_players"   ON public.players FOR SELECT USING (true);
CREATE POLICY "public_insert_players" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_players" ON public.players FOR UPDATE USING (true);
CREATE POLICY "public_delete_players" ON public.players FOR DELETE USING (true);

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_votes"   ON public.votes FOR SELECT USING (true);
CREATE POLICY "public_insert_votes" ON public.votes FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_votes" ON public.votes FOR UPDATE USING (true);
CREATE POLICY "public_delete_votes" ON public.votes FOR DELETE USING (true);

ALTER TABLE public.company_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_company_scores"   ON public.company_scores FOR SELECT USING (true);
CREATE POLICY "public_update_company_scores" ON public.company_scores FOR UPDATE USING (true);

ALTER TABLE public.group_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_group_scores"   ON public.group_scores FOR SELECT USING (true);
CREATE POLICY "public_insert_group_scores" ON public.group_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_group_scores" ON public.group_scores FOR UPDATE USING (true);
CREATE POLICY "public_delete_group_scores" ON public.group_scores FOR DELETE USING (true);

ALTER TABLE public.group_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_group_results"   ON public.group_results FOR SELECT USING (true);
CREATE POLICY "public_insert_group_results" ON public.group_results FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_group_results" ON public.group_results FOR UPDATE USING (true);
CREATE POLICY "public_delete_group_results" ON public.group_results FOR DELETE USING (true);

-- Turn on realtime for important tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_results;

-- group_cards RLS + realtime
ALTER TABLE public.group_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_group_cards" ON public.group_cards FOR SELECT USING (true);
CREATE POLICY "public_insert_group_cards" ON public.group_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_group_cards" ON public.group_cards FOR UPDATE USING (true);
CREATE POLICY "public_delete_group_cards" ON public.group_cards FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_results;
