/**
 * Server-side urgency check for symptom messages. The emergency notice must
 * not depend on the LLM alone (AI-APT-001 business rules), so any match here
 * adds it regardless of what the model returned.
 */
const URGENT_SYMPTOM_PATTERNS: RegExp[] = [
  /chest (pain|tightness|pressure)/i,
  /(difficulty|trouble|hard time) breathing/i,
  /(can'?t|cannot|unable to) breathe/i,
  /short(ness)? of breath/i,
  /severe(ly)? bleed/i,
  /bleeding (won'?t|will not|doesn'?t) stop/i,
  /unconscious|unresponsive|passed out|fainted/i,
  /(lost|loss of|losing) consciousness/i,
  /seizure|convuls/i,
  /stroke|slurred speech|face (is )?drooping/i,
  /suicid|kill (myself|himself|herself)|end my life/i,
];

export function soundsUrgent(text: string): boolean {
  return URGENT_SYMPTOM_PATTERNS.some((pattern) => pattern.test(text));
}

export const MEDICAL_ADVICE_DECLINE =
  "I'm sorry you're not feeling well. As an appointment assistant, I can't give medical advice or assess symptoms, so please speak with a doctor or another healthcare professional about how you're feeling. If you'd like, I can help you book an appointment with the specialty or doctor of your choice.";

export const EMERGENCY_NOTICE =
  "If this may be an emergency, please don't wait: go to the nearest emergency room now or call 911.";

export const PLEASE_REPHRASE =
  "Sorry, I didn't quite catch that. Could you say it another way? I can help you book an appointment, answer questions about the hospital, or show your appointments.";

/** RAG fallback when no published chunk clears the similarity threshold. */
export const NOT_VERIFIED =
  "I'm sorry, I couldn't verify that from the hospital's information, and I don't want to guess. Please contact the hospital directly for help with this question.";
