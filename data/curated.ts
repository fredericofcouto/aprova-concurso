import type { Question, RoleId, Subject } from "../lib/exam-engine";
export const sources = {
 ethics: "CFP, Código de Ética Profissional (Res. 010/2005): https://site.cfp.org.br/wp-content/uploads/2012/07/codigo-de-etica-psicologia.pdf",
 assessment: "CFP, Resolução 31/2022 e SATEPSI: https://satepsi.cfp.org.br/legislacao.cfm",
 sus: "Lei 8.080/1990, arts. 2º–7º e 18: https://www.planalto.gov.br/ccivil_03/leis/l8080.htm",
 participation: "Lei 8.142/1990, art. 1º: https://www.planalto.gov.br/ccivil_03/leis/l8142.htm",
 loas: "Lei 8.742/1993 (LOAS): https://www.planalto.gov.br/ccivil_03/leis/l8742.htm",
 eca: "Lei 8.069/1990 (ECA): https://www.planalto.gov.br/ccivil_03/leis/l8069.htm",
 lbi: "Lei 13.146/2015 (LBI): https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm",
 ldb: "Lei 9.394/1996 (LDB), títulos IV e V: https://www.planalto.gov.br/ccivil_03/leis/l9394.htm",
 bncc: "MEC, BNCC, Educação Infantil e Ensino Fundamental: https://basenacionalcomum.mec.gov.br/images/BNCC_20dez_site.pdf",
 local: "Lei Orgânica de São Miguel do Araguaia, texto disponibilizado pela Câmara (consultar emendas): https://sapl.saomigueldoaraguaia.go.leg.br/norma/445",
 social: "CFESS, Código de Ética e Lei 8.662/1993: https://cfess.org.br/legislacao/view/207/codigo-de-etica-profissional-doa-assistente-social-10-edicao",
 icd: "OMS, Clinical descriptions and diagnostic requirements for ICD-11: https://www.who.int/publications/i/item/9789240077263",
 pnab: "Ministério da Saúde, PNAB, Portaria 2.436/2017: https://bvsms.saude.gov.br/bvs/saudelegis/gm/2017/prt2436_22_09_2017.html",
 acs: "Lei 11.350/2006: https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11350.htm",
 ibge: "IBGE, histórico de São Miguel do Araguaia: https://biblioteca.ibge.gov.br/biblioteca-catalogo.html?id=33591&view=detalhes",
 edital: "Item do Anexo IV do edital; questão autoral de fundamentos, não reproduzida de prova oficial.",
};
export type Entry = [topic:string,item:string,prompt:string,correct:string,wrong1:string,wrong2:string,wrong3:string,explanation:string,source?:keyof typeof sources];
export function makeQuestions(role:RoleId, entries:Entry[]):Question[]{return entries.map((r,i)=>({id:`aprova-${role}-${i+1}`,family:`aprova-${role}-${i+1}`,role,level:role==='ti'||role==='acs'?'MEDIO':'SUPERIOR',subject:'ESPECIFICOS',topic:r[0],syllabusItem:r[1],prompt:r[2],options:[r[3],r[4],r[5],r[6]],answer:0,explanation:r[7],source:sources[r[8]||'edital'],use:'prova'}));}
export function commonQuestion(id:string,subject:Subject,level:Question['level'],topic:string,item:string,prompt:string,options:string[],answer:number,explanation:string,passage?:string,source=sources.edital):Question{return{id,family:id,role:'common',level,subject,topic,syllabusItem:item,prompt,options,answer,explanation,passage,source,use:'prova'};}
