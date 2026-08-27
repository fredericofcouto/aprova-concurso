CREATE TABLE public.questoes_revisadas (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 codigo text NOT NULL UNIQUE,
 familia text NOT NULL,
 banco text NOT NULL,
 nivel text NOT NULL CHECK(nivel IN ('MEDIO','SUPERIOR','AMBOS')),
 disciplina text NOT NULL CHECK(disciplina IN ('PORTUGUES','RLM','GOIAS','ESPECIFICOS')),
 topico text NOT NULL,
 item_edital text NOT NULL,
 texto_apoio text,
 enunciado text NOT NULL,
 alt_a text NOT NULL,
 alt_b text NOT NULL,
 alt_c text NOT NULL,
 alt_d text NOT NULL,
 correta char(1) NOT NULL CHECK(correta IN ('A','B','C','D')),
 comentario text NOT NULL,
 fonte text NOT NULL,
 dificuldade text NOT NULL DEFAULT 'media',
 uso text NOT NULL DEFAULT 'treino' CHECK(uso IN ('prova','treino')),
 ativo boolean NOT NULL DEFAULT true,
 criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.questoes_revisadas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.questoes_revisadas FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.questoes_revisadas TO anon,authenticated;
CREATE POLICY "read_reviewed_active_questions" ON public.questoes_revisadas FOR SELECT TO anon,authenticated USING (ativo AND uso='prova');
CREATE INDEX reviewed_questions_pool ON public.questoes_revisadas(banco,nivel,id) WHERE ativo AND uso='prova';
COMMENT ON TABLE public.questoes_revisadas IS 'Curated authorial study bank for Aprova Concurso. Public study material; no personal attempts. Original imports remain in questoes.';
