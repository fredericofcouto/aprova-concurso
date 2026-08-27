import { execFileSync } from "node:child_process";
const text = execFileSync("pdftotext", ["-layout", process.argv[2], "-"], { encoding: "utf8" });
const lines = text.split("\n");
const block = (start, end) => lines.slice(start - 1, end).join("\n").replace(/\f/g, "");
function numbered(raw) {
  return raw.split(/AGENTE DE COMBATE ÀS ENDEMIAS|PROFESSOR DE CIÊNCIAS/)[0].replace(/\s+/g, " ").trim().split(/(?=\b\d{1,2}\. [A-ZÁÉÍÓÚÂÊÔÇ])/).filter(s => /^\d+\./.test(s)).map(s => s.trim());
}
function common(raw) {
  const p = raw.indexOf("LÍNGUA PORTUGUESA");
  const r = raw.indexOf("RACIOCÍNIO LÓGICO-MATEMÁTICO");
  const g = raw.indexOf("REALIDADE ÉTNICA");
  const end = raw.indexOf("CONHECIMENTOS ESPECÍFICOS");
  return { PORTUGUES: numbered(raw.slice(p, r)), RLM: numbered(raw.slice(r, g)), GOIAS: numbered(raw.slice(g, end < 0 ? undefined : end)) };
}
console.log(JSON.stringify({ common: { MEDIO: common(block(4172, 4208)), SUPERIOR: common(block(4695, 4739)) }, specific: { acs: numbered(block(4211, 4236)), ti: numbered(block(4576, 4595)), social: numbered(block(4795, 4821)), pedagogy: numbered(block(5336, 5361)), psychology: numbered(block(5540, 5568)) } }, null, 2));
