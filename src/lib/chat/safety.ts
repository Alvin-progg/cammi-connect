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
  "I'm not able to give medical advice or assess symptoms. Please speak with a doctor or another healthcare professional about how you're feeling.";

export const EMERGENCY_NOTICE =
  "If this may be an emergency, go to the nearest emergency room now or call 911.";

export const NOT_AVAILABLE_YET =
  "Sorry, I can't help with that here yet. This assistant is still being set up.";

export const PLEASE_REPHRASE =
  "Sorry, I didn't quite catch that. Could you rephrase your message?";
