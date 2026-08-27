"use client";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Clock3, Flag, GraduationCap, ShieldCheck, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { blueprint, levelFor, roleIds, subjectNames, type Attempt, type AttemptSummary, type PublicQuestion, type RoleId, type Subject } from "@/lib/exam-engine";
import { roles } from "@/lib/roles";
import { calendar, editalUrl, officialUrl, essayThemes, essayCriteria } from "@/lib/exam-info";
import syllabus from "@/lib/syllabus.json";
type View = "home" | "study" | "exam" | "result" | "history" | "errors";
type Draft = Pick<Attempt, "answers" | "marked" | "essay">;
type Catalog = {
    total: number;
    roles: Record<RoleId, {
        subject: Subject;
        count: number;
        weight: number;
        available: number;
        families: number;
        topics: string[];
    }[]>;
};
const key = (id: string) => `aprova-draft-${id}`;
type StudyData = { user: { name: string } | null; history: AttemptSummary[]; active: Attempt | null; attempt: Attempt; questions: PublicQuestion[]; serverNow: number };
class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
async function api<T = StudyData>(path: string, body?: unknown) { const r = await fetch(path, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store" }); const data = await r.json() as T & { error?: string; serverNow: number }; if (!r.ok)
    throw new ApiError(data.error || "Falha de conexão. Tente novamente.", r.status); return { ...data, clientNow: Date.now() }; }
const date = (n: number) => new Date(n).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
function duration(ms: number) { const s = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(n => String(n).padStart(2, "0")).join(":"); }
export default function Home() {
    const [view, setView] = useState<View>("home"), [role, setRole] = useState<RoleId>("ti"), [user, setUser] = useState<{
        name: string;
    } | null>(null), [attempt, setAttempt] = useState<Attempt | null>(null), [history, setHistory] = useState<AttemptSummary[]>([]), [catalog, setCatalog] = useState<Catalog | null>(null);
    const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [saveStatus, setSaveStatus] = useState(""), [now, setNow] = useState(0), [offset, setOffset] = useState(0), [confirm, setConfirm] = useState(false), [onlyWrong, setOnlyWrong] = useState(false), [errorQuestions, setErrorQuestions] = useState<PublicQuestion[]>([]);
    const current = useRef<Attempt | null>(null), pending = useRef(false), saving = useRef(false), finishing = useRef(false), conflicted = useRef(false), saveDelay = useRef<number | undefined>(undefined), savePromise = useRef<Promise<void>>(Promise.resolve());
    function adopt(a: Attempt) { current.current = a; setAttempt(a); setRole(a.role); }
    async function reload() { const d = await api("/api/study"); setUser(d.user); setHistory(d.history || []); if (d.serverNow)
        setOffset(d.serverNow - d.clientNow);
    const requested = new URLSearchParams(window.location.search).get('trilha');
    if (d.user && requested && roleIds.includes(requested as RoleId)) {
        if (!d.active) { const started = await api('/api/study', {action:'start', role:requested}); d.active = started.attempt; setOffset(started.serverNow - started.clientNow); }
        window.history.replaceState(null, '', window.location.pathname);
    }
    if (d.active) {
        let a = d.active as Attempt;
        try {
            const raw = sessionStorage.getItem(key(a.id));
            const draft = raw ? JSON.parse(raw) : null;
            if (draft && draft.revision === a.revision) {
                a = { ...a, ...draft.draft };
                pending.current = true;
                setSaveStatus("Rascunho recuperado; aguardando sincronização.");
            }
            else if (draft)
                setMessage("Há um rascunho antigo neste dispositivo. Mantivemos as respostas mais recentes da sua conta.");
        }
        catch { }
        adopt(a);
        setView("exam");
    } }
    useEffect(() => {
        Promise.resolve().then(() => Promise.all([reload(), api<Catalog>("/api/catalog").then(setCatalog).catch(() => setMessage("Não foi possível consultar o banco agora. Recarregue a página para consultar o banco antes de iniciar uma prova."))])).catch(e => setMessage(e.message)).finally(() => setLoading(false));
        const t = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    function cache(a: Attempt) { try {
        sessionStorage.setItem(key(a.id), JSON.stringify({ revision: a.revision, draft: { answers: a.answers, marked: a.marked, essay: a.essay } }));
    }
    catch {
        setMessage("Rascunho local indisponível. Aguarde a confirmação de salvamento na conta antes de fechar.");
    } }
    function edit(draft: Partial<Draft>) { const a = current.current; if (!a || a.status !== "active" || finishing.current)
        return; const next = { ...a, ...draft }; adopt(next); pending.current = true; cache(next); setSaveStatus("Salvando…"); window.clearTimeout(saveDelay.current); saveDelay.current = window.setTimeout(() => void flush(), 400); }
    function flush(): Promise<void> { if (conflicted.current) return Promise.resolve(); if (saving.current)
        return savePromise.current; saving.current = true; const task = (async () => { while (pending.current && current.current?.status === "active") {
        const snapshot = current.current;
        pending.current = false;
        try {
            const d = await api("/api/study", { action: "save", id: snapshot.id, revision: snapshot.revision, answers: snapshot.answers, marked: snapshot.marked, essay: snapshot.essay });
            const saved = d.attempt as Attempt;
            if (saved.status === "completed") {
                adopt(saved);
                setView("result");
                pending.current = false;
                sessionStorage.removeItem(key(saved.id));
                setSaveStatus("Tempo encerrado. Prova salva.");
                break;
            }
            const merged = { ...current.current!, revision: saved.revision };
            adopt(merged);
            if (pending.current)
                cache(merged);
            else {
                sessionStorage.removeItem(key(saved.id));
                setSaveStatus("Salvo na sua conta");
            }
        }
        catch (e) {
            pending.current = true;
            if (e instanceof ApiError && e.status === 409) conflicted.current = true;
            setSaveStatus("Não sincronizado — rascunho preservado neste dispositivo");
            setMessage(e instanceof Error ? e.message : "Falha ao salvar.");
            break;
        }
    } })().finally(() => { saving.current = false; }); savePromise.current = task; return task; }
    useEffect(() => {
        const retry = () => { if (pending.current)
            void flush(); };
        const warn = (e: BeforeUnloadEvent) => { if (pending.current || saving.current) {
            e.preventDefault();
            e.returnValue = "";
        } };
        const t = window.setInterval(retry, 5000);
        window.addEventListener("online", retry);
        window.addEventListener("beforeunload", warn);
        return () => { window.clearInterval(t); window.clearTimeout(saveDelay.current); window.removeEventListener("online", retry); window.removeEventListener("beforeunload", warn); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => { if (attempt?.status !== "active" || !now || now + offset < attempt.deadline || finishing.current)
        return; finishing.current = true; setBusy(true); api(`/api/study?id=${attempt.id}`).then(d => { adopt(d.attempt); setView("result"); setMessage("O tempo terminou. O resultado considera as respostas recebidas antes do prazo."); }).catch(e => setMessage(e.message)).finally(() => { finishing.current = false; setBusy(false); }); }, [now, offset, attempt?.deadline, attempt?.id, attempt?.status]);
    async function start(id: RoleId) { if (!user) {
        window.open('/signin-with-chatgpt?return_to=' + encodeURIComponent('/?trilha=' + id), '_top');
        return;
    } if (current.current?.status === "active") {
        setView("exam");
        setMessage("Sua prova em andamento foi retomada. Finalize-a antes de iniciar outra trilha.");
        return;
    } setBusy(true); setMessage(""); try {
        const d = await api("/api/study", { action: "start", role: id });
        adopt(d.attempt);
        setView("exam");
        setSaveStatus("Prova salva na sua conta");
        setNow(d.clientNow);
        setOffset(d.serverNow - d.clientNow);
        window.scrollTo(0, 0);
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : "Não foi possível iniciar.");
    }
    finally {
        setBusy(false);
    } }
    async function submit() { finishing.current = true; setBusy(true); setConfirm(false); setMessage(""); try {
        await flush();
        if (pending.current)
            throw new Error("Existem respostas não sincronizadas. Use ‘Tentar salvar’ antes de entregar.");
        const a = current.current!;
        if (a.status === "completed") {
            setView("result");
            return;
        }
        const d = await api("/api/study", { action: "submit", id: a.id, revision: a.revision, answers: a.answers, marked: a.marked, essay: a.essay });
        adopt(d.attempt);
        setView("result");
        sessionStorage.removeItem(key(a.id));
        const updated = await api("/api/study");
        setHistory(updated.history);
        window.scrollTo(0, 0);
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : "Não foi possível entregar.");
    }
    finally {
        finishing.current = false;
        setBusy(false);
    } }
    async function openResult(id: string) { if(current.current?.status==='active'){setMessage('Finalize a prova em andamento antes de abrir outro gabarito. Seu tempo continua correndo.');return;} setBusy(true); try {
        const d = await api(`/api/study?id=${id}`);
        adopt(d.attempt);
        setOnlyWrong(false);
        setView("result");
        window.scrollTo(0, 0);
    }
    catch (e) {
        setMessage(String(e));
    }
    finally {
        setBusy(false);
    } }
    async function errors() { setBusy(true); try {
        const d = await api("/api/study?errors=1");
        setErrorQuestions(d.questions || []);
        setView("errors");
    }
    catch (e) {
        setMessage(String(e));
    }
    finally {
        setBusy(false);
    } }
    const active = attempt?.status === "active", answered = attempt ? Object.keys(attempt.answers).length : 0, remaining = attempt ? Math.max(0, attempt.deadline - (now || attempt.created) - offset) : 0, last = history[0], roleCatalog = catalog?.roles[role], sets = roleCatalog ? Math.min(...roleCatalog.map(s => Math.floor(s.families / s.count))) : 0;
    function go(v: View) { setView(v); setMessage(""); window.scrollTo(0, 0); }
    return <div className="app-shell"><a className="skip-link" href="#main">Pular para o conteúdo</a><header className="topbar"><button className="brand" onClick={() => go("home")}><span className="brand-mark"><GraduationCap size={20}/></span>Aprova<span className="brand-dot">.</span></button><nav className="topnav" aria-label="Navegação principal">{([["home", "Painel"], ["study", "O que estudar"], ["history", "Histórico"]] as [
        View,
        string
    ][]).map(([v, label]) => <button key={v} className={`nav-link ${view === v ? 'active' : ''}`} onClick={() => go(v)}>{label}</button>)}<button className="nav-link" onClick={() => go(active ? "exam" : "home")}>{active ? "Retomar prova" : "Simulados"}</button></nav><div className="account">{user ? <><span title={user.name}>{user.name}</span><a href="/signout-with-chatgpt?return_to=%2F" target="_top">Trocar conta</a></> : <a className="sign-in" href="/signin-with-chatgpt?return_to=%2F" target="_top">Entrar com ChatGPT</a>}</div></header>
 <main id="main">{message && <div className="notice section-wrap" role="alert"><span>{message}</span><button aria-label="Fechar aviso" onClick={() => setMessage("")}>×</button></div>}{loading ? <div className="loading section-wrap" role="status">Carregando seu espaço de estudos…</div> : <>
 {view === "home" && <div className="section-wrap home-workspace"><div className="workspace-heading"><div><p className="eyebrow">SÃO MIGUEL DO ARAGUAIA · INSTITUTO VERBENA/UFG</p><h1>Sua próxima prova<br /><em>começa aqui.</em></h1><p>Escolha o cargo. Resolva o caderno completo. Revise seus erros.</p></div><aside className="hero-card" aria-label="Seu painel"><div className="hero-card-top"><span className="mini-label">SEU PAINEL</span><span className="live-pill"><span />{user ? "individual" : "entre para salvar"}</span></div><div className="hero-score"><span className="score-label">Última prova concluída</span><strong>{last ? last.points : "—"}<small>{last ? " / 100" : ""}</small></strong><span className="score-caption">{last ? roles[last.role].name : "Seu primeiro resultado aparecerá aqui"}</span></div><Progress value={last?.points || 0} aria-label="Pontuação da última prova"/><div className="hero-card-footer"><span>{history.length} provas no histórico</span><span>Prova: 29 nov. 2026</span></div></aside></div>
 <div className="date-notice"><Clock3 size={17}/><span>Data atualizada: <strong>29/11/2026</strong> · Edital Complementar nº 02/2026. <a href={officialUrl} target="_blank" rel="noreferrer">Conferir na banca ↗</a></span></div>
 {active && <div className="resume-banner"><div><strong>Você tem uma prova em andamento</strong><p>{roles[attempt.role].name} · {answered}/{attempt.questions.length} respondidas · o relógio continua correndo.</p></div><Button className="primary-button" onClick={() => go("exam")}>Retomar prova</Button></div>}
 <div className="section-heading"><div><p className="eyebrow">CADERNOS DE PROVA</p><h2>Qual trilha você vai estudar?</h2></div><span className="section-muted">5 cargos · pesos e quantidades do edital</span></div><div className="role-grid">{roleIds.map(id => { const r = roles[id], Icon = r.icon; return <article className="role-card" key={id}><div className="role-card-head"><span className="role-icon" style={{ color: r.color, background: r.color + "12" }}><Icon size={23}/></span><span className="level-tag">{levelFor(id) === "MEDIO" ? "Médio/técnico" : "Superior"}</span></div><h3>{r.name}</h3><p className="role-description">{r.description}</p><p className="role-facts">{id === "ti" || id === "acs" ? 40 : 50} questões · {r.period.toLowerCase()} · 4h</p><Button className="primary-button full-button" disabled={busy || !catalog} onClick={() => start(id)}>{busy ? "Aguarde…" : user ? "Selecionar trilha →" : "Entrar e iniciar →"}</Button><button className="quiet-button" onClick={() => { setRole(id); go("study"); }}>Ver conteúdo e regras</button></article>; })}</div>
 <div className="honest-note"><ShieldCheck size={18}/><p>Questões autorais de preparação, não oficiais. A estrutura segue o edital; não é possível prever as perguntas da prova. O mínimo é <strong>50 pontos ponderados</strong>, não 50% de acertos, e não garante aprovação no concurso.</p></div><div className="home-bottom"><section className="panel"><h2>Como funciona a renovação</h2><p>Priorizamos questões ainda não vistas, mantendo as disciplinas em sequência e evitando a mesma família no mesmo caderno. Quando o estoque se esgota, o sistema revisita as menos recentes e informa a reutilização.</p><p>{catalog ? `${catalog.total} questões no banco de provas.` : "Consultando o banco…"} O sorteio não é geração ilimitada de conteúdo. A dificuldade é didática, sem calibração oficial da banca.</p></section><section className="panel"><h2>Históricos separados</h2><p>Cada pessoa entra com sua própria conta ChatGPT. Respostas, redações e resultados podem ser retomados em outro dispositivo.</p><p>Ao compartilhar o computador, use <strong>Trocar conta</strong>. Seu histórico não é público.</p></section></div></div>}
 {view === "study" && <div className="section-wrap study-workspace"><p className="eyebrow">GUIA DO EDITAL</p><h1>O que estudar</h1><div className="role-tabs" role="group" aria-label="Cargo">{roleIds.map(id => <Button key={id} variant={id === role ? "default" : "outline"} onClick={() => setRole(id)}>{roles[id].shortName}</Button>)}</div><div className="study-columns"><div><section className="panel"><h2>{roles[role].name}</h2><p>{roles[role].period} · 4 horas · 100 pontos na objetiva · mínimo de 50 pontos.</p><div className="table-scroll"><table><caption>Composição da prova objetiva</caption><thead><tr><th>Disciplina</th><th>Questões</th><th>Peso</th><th>Pontos</th></tr></thead><tbody>{blueprint(role).map(s => <tr key={s.subject}><td>{subjectNames[s.subject]}</td><td>{s.count}</td><td>{s.weight}</td><td>{s.count * s.weight}</td></tr>)}</tbody></table></div><Button className="primary-button" disabled={busy || !catalog} onClick={() => start(role)}>Iniciar esta prova</Button></section><section className="panel"><h2>Conteúdo programático integral</h2><p>Itens do Anexo IV do edital enviado e regras atualizadas pelo Complementar nº 02/2026. Confira futuras retificações no portal oficial.</p>{(["PORTUGUES", "RLM", "GOIAS", "ESPECIFICOS"] as Subject[]).map(subject => { const items = subject === "ESPECIFICOS" ? syllabus.specific[role] : syllabus.common[levelFor(role)][subject], available = roleCatalog?.find(s => s.subject === subject); return <details key={subject} open={subject === "ESPECIFICOS"}><summary>{subjectNames[subject]}<small>{available?.available ?? "—"} questões</small></summary><ol className="syllabus-list">{items.map((item, i) => <li key={i}><p>{item.replace(/^\d+\.\s*/, "")}</p><span className="coverage">{available?.topics.includes(String(i + 1)) ? "Há questões deste item; isso não significa cobertura de todos os subtemas." : "Item obrigatório — cobertura de questões em ampliação."}</span></li>)}</ol></details>; })}</section></div><aside><section className="panel"><h2>Etapas do cargo</h2><p>Objetiva: eliminatória e classificatória. Atingir 50/100 não garante classificação dentro das vagas nem aprovação nas demais etapas.</p>{role === "pedagogy" ? <><p><strong>Redação:</strong> texto dissertativo-argumentativo, até 30 linhas, no mesmo período de 4 horas. Mínimo de 50/100; correção oficial condicionada à classificação prevista no edital.</p><p><strong>Títulos:</strong> etapa classificatória. Confira documentação, convocação e critérios na seção 9 do edital. Não somamos títulos hipotéticos ao treino.</p><p>No site há proposta autoral, folha de escrita e rubrica para revisão. Não há correção oficial nem nota automática da redação.</p></> : role === "acs" ? <><p><strong>Curso de formação:</strong> etapa eliminatória, mediante convocação. A objetiva não substitui a aprovação nessa etapa.</p><p>Verifique os requisitos territoriais e de residência específicos de ACS na inscrição e no edital.</p></> : <p>Este cargo contempla prova objetiva. Consulte escolaridade, requisitos e documentos para posse no edital.</p>}</section><section className="panel"><h2>Banco transparente</h2><p>{sets} cadernos completos sem reutilização para esta trilha, considerando o menor estoque por disciplina e um histórico novo.</p><p>Histórico de outras trilhas também conta nas matérias comuns. Variantes da mesma família não são conteúdo inédito.</p><a href={editalUrl} target="_blank" rel="noreferrer">Ler edital consolidado ↗</a></section><section className="panel"><h2>Datas importantes</h2><dl className="calendar">{calendar.map(([day, event]) => <div key={day}><dt>{day}</dt><dd>{event}</dd></div>)}</dl><a href={officialUrl} target="_blank" rel="noreferrer">Cronograma e retificações ↗</a></section></aside></div></div>}
 {view === "exam" && attempt && <div className="section-wrap exam-workspace"><div className="exam-heading"><div><p className="eyebrow">CADERNO AUTORAL · FORMATO DO EDITAL</p><h1>{roles[attempt.role].name}</h1><p>{attempt.questions.length} questões em sequência · alternativas A–D · 100 pontos</p></div><div className={`timer ${remaining < 900000 ? 'urgent' : ''}`} role="timer" aria-label="Tempo restante"><Clock3 size={20}/><strong>{duration(remaining)}</strong><span>tempo restante</span></div></div><div className="exam-status"><span role="status">{saveStatus || "Prova recuperada da sua conta"}</span><button className="text-button" onClick={() => { setMessage(""); void flush(); }}>Tentar salvar</button><span>{answered}/{attempt.questions.length} respondidas</span></div>{attempt.repeated > 0 && <p className="date-notice">Este caderno reutiliza {attempt.repeated} questões/famílias já vistas: o estoque inédito de uma ou mais disciplinas foi esgotado.</p>}<div className="booklet-layout"><div className="booklet"><p className="exam-instructions">Assinale uma alternativa por questão. Você pode alterar respostas, deixar itens em branco e marcar para revisar. O gabarito aparece após a finalização. Sair da página não pausa o relógio.</p>{attempt.questions.map((q, i) => <section className="question-sheet" id={`questao-${i + 1}`} key={q.id} aria-labelledby={`title-${q.id}`}>
 {(i === 0 || attempt.questions[i - 1].subject !== q.subject) && <h2 className="subject-divider">{subjectNames[q.subject]}</h2>}<div className="question-title"><h3 id={`title-${q.id}`}>QUESTÃO {String(i + 1).padStart(2, "0")}</h3><span>{blueprint(attempt.role).find(s => s.subject === q.subject)?.weight} pontos</span></div>{q.passage && (i === 0 || attempt.questions[i - 1].passage !== q.passage ? <blockquote className="passage">{q.passage}<small>Texto-base autoral. Use este texto também nas questões seguintes que o referenciem.</small></blockquote> : <p className="shared-passage-note">Utilize o texto-base apresentado acima.</p>)}<p className="question-prompt">{q.prompt}</p><RadioGroup aria-labelledby={`title-${q.id}`} value={attempt.answers[q.id] === undefined ? "" : String(attempt.answers[q.id])} onValueChange={v => edit({ answers: { ...current.current!.answers, [q.id]: Number(v) } })} disabled={busy || !active || remaining === 0}>{q.options.map((o, j) => <label className={`answer-choice ${attempt.answers[q.id] === j ? 'selected' : ''}`} key={j} htmlFor={`${q.id}-${j}`}><RadioGroupItem id={`${q.id}-${j}`} value={String(j)}/><b>{"ABCD"[j]}</b><span>{o}</span></label>)}</RadioGroup><div className="question-tools"><button disabled={busy} aria-pressed={attempt.marked.includes(q.id)} onClick={() => edit({ marked: attempt.marked.includes(q.id) ? attempt.marked.filter(id => id !== q.id) : [...attempt.marked, q.id] })}><Flag size={15}/>{attempt.marked.includes(q.id) ? "Marcada para revisar" : "Marcar para revisar"}</button><button disabled={busy || attempt.answers[q.id] === undefined} onClick={() => { const a = { ...attempt.answers }; delete a[q.id]; edit({ answers: a }); }}>Limpar resposta</button></div></section>)}
 {attempt.role === "pedagogy" && <section className="question-sheet" id="redacao"><h2>Prova de redação</h2><p className="eyebrow">PROPOSTA AUTORAL · MESMO TEMPO DA OBJETIVA</p><h3>{essayThemes[attempt.essayTheme].title}</h3>{essayThemes[attempt.essayTheme].texts.map(t => <p className="passage" key={t}>{t}</p>)}<p>Redija um texto dissertativo-argumentativo, com até 30 linhas, sem identificação pessoal. Os textos motivadores são apoio; não substituem sua argumentação.</p><label htmlFor="essay">Folha de redação — pressione Enter para mudar de linha</label><textarea id="essay" rows={30} wrap="off" className="essay-paper" maxLength={12000} value={attempt.essay} disabled={busy || !active || remaining === 0} onChange={e => { if (e.target.value.split("\n").length <= 30)
                edit({ essay: e.target.value });
            else
                setMessage("Limite de 30 linhas. Revise o texto antes de colar novamente."); }}/><p>{attempt.essay ? attempt.essay.split("\n").length : 0}/30 linhas digitadas. A folha digital é uma aproximação; a letra manuscrita influencia a ocupação da folha oficial.</p></section>}
 <div className="submit-block"><p>Confira o cartão-resposta. Após entregar, não poderá alterar respostas.</p><Button className="primary-button" disabled={busy || !active} onClick={() => setConfirm(true)}>Entregar prova e ver resultado</Button></div></div><aside className="answer-sheet"><h2>Cartão-resposta</h2><p>{answered} respondidas · {attempt.questions.length - answered} em branco</p><Progress value={answered / attempt.questions.length * 100} aria-label="Questões respondidas"/><div className="question-map">{attempt.questions.map((q, i) => <a key={q.id} href={`#questao-${i + 1}`} className={`${attempt.answers[q.id] !== undefined ? 'answered' : ''} ${attempt.marked.includes(q.id) ? 'flagged' : ''}`} aria-label={`Questão ${i + 1}, ${attempt.answers[q.id] === undefined ? 'em branco' : `alternativa ${"ABCD"[attempt.answers[q.id]]}`}${attempt.marked.includes(q.id) ? ', revisar' : ''}`}><span>{i + 1}</span><b>{attempt.answers[q.id] === undefined ? '—' : "ABCD"[attempt.answers[q.id]]}</b></a>)}</div><p className="map-legend">Verde: respondida · borda laranja: revisar</p>{attempt.role === "pedagogy" && <a className="text-button" href="#redacao">Ir para redação →</a>}<Button className="primary-button full-button" disabled={busy || !active} onClick={() => setConfirm(true)}>Entregar prova</Button><p className="minimum-note">Mínimo: 50 pontos ponderados na objetiva. Não equivale à aprovação final.</p></aside></div></div>}
 {view === "result" && attempt?.result && <div className="section-wrap result-workspace"><p className="eyebrow">RESULTADO DO SIMULADO · {roles[attempt.role].name}</p><section className={`result-hero ${attempt.result.minimumReached ? 'passed' : 'retry'}`}><div className="result-icon"><Target /></div><h1>{attempt.result.minimumReached ? "Mínimo da objetiva atingido" : "Abaixo do mínimo da objetiva"}</h1><div className="result-score"><strong>{attempt.result.points}<small>/100</small></strong><span>pontos ponderados · {attempt.result.correct}/{attempt.result.total} acertos ({Math.round(attempt.result.correct / attempt.result.total * 100)}%)</span></div><p>Resultado de treino, sem valor oficial. Classificação, vagas, desempates e demais etapas determinam a aprovação no concurso.</p>{attempt.role === "pedagogy" && <p>Redação e títulos não estão incluídos nesta nota.</p>}</section><section className="panel"><h2>Desempenho por disciplina</h2><div className="table-scroll"><table><thead><tr><th>Disciplina</th><th>Acertos</th><th>Peso</th><th>Pontos</th></tr></thead><tbody>{attempt.result.sections.map(s => <tr key={s.subject}><td>{subjectNames[s.subject]}</td><td>{s.correct}/{s.total}</td><td>{s.weight}</td><td>{s.points}/{s.maximum}</td></tr>)}</tbody></table></div></section>{attempt.role === "pedagogy" && <section className="panel"><h2>Revisão da redação</h2><p>Texto salvo na conta. Sem nota automática: use a rubrica para autoavaliação ou peça correção a um professor.</p><h3>{essayThemes[attempt.essayTheme].title}</h3><pre className="saved-essay">{attempt.essay || "Redação não preenchida."}</pre><ul>{essayCriteria.map(([n, max]) => <li key={n}>{n}: até {max} pontos</li>)}</ul><p>Mínimo oficial: 50/100 na redação. O site não determina essa nota.</p></section>}<div className="result-actions"><Button className="primary-button" onClick={() => start(attempt.role)} disabled={busy}>Novo caderno</Button><Button variant="outline" onClick={() => go("history")}>Ver histórico</Button><Button variant="outline" onClick={() => setOnlyWrong(!onlyWrong)}>{onlyWrong ? "Mostrar todas" : "Só erros e brancos"}</Button></div><section className="review-list"><h2>Gabarito comentado</h2>{attempt.questions.filter(q => !onlyWrong || attempt.answers[q.id] !== q.answer).map(q => <ReviewQuestion key={q.id} question={q} number={attempt.questions.findIndex(x => x.id === q.id) + 1} selected={attempt.answers[q.id]}/>)}{onlyWrong && attempt.result.correct === attempt.result.total && <p>Nenhum erro nesta prova.</p>}</section></div>}
 {view === "history" && <div className="section-wrap history-workspace"><p className="eyebrow">SEU PROGRESSO</p><h1>Histórico individual</h1><p>Últimas 200 provas concluídas nesta conta. As notas usam os pesos de cada disciplina.</p><Button variant="outline" onClick={errors} disabled={busy || !user}>Abrir caderno de erros</Button>{!user ? <p>Entre com sua conta para consultar o histórico.</p> : history.length === 0 ? <div className="panel empty-state"><BookOpen /><h2>Seu histórico começa na primeira prova</h2><p>Conclua um caderno para acompanhar sua evolução.</p><Button onClick={() => go("home")}>Escolher trilha</Button></div> : <div className="table-scroll panel"><table><thead><tr><th>Data de início</th><th>Cargo</th><th>Acertos</th><th>Pontos</th><th>Revisão</th></tr></thead><tbody>{history.map(a => <tr key={a.id}><td>{date(a.created)}</td><td>{roles[a.role].name}</td><td>{a.correct}/{a.total}</td><td>{a.points}/100</td><td><button className="text-button" onClick={() => openResult(a.id)} disabled={busy}>Abrir gabarito</button></td></tr>)}</tbody></table></div>}</div>}
 {view === "errors" && <div className="section-wrap history-workspace"><button className="back-link" onClick={() => go("history")}>← Histórico</button><h1>Caderno de erros</h1><p>Erros e questões em branco nas últimas 200 provas concluídas. Acertos na tentativa mais recente retiram o item desta lista.</p><section className="review-list">{errorQuestions.length === 0 ? <p>Nenhum erro registrado.</p> : errorQuestions.map((q, i) => <ReviewQuestion key={q.id} question={q} number={i + 1}/>)}</section></div>}
 </>}</main><footer className="footer section-wrap"><span>Aprova Concurso · Preparação independente, sem vínculo com a banca</span><a href={officialUrl} target="_blank" rel="noreferrer">Instituto Verbena/UFG ↗</a><span>Edital conferido em 27/08/2026</span></footer><AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent className="confirm-dialog"><AlertDialogHeader><AlertDialogTitle>Entregar sua prova?</AlertDialogTitle><AlertDialogDescription>Você respondeu {answered} de {attempt?.questions.length ?? 0} questões. {(attempt?.questions.length ?? 0) - answered} estão em branco e {attempt?.marked.length ?? 0} marcadas para revisão.{attempt?.role === "pedagogy" && !attempt.essay ? " A redação está em branco." : ""} Após entregar, não será possível alterar respostas.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Voltar à revisão</AlertDialogCancel><AlertDialogAction onClick={submit}>Confirmar entrega</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>;
}
function Reference({value}:{value:string}) { const match=value.match(/https?:\/\/\S+/); return <p className="source-reference">Referência: {match ? <>{value.slice(0,match.index)}<a href={match[0]} target="_blank" rel="noreferrer">Consultar fonte ↗</a></> : value}</p>; }
function ReviewQuestion({ question: q, number, selected }: {
    question: PublicQuestion;
    number: number;
    selected?: number;
}) { return <article className="review-question"><p className="eyebrow">QUESTÃO {number} · {subjectNames[q.subject]} · {q.topic}</p>{q.passage && <blockquote className="passage">{q.passage}</blockquote>}<h3>{q.prompt}</h3><ol className="review-options" type="A">{q.options.map((o, i) => <li key={i} className={i === q.answer ? 'correct' : i === selected ? 'incorrect' : ''}>{o}{i === q.answer ? " ✓ Gabarito" : i === selected ? " · Sua resposta" : ""}</li>)}</ol><p><strong>Comentário:</strong> {q.explanation}</p><Reference value={q.source}/></article>; }
