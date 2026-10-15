// A period after an abbreviation or an initial ("St.", "Jr.", "W.") does not
// end the sentence; splitting there cut deks to "The St.".
const ABBREVIATIONS = /(?:\b(?:St|Jr|Sr|Dr|Mr|Mrs|Ms|Ave|Mt|No|Rev|Gen|Col|Lt|Capt|Gov|Sen|Rep|Inc|Co|vs|c|ca)|\b[A-Z])\.$/;

export function firstSentence(text: string): string {
  const parts = text.split(/(?<=[.!?])\s+/);
  let sentence = '';
  for (const part of parts) {
    sentence = sentence ? `${sentence} ${part}` : part;
    if (!ABBREVIATIONS.test(part)) break;
  }
  return sentence;
}

/** A story dek: the first sentence, cut at a word boundary with an ellipsis past `max` characters. */
export function dekFrom(text: string, max = 240): string {
  const sentence = firstSentence(text);
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '')}…`;
}
