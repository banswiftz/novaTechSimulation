-- ============================================================
-- NovaTech Simulation — Database Schema (Supabase)
-- Run this in Supabase SQL Editor to set up tables
-- ============================================================

-- NOTE: If you already have these tables from the original setup,
-- you do NOT need to run this again. The schema is unchanged.
-- The game now has 6 situations (indices 0-5) instead of 4.

CREATE TABLE IF NOT EXISTS public.company_scores (
  id integer NOT NULL DEFAULT 1,
  cash_flow integer DEFAULT 50,
  brand_trust integer DEFAULT 50,
  employee_morale integer DEFAULT 50,
  CONSTRAINT company_scores_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.game_state (
  id integer NOT NULL DEFAULT 1,
  current_situation_index integer DEFAULT '-1'::integer,
  phase text DEFAULT 'waiting'::text,
  winning_option text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_state_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.group_results (
  group_number integer NOT NULL,
  situation_index integer NOT NULL,
  winning_option text NOT NULL,
  CONSTRAINT group_results_pkey PRIMARY KEY (group_number, situation_index)
);

CREATE TABLE IF NOT EXISTS public.group_scores (
  group_number integer NOT NULL,
  cash_flow integer DEFAULT 50,
  brand_trust integer DEFAULT 50,
  employee_morale integer DEFAULT 50,
  CONSTRAINT group_scores_pkey PRIMARY KEY (group_number)
);

CREATE TABLE IF NOT EXISTS public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  kpi_score integer DEFAULT 50,
  created_at timestamp with time zone DEFAULT now(),
  group_number integer NOT NULL DEFAULT 1,
  is_voter boolean NOT NULL DEFAULT false,
  CONSTRAINT players_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid,
  situation_index integer NOT NULL,
  choice text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT votes_pkey PRIMARY KEY (id),
  CONSTRAINT votes_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);

-- Insert default rows if not exist
INSERT INTO public.game_state (id) VALUES (1) ON CONFLICT DO NOTHING;
INSERT INTO public.company_scores (id) VALUES (1) ON CONFLICT DO NOTHING;
