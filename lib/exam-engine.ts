export type RoleId = "ti" | "psychology" | "social" | "acs" | "pedagogy";
export const roleIds: RoleId[] = ["ti", "psychology", "social", "acs", "pedagogy"];
export type Subject = "PORTUGUES" | "RLM" | "GOIAS" | "ESPECIFICOS";
export const subjectNames: Record<Subject, string> = { PORTUGUES: "Língua Portuguesa", RLM: "Raciocínio Lógico-Matemático", GOIAS: "Realidade de Goiás e São Miguel do Araguaia", ESPECIFICOS: "Conhecimentos Específicos" };
export type Question = {
    id: string;
    family: string;
    role: RoleId | "common";
    level: "MEDIO" | "SUPERIOR" | "AMBOS";
    subject: Subject;
    topic: string;
    syllabusItem: string;
    passage?: string;
    prompt: string;
    options: string[];
    answer: number;
    explanation: string;
    source: string;
    use: "prova" | "treino";
};
export type PublicQuestion = Omit<Question, "answer" | "explanation"> & {
    answer?: number;
    explanation?: string;
};
export const levelFor = (role: RoleId) => role === "ti" || role === "acs" ? "MEDIO" : "SUPERIOR";
export function blueprint(role: RoleId) {
    const medium = levelFor(role) === "MEDIO";
    return [
        { subject: "PORTUGUES" as Subject, count: 10, weight: medium ? 2 : 3 },
        { subject: "RLM" as Subject, count: medium ? 3 : 5, weight: 1 },
        { subject: "GOIAS" as Subject, count: medium ? 2 : 5, weight: 1 },
        { subject: "ESPECIFICOS" as Subject, count: medium ? 25 : 30, weight: medium ? 3 : 2 },
    ];
}
export const weightFor = (role: RoleId, subject: Subject) => blueprint(role).find(s => s.subject === subject)!.weight;
export function shuffle<T>(items: T[], random = Math.random): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
export function eligible(bank: Question[], role: RoleId, subject?: Subject) {
    return bank.filter(q => q.use === "prova" && (q.role === role || q.role === "common") && (q.level === "AMBOS" || q.level === levelFor(role)) && (!subject || q.subject === subject));
}
// One semantic family per exam. Unseen families always precede the least recently seen.
export function pickQuestions(pool: Question[], count: number, history: string[], random = Math.random) {
    const byFamily = new Map<string, Question[]>();
    for (const q of pool)
        byFamily.set(q.family, [...(byFamily.get(q.family) ?? []), q]);
    if (byFamily.size < count)
        throw new Error(`Banco em revisão: ${byFamily.size} famílias disponíveis para ${count} questões. Não completamos provas com duplicatas.`);
    const lastSeen = new Map<string, number>();
    history.forEach((family, i) => lastSeen.set(family, i));
    const families = shuffle([...byFamily.keys()], random);
    families.sort((a, b) => (lastSeen.get(a) ?? -1) - (lastSeen.get(b) ?? -1));
    return families.slice(0, count).map(f => shuffle(byFamily.get(f)!, random)[0]);
}
export function randomizeOptions(q: Question, random = Math.random): Question {
    const order = shuffle(q.options.map((_, i) => i), random);
    return { ...q, options: order.map(i => q.options[i]), answer: order.indexOf(q.answer) };
}
export function buildExam(bank: Question[], role: RoleId, history: string[] = [], random = Math.random) {
    const questions = blueprint(role).flatMap(section => pickQuestions(eligible(bank, role, section.subject), section.count, history, random));
    // Keep items sharing a passage next to one another inside their subject.
    const ordered = blueprint(role).flatMap(section => {
        const items = questions.filter(q => q.subject === section.subject);
        const groups = new Map<string, Question[]>();
        for (const q of items) {
            const key = q.passage || q.id;
            groups.set(key, [...(groups.get(key) ?? []), q]);
        }
        return [...groups.values()].flat();
    });
    return { questions: ordered.map(q => randomizeOptions(q, random)), repeated: questions.filter(q => history.includes(q.family)).length };
}
export function grade(questions: Question[], answers: Record<string, number>, role: RoleId) {
    const sections = blueprint(role).map(section => {
        const items = questions.filter(q => q.subject === section.subject);
        const correct = items.filter(q => answers[q.id] === q.answer).length;
        return { ...section, correct, total: items.length, points: correct * section.weight, maximum: items.length * section.weight };
    });
    const points = sections.reduce((n, s) => n + s.points, 0);
    return { points, correct: sections.reduce((n, s) => n + s.correct, 0), total: questions.length, minimumReached: points >= 50, sections };
}
export type Attempt = {
    id: string;
    role: RoleId;
    created: number;
    deadline: number;
    finished: number | null;
    status: "active" | "completed";
    questions: PublicQuestion[];
    answers: Record<string, number>;
    marked: string[];
    essay: string;
    essayTheme: number;
    repeated: number;
    revision: number;
    result?: ReturnType<typeof grade>;
};
export type AttemptSummary = Pick<Attempt, "id" | "role" | "created" | "finished" | "status"> & {
    points: number;
    correct: number;
    total: number;
};
export function validateDraft(value: unknown, ids: Set<string>) {
    if (!value || typeof value !== "object")
        throw new Error("Respostas inválidas.");
    const d = value as {
        answers?: Record<string, unknown>;
        marked?: unknown;
        essay?: unknown;
    };
    const answers: Record<string, number> = {};
    for (const [id, answer] of Object.entries(d.answers ?? {})) {
        if (!ids.has(id) || !Number.isInteger(answer) || Number(answer) < 0 || Number(answer) > 3)
            throw new Error("Alternativa inválida.");
        answers[id] = Number(answer);
    }
    if (!Array.isArray(d.marked) || d.marked.some(id => typeof id !== "string" || !ids.has(id)))
        throw new Error("Marcações inválidas.");
    if (typeof d.essay !== "string" || d.essay.length > 12000 || d.essay.split("\n").length > 30)
        throw new Error("A redação deve ter até 30 linhas e 12.000 caracteres.");
    return { answers, marked: [...new Set(d.marked as string[])], essay: d.essay };
}
