import { importedQuestions } from './imported';
import { commonQuestions } from './common';
import { psychologyQuestions } from './psychology';
import { socialQuestions } from './social';
import { acsQuestions } from './acs';
import { pedagogyQuestions } from './pedagogy';
export const curatedBank = [...importedQuestions,...commonQuestions,...psychologyQuestions,...socialQuestions,...acsQuestions,...pedagogyQuestions].map(q => {
  if (!q.source.includes('sapl.saomigueldoaraguaia')) return q;
  const prompt = q.prompt.toLowerCase();
  if (prompt.includes('109') || (prompt.includes('sindical') && prompt.includes('municipal'))) return {...q, family:'local-sindicato'};
  if (prompt.includes('prazo de validade')) return {...q, family:'local-validade-concurso'};
  if (q.topic.includes('Aperfeiçoamento') || q.topic.includes('Formação profissional') || q.topic.includes('Lei Orgânica: formação')) return {...q, family:'local-formacao-profissional'};
  if (prompt.includes('art. 161') && prompt.includes('preventiv')) return {...q,family:'local-prevencao-assistencia'};
  return q;
});
