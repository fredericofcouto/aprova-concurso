import { getChatGPTUser } from "@/app/chatgpt-auth";
import { anonymousIdentity } from "@/lib/anonymous-session";
import { database, expireAttempts, getAttempt, publicAttempt, type StoredAttempt } from "@/lib/attempt-store";
import { buildExam, grade, roleIds, validateDraft, type Question, type RoleId } from "@/lib/exam-engine";
import { loadQuestionBank } from "@/lib/question-bank";
export const dynamic = "force-dynamic";
type Identity = { owner: string; name: string; authenticated: boolean; setCookie?: string };
const identity = async (request: Request): Promise<Identity> => { const user = await getChatGPTUser(); return user ? { owner: user.email, name: user.displayName, authenticated: true } : { ...(await anonymousIdentity(request)), authenticated: false }; };
const json = (data: object, status = 200, setCookie?: string) => { const headers = new Headers({ "Cache-Control": "private, no-store", "Vary": "Cookie, Origin" }); if (setCookie) headers.set("Set-Cookie", setCookie); return Response.json({ ...data, serverNow: Date.now() }, { status, headers }); };
const invalidOrigin = (request: Request) => request.headers.get("origin") !== new URL(request.url).origin;

export async function GET(request: Request) {
    let setCookie: string | undefined;
    try {
        const user = await identity(request); setCookie = user.setCookie; const reply = (data: object, status = 200) => json(data, status, setCookie);
        await expireAttempts(user.owner);
        const id = new URL(request.url).searchParams.get("id");
        if (id) { const attempt = await getAttempt(id, user.owner); return attempt ? reply({ attempt: publicAttempt(attempt) }) : reply({ error: "Prova não encontrada." }, 404); }
        const { results } = await database().prepare("SELECT * FROM exam_attempts WHERE owner=? ORDER BY created DESC LIMIT 200").bind(user.owner).all<StoredAttempt>();
        if (new URL(request.url).searchParams.has("errors")) {
            const seen = new Set<string>(); const questions: Question[] = [];
            for (const row of results.filter(a => a.status === "completed")) { const answers = JSON.parse(row.answers); for (const q of JSON.parse(row.questions) as Question[]) { if (seen.has(q.family)) continue; seen.add(q.family); if (answers[q.id] !== q.answer) questions.push(q); } }
            return reply({ questions });
        }
        const active = results.find(a => a.status === "active");
        return reply({ user: { name: user.name }, active: active ? publicAttempt(active) : null, history: results.filter(a => a.status === "completed").map(a => ({ id: a.id, role: a.role, created: a.created, finished: a.finished, status: a.status, ...grade(JSON.parse(a.questions), JSON.parse(a.answers), a.role) })) });
    }
    catch { return json({ error: "Não foi possível carregar seu progresso. Tente novamente; seus dados não foram apagados." }, 503, setCookie); }
}

export async function POST(request: Request) {
    if (invalidOrigin(request)) return json({ error: "Origem inválida." }, 403);
    let setCookie: string | undefined;
    try {
        const user = await identity(request); setCookie = user.setCookie; const reply = (data: object, status = 200) => json(data, status, setCookie);
        if (Number(request.headers.get("content-length") || 0) > 60000) return reply({ error: "Requisição muito grande." }, 413);
        const text = await request.text(); if (text.length > 60000) return reply({ error: "Requisição muito grande." }, 413);
        const body = JSON.parse(text); await expireAttempts(user.owner);
        if (body.action === "start") {
            if (!roleIds.includes(body.role)) return reply({ error: "Cargo inválido." }, 400);
            const current = await database().prepare("SELECT * FROM exam_attempts WHERE owner=? AND status='active'").bind(user.owner).first<StoredAttempt>();
            if (current) return reply({ attempt: publicAttempt(current), resumed: true });
            const { results } = await database().prepare("SELECT questions FROM exam_attempts WHERE owner=? ORDER BY created ASC").bind(user.owner).all<{ questions: string }>();
            const history = results.flatMap(a => (JSON.parse(a.questions) as Question[]).map(q => q.family)); const bank = await loadQuestionBank(); const { questions, repeated } = buildExam(bank, body.role as RoleId, history); const id = crypto.randomUUID(); const now = Date.now();
            await database().prepare("INSERT OR IGNORE INTO exam_attempts (id,owner,role,created,deadline,status,open_key,questions,essay_theme,repeated) VALUES (?,?,?,?,?,'active',?,?,?,?)").bind(id, user.owner, body.role, now, now + 4 * 60 * 60 * 1000, user.owner, JSON.stringify(questions), results.length % 3, repeated).run();
            const created = await database().prepare("SELECT * FROM exam_attempts WHERE owner=? AND status='active'").bind(user.owner).first<StoredAttempt>(); return reply({ attempt: publicAttempt(created!) });
        }
        if (!["save", "submit"].includes(body.action) || typeof body.id !== "string") return reply({ error: "Ação inválida." }, 400);
        const attempt = await getAttempt(body.id, user.owner); if (!attempt) return reply({ error: "Prova não encontrada." }, 404); if (attempt.status === "completed") return reply({ attempt: publicAttempt(attempt), expired: true });
        if (body.revision !== attempt.revision) return reply({ error: "Esta prova foi atualizada em outra aba ou dispositivo. Recarregue para continuar sem sobrescrever respostas.", conflict: true }, 409);
        const draft = validateDraft(body, new Set((JSON.parse(attempt.questions) as Question[]).map(q => q.id))); const done = body.action === "submit"; const now = Date.now();
        const result = await database().prepare("UPDATE exam_attempts SET answers=?,marked=?,essay=?,revision=revision+1,status=?,finished=?,open_key=? WHERE id=? AND owner=? AND revision=? AND status='active' AND deadline>?").bind(JSON.stringify(draft.answers), JSON.stringify(draft.marked), draft.essay, done ? "completed" : "active", done ? now : null, done ? null : user.owner, attempt.id, user.owner, attempt.revision, now).run();
        if (!result.meta.changes) { await expireAttempts(user.owner); const latest = await getAttempt(attempt.id, user.owner); if (latest?.status === "completed") return reply({ attempt: publicAttempt(latest), expired: true }); return reply({ error: "Conflito ao salvar. Recarregue a prova.", conflict: true }, 409); }
        return reply({ attempt: publicAttempt((await getAttempt(attempt.id, user.owner))!) });
    }
    catch (error) { return json({ error: error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente." }, 400, setCookie); }
}
