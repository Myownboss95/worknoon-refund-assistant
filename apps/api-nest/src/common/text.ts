/** Control characters (Unicode category Cc) other than newline and tab. */
const CONTROL_CHARACTERS = /[^\P{Cc}\n\t]/gu;

/** Strips control characters except `\n` and `\t`, then trims (pipeline step 2). */
export function sanitizeMessageText(text: string): string {
  return text.replace(CONTROL_CHARACTERS, '').trim();
}
