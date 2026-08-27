import { loadQuestionBank } from "@/lib/question-bank";
import { blueprint, eligible, roleIds } from "@/lib/exam-engine";
export const dynamic = "force-dynamic";
export async function GET() {
    try {
        const bank = await loadQuestionBank();
        const roles = Object.fromEntries(roleIds.map(role => [role, blueprint(role).map(section => {
                const pool = eligible(bank, role, section.subject);
                return { ...section, available: pool.length, families: new Set(pool.map(q => q.family)).size, topics: [...new Set(pool.map(q => q.syllabusItem))] };
            })]));
        return Response.json({ total: bank.length, roles }, { headers: { "Cache-Control": "public, max-age=60" } });
    }
    catch {
        return Response.json({ error: "Banco temporariamente indisponível." }, { status: 503 });
    }
}
