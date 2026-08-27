import { getChatGPTUser } from "@/app/chatgpt-auth";
import { database, expireAttempts, getAttempt, publicAttempt, type StoredAttempt } from "@/lib/attempt-store";
import { buildExam, grade, roleIds, validateDraft, type Question, type RoleId } from "@/lib/exam-engine";
import { loadQuestionBank } from "@/lib/question-bank";
export const dynamic = "force-dynamic";
const json = (data: object, status = 200) => Response.json({ ...data, serverNow: Date.now() }, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } });
export async function GET(request: Request) {
    const user = await getChatGPTUser();
    if (!user)
        return json({ user: null, active: null, history: [] });
    try {
        await expireAttempts(user.email);
        const id = new URL(request.url).searchParams.get("id");
        if (id) {
            const attempt = await getAttempt(id, user.email);
            return attempt ? json({ attempt: publicAttempt(attempt) }) : json({ error: "Prova não encontrada." }, 404);
        }
        const { results } = await database().prepare("SELECT * FROM exam_attempts WHERE owner=? ORDER BY created DESC LIMIT 200").bind(user.email).all<StoredAttempt>();
        if (new URL(request.url).searchParams.has('errors')) {
            const seen = new Set<string>();
            const questions: Question[] = [];
            for (const row of results.filter(a => a.status === 'completed')) {
                const answers = JSON.parse(row.answers);
                for (const q of JSON.parse(row.questions) as Question[]) {
                    if (seen.has(q.family))
                        continue;
                    seen.add(q.family);
                    if (answers[q.id] !== q.answer)
                        questions.push(q);
                }
            }
            return json({ questions });
        }
        return json({ user: { name: user.displayName }, active: results.find(a => a.status === "active") ? publicAttempt(results.find(a => a.status === "active")!) : null,
            history: results.filter(a => a.status === "completed").map(a => ({ id: a.id, role: a.role, created: a.created, finished: a.finished, status: a.status, ...grade(JSON.parse(a.questions), JSON.parse(a.answers), a.role) })) });
    }
    catch {
        return json({ error: "Não foi possível carregar seu progresso. Tente novamente; seus dados não foram apagados." }, 503);
    }
}
export async function POST(request: Request) {
    if (request.headers.get("origin") !== new URL(request.url).origin)
        return json({ error: "Origem inválida." }, 403);
    const user = await getChatGPTUser();
    if (!user)
        return json({ error: "Entre com sua conta para salvar a prova." }, 401);
    if (Number(request.headers.get("content-length") || 0) > 60000)
        return json({ error: "Requisição muito grande." }, 413);
    try {
        const text = await request.text();
        if (text.length > 60000)
            return json({ error: "Requisição muito grande." }, 413);
        const body = JSON.parse(text);
        await expireAttempts(user.email);
        if (body.action === "start") {
            if (!roleIds.includes(body.role))
                return json({ error: "Cargo inválido." }, 400);
            const current = await database().prepare("SELECT * FROM exam_attempts WHERE owner=? AND status='active'").bind(user.email).first<StoredAttempt>();
            if (current)
                return json({ attempt: publicAttempt(current), resumed: true });
            const { results } = await database().prepare("SELECT questions FROM exam_attempts WHERE owner=? ORDER BY created ASC").bind(user.email).all<{
                questions: string;
            }>();
            const history = results.flatMap(a => (JSON.parse(a.questions) as Question[]).map(q => q.family));
            const bank = await loadQuestionBank();
            const { questions, repeated } = buildExam(bank, body.role as RoleId, history);
            const id = crypto.randomUUID();
            const now = Date.now();
            await database().prepare("INSERT OR IGNORE INTO exam_attempts (id,owner,role,created,deadline,status,open_key,questions,essay_theme,repeated) VALUES (?,?,?,?,?,'active',?,?,?,?)").bind(id, user.email, body.role, now, now + 4 * 60 * 60 * 1000, user.email, JSON.stringify(questions), results.length % 3, repeated).run();
            const created = await database().prepare("SELECT * FROM exam_attempts WHERE owner=? AND status='active'").bind(user.email).first<StoredAttempt>();
            return json({ attempt: publicAttempt(created!) });
        }
        if (!['save', 'submit'].includes(body.action) || typeof body.id !== 'string')
            return json({ error: "Ação inválida." }, 400);
        const attempt = await getAttempt(body.id, user.email);
        if (!attempt)
            return json({ error: "Prova não encontrada." }, 404);
        if (attempt.status === "completed")
            return json({ attempt: publicAttempt(attempt), expired: true });
        if (body.revision !== attempt.revision)
            return json({ error: "Esta prova foi atualizada em outra aba ou dispositivo. Recarregue para continuar sem sobrescrever respostas.", conflict: true }, 409);
        const draft = validateDraft(body, new Set((JSON.parse(attempt.questions) as Question[]).map(q => q.id)));
        const done = body.action === "submit";
        const now = Date.now();
        const result = await database().prepare("UPDATE exam_attempts SET answers=?,marked=?,essay=?,revision=revision+1,status=?,finished=?,open_key=? WHERE id=? AND owner=? AND revision=? AND status='active' AND deadline>?").bind(JSON.stringify(draft.answers), JSON.stringify(draft.marked), draft.essay, done ? 'completed' : 'active', done ? now : null, done ? null : user.email, attempt.id, user.email, attempt.revision, now).run();
        if (!result.meta.changes) {
            await expireAttempts(user.email);
            const latest = await getAttempt(attempt.id, user.email);
            if (latest?.status === 'completed')
                return json({ attempt: publicAttempt(latest), expired: true });
            return json({ error: "Conflito ao salvar. Recarregue a prova.", conflict: true }, 409);
        }
        return json({ attempt: publicAttempt((await getAttempt(attempt.id, user.email))!) });
    }
    catch (error) {
        return json({ error: error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente." }, 400);
    }
}
