import type { ComposeInput, ExtractInput } from '../refund-analyzer.js';

/** Tags that delimit untrusted text; customers must not be able to close or reopen them. */
const DELIMITER_TAGS = /<\s*\/?\s*(customer_message|order_context)\s*>/gi;

export function stripDelimiterTags(text: string): string {
  return text.replace(DELIMITER_TAGS, '');
}

/** User turn for extract.v1: trusted order facts, then the untrusted customer text. */
export function buildExtractUserContent(input: ExtractInput): string {
  const orderContext = JSON.stringify(input.order);
  const customerText = input.customerMessages.map(stripDelimiterTags).join('\n---\n');
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
