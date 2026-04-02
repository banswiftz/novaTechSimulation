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
  CONSTRAINT players_pkey PRIMARY KEY (id)
);

CREATE TABLE public.votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid,
  situation_index integer NOT NULL,
  choice text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT votes_pkey PRIMARY KEY (id),
  CONSTRAINT votes_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);

-- Insert default rows
INSERT INTO public.game_state (id) VALUES (1);
INSERT INTO public.company_scores (id) VALUES (1);

-- Turn on realtime for important tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_scores;
