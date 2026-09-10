import type { Question, RoleId, Subject } from "./exam-engine";

const subjects = new Set<Subject>(["PORTUGUES", "RLM", "GOIAS", "ESPECIFICOS"]);
const roles = new Set<RoleId | "common">(["ti", "psychology", "social", "acs", "pedagogy", "common"]);
const levels = new Set<Question["level"]>(["MEDIO", "SUPERIOR", "AMBOS"]);
const uses = new Set<Question["use"]>(["prova", "treino"]);
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export type QuestionReview = { valid: boolean; errors: string[]; warnings: string[] };

/** Verificação editorial mínima aplicada antes de uma questão chegar ao motor. */
export function reviewQuestion(question: Question): QuestionReview {
    const errors: string[] = [];
    const warnings: string[] = [];
    const options = Array.isArray(question.options) ? question.options.map(text) : [];
    if (!text(question.id)) errors.push("id ausente");
    if (!text(question.family)) errors.push("família ausente");
    if (!roles.has(question.role)) errors.push("cargo inválido");
    if (!levels.has(question.level)) errors.push("nível inválido");
    if (!subjects.has(question.subject)) errors.push("disciplina inválida");
    if (!uses.has(question.use)) errors.push("uso inválido");
    if (!text(question.topic)) errors.push("tópico ausente");
    if (!text(question.prompt)) errors.push("enunciado ausente");
    if (options.length !== 4) errors.push("a questão não possui exatamente quatro alternativas");
    if (options.some(option => !option)) errors.push("há alternativa vazia");
    if (new Set(options.map(option => option.toLocaleLowerCase("pt-BR"))).size !== options.length) errors.push("há alternativas repetidas");
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) errors.push("gabarito inválido");
    if (!text(question.explanation)) errors.push("comentário ausente");
    if (!text(question.source)) errors.push("fonte ausente");
    if (!text(question.syllabusItem)) warnings.push("item do edital não informado");
    if (question.passage !== undefined && !text(question.passage)) warnings.push("texto-base vazio");
    if (question.explanation.length < 25) warnings.push("comentário curto para revisão");
    return { valid: errors.length === 0, errors, warnings };
}

export type BankReview = {
    questions: Question[];
    rejected: Array<{ id: string; errors: string[] }>;
    warnings: Array<{ id: string; warnings: string[] }>;
};

/** Remove somente itens estruturalmente inseguros e preserva variantes de família. */
export function reviewBank(bank: Question[]): BankReview {
    const questions: Question[] = [];
    const rejected: BankReview["rejected"] = [];
    const warnings: BankReview["warnings"] = [];
    const ids = new Set<string>();
    for (const question of bank) {
        const result = reviewQuestion(question);
        if (result.warnings.length) warnings.push({ id: question.id, warnings: result.warnings });
        if (!result.valid || ids.has(question.id)) {
            rejected.push({ id: question.id || "sem-id", errors: [...result.errors, ...(ids.has(question.id) ? ["id duplicado"] : [])] });
            continue;
        }
        ids.add(question.id);
        questions.push(question);
    }
    return { questions, rejected, warnings };
}
