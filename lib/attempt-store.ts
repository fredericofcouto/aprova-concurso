import { env } from "cloudflare:workers";
import { grade, type Attempt, type Question, type RoleId } from "./exam-engine";
export type StoredAttempt = {
    id: string;
    owner: string;
    role: RoleId;
    created: number;
    deadline: number;
    finished: number | null;
    status: "active" | "completed";
    questions: string;
    answers: string;
    marked: string;
    essay: string;
    essay_theme: number;
    repeated: number;
    revision: number;
};
export const database = () => env.DB;
export async function expireAttempts(owner: string) {
    const now = Date.now();
    await database().prepare("UPDATE exam_attempts SET status='completed', finished=deadline, open_key=NULL, revision=revision+1 WHERE owner=? AND status='active' AND deadline<=?").bind(owner, now).run();
}
export async function getAttempt(id: string, owner: string) {
    return database().prepare("SELECT * FROM exam_attempts WHERE id=? AND owner=?").bind(id, owner).first<StoredAttempt>();
}
export function publicAttempt(row: StoredAttempt): Attempt {
    const questions = JSON.parse(row.questions) as Question[];
    const answers = JSON.parse(row.answers) as Record<string, number>;
    return { id: row.id, role: row.role, created: row.created, deadline: row.deadline, finished: row.finished, status: row.status, answers, marked: JSON.parse(row.marked), essay: row.essay, essayTheme: row.essay_theme, repeated: row.repeated, revision: row.revision,
        questions: row.status === "completed" ? questions : questions.map(q => ({ id: q.id, family: q.family, role: q.role, level: q.level, subject: q.subject, topic: q.topic, syllabusItem: q.syllabusItem, passage: q.passage, prompt: q.prompt, options: q.options, source: q.source, use: q.use })),
        ...(row.status === "completed" ? { result: grade(questions, answers, row.role) } : {}),
    };
}
