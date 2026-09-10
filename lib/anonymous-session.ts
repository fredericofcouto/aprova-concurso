import { env } from "cloudflare:workers";

const COOKIE_NAME = "aprova-anonymous-id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RuntimeEnv = { ANONYMOUS_COOKIE_SECRET?: string };
export type AnonymousIdentity = { owner: string; name: "Visitante"; setCookie?: string };
const runtimeEnv = () => env as unknown as RuntimeEnv;
const bytesToBase64Url = (bytes: ArrayBuffer) => { let binary = ""; for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); };
const base64UrlToBytes = (value: string) => { const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4); const binary = atob(normalized); return Uint8Array.from(binary, char => char.charCodeAt(0)); };
async function signature(id: string, secret: string) { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return bytesToBase64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id))); }
async function validSignature(id: string, value: string, secret: string) { try { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]); return await crypto.subtle.verify("HMAC", key, base64UrlToBytes(value), new TextEncoder().encode(id)); } catch { return false; } }
function readCookie(request: Request) { const cookies = request.headers.get("cookie")?.split(";") ?? []; const item = cookies.find(cookie => cookie.trim().startsWith(`${COOKIE_NAME}=`)); return item?.trim().slice(COOKIE_NAME.length + 1) ?? null; }
export async function anonymousIdentity(request: Request): Promise<AnonymousIdentity> {
    const secret = runtimeEnv().ANONYMOUS_COOKIE_SECRET?.trim();
    if (!secret) throw new Error("Sessão anônima indisponível: segredo do servidor não configurado.");
    const saved = readCookie(request);
    if (saved) { const [id, mac] = saved.split("."); if (id && mac && UUID.test(id) && await validSignature(id, mac, secret)) return { owner: `anonymous:${id}`, name: "Visitante" }; }
    const id = crypto.randomUUID(); const mac = await signature(id, secret);
    return { owner: `anonymous:${id}`, name: "Visitante", setCookie: `${COOKIE_NAME}=${id}.${mac}; Max-Age=${COOKIE_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax` };
}
