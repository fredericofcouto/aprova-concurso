import { env } from "cloudflare:workers";
import type { Question, RoleId, Subject } from "./exam-engine";
import { curatedBank } from "../data/bank";
import { expansionQuestions } from "../data/expansion";
import { reviewBank } from "./question-quality";
type Row = {
    codigo: string | null;
    id: number;
    familia: string | null;
    banco: string;
    nivel: Question["level"];
    disciplina: Subject;
    topico: string;
    item_edital: string | null;
    texto_apoio: string | null;
    enunciado: string;
    alt_a: string;
    alt_b: string;
    alt_c: string;
    alt_d: string;
    correta: string;
    comentario: string;
    fonte: string | null;
    uso: Question["use"];
};
const bankRoles: Record<string, RoleId> = { ESP_TI: "ti", ESP_PSI: "psychology", ESP_AS: "social", ESP_ACS: "acs", ESP_PED: "pedagogy" };
const fallbackBank = () => reviewBank([...curatedBank, ...expansionQuestions]).questions;
const mapRow = (r: Row): Question => ({ id: r.codigo || `db-${r.id}`, family: r.familia || r.codigo || `db-${r.id}`, role: bankRoles[r.banco] || "common", level: r.nivel, subject: r.disciplina, topic: r.topico, syllabusItem: r.item_edital || "", passage: r.texto_apoio || undefined, prompt: r.enunciado, options: [r.alt_a, r.alt_b, r.alt_c, r.alt_d], answer: "ABCD".indexOf(r.correta), explanation: r.comentario, source: r.fonte || "Questão autoral — referência em revisão", use: r.uso });
export async function loadQuestionBank(): Promise<Question[]> {
    const config = env as unknown as {
        SUPABASE_URL?: string;
        SUPABASE_PUBLISHABLE_KEY?: string;
    };
    if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY)
        return fallbackBank();
    const rows: Row[] = [];
    for (let offset = 0; offset < 10000; offset += 500) {
        const response = await fetch(`${config.SUPABASE_URL}/rest/v1/questoes_revisadas?ativo=eq.true&uso=eq.prova&select=*&order=id&limit=500&offset=${offset}`, { headers: { apikey: config.SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(15000) }).catch(() => null);
        if (!response || !response.ok)
            return fallbackBank();
        const batch = await response.json().catch(() => null) as Row[] | null;
        if (!batch)
            return fallbackBank();
        rows.push(...batch);
        if (batch.length < 500)
            break;
    }
    if (!rows.length)
        return fallbackBank();
    return reviewBank([...rows.map(mapRow), ...expansionQuestions]).questions;
}
