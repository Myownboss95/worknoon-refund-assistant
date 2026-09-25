import type { ComposeInput, ExtractInput } from '../refund-analyzer.js';

/**
 * Escapes customer text placed inside `<customer_message>` (`&` first, then `<` and `>`), so no
 * nesting or spacing trick can close or open a delimiter tag. The injection detector still runs on
 * the raw text.
 */
export function escapeCustomerText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** User turn for extract.v1: trusted order facts, then the untrusted customer text. */
export function buildExtractUserContent(input: ExtractInput): string {
  const orderContext = JSON.stringify(input.order);
  const customerText = input.customerMessages.map(escapeCustomerText).join('\n---\n');
  return `<order_context>${orderContext}</order_context>\n<customer_message>${customerText}</customer_message>`;
}

/** User turn for compose.v1. */
export function buildComposeUserContent(input: ComposeInput): string {
  const decision = {
    outcome: input.outcome,
    amount: input.amount,
    firstName: input.firstName,
    itemNames: input.itemNames,
    customerReasons: input.outcome === 'denied' ? input.customerReasons : [],
    summary: input.summary,
  };
  return `<decision>${JSON.stringify(decision)}</decision>`;
}
