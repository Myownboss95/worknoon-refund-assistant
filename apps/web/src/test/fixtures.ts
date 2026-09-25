import type {
  ConversationDetail,
  Decision,
  Message,
  RefundRequestDetail,
  SendMessageResponse,
  VerifyResponse,
} from '@worknoon/contracts';

export const IDS = {
  conversation: '0b7c1f4e-2a55-4c1e-9d7a-6f1e2d3c4b5a',
  order: '1c8d2a5f-3b66-4d2f-8e8b-7a2f3e4d5c6b',
  itemBlender: '2d9e3b6a-4c77-4e3a-9f9c-8b3a4f5e6d7c',
  itemFinal: '3eaf4c7b-5d88-4f4b-8a0d-9c4b5a6f7e8d',
  greeting: '4fb05d8c-6e99-4a5c-9b1e-ad5c6b7a8f9e',
  customerMsg: '5ac16e9d-7faa-4b6d-8c2f-be6d7c8b9a0f',
  replyMsg: '6bd27fae-80bb-4c7e-9d3a-cf7e8d9cab1a',
  refund: '7ce380bf-91cc-4d8f-8e4b-d08f9eadbc2b',
  audit: '8df491c0-a2dd-4e9a-9f5c-e19aafbecd3c',
} as const;

const T0 = '2026-09-25T10:00:00.000Z';

export const verifyResponse: VerifyResponse = {
  conversation: { id: IDS.conversation, status: 'open', clarificationTurns: 0, createdAt: T0 },
  customer: { name: 'Ada Okafor', firstName: 'Ada' },
  order: {
    id: IDS.order,
    orderNumber: 'WN-1001',
    status: 'delivered',
    placedAt: '2026-09-16T10:00:00.000Z',
    deliveredAt: '2026-09-20T10:00:00.000Z',
    totalCents: 12900,
    currency: 'USD',
    items: [
      {
        id: IDS.itemBlender,
        sku: 'KIT-BLND-600',
        name: 'ProBlend 600 Blender',
        quantity: 1,
        unitPriceCents: 8900,
        lineTotalCents: 8900,
        finalSale: false,
        refundStatus: null,
      },
      {
        id: IDS.itemFinal,
        sku: 'KIT-MUG-SET',
        name: 'Stoneware Mug Set',
        quantity: 2,
        unitPriceCents: 2000,
        lineTotalCents: 4000,
        finalSale: true,
        refundStatus: 'approved',
      },
    ],
  },
  messages: [
    {
      id: IDS.greeting,
      role: 'assistant',
      content: 'Hi Ada, I can help with order WN-1001. Which items is this about?',
      itemIds: null,
      createdAt: T0,
    },
  ],
};

export const approvedDecision: Decision = {
  refundRequestId: IDS.refund,
  status: 'approved',
  decidedBy: 'policy',
  amountCents: 8900,
  currency: 'USD',
  decisiveRuleIds: ['R08'],
  customerReason: 'Your refund of $89.00 has been approved.',
};

const customerMessage: Message = {
  id: IDS.customerMsg,
  role: 'customer',
  content: 'My blender arrived with a cracked jug.',
  itemIds: [IDS.itemBlender],
  createdAt: '2026-09-25T10:01:00.000Z',
};

const replyMessage: Message = {
  id: IDS.replyMsg,
  role: 'assistant',
  content: 'Sorry about the cracked jug, Ada. Your refund of $89.00 has been approved.',
  itemIds: null,
  createdAt: '2026-09-25T10:01:01.000Z',
};

export const sendResponse: SendMessageResponse = {
  conversation: { id: IDS.conversation, status: 'closed', clarificationTurns: 0, createdAt: T0 },
  messages: [customerMessage, replyMessage],
  reply: replyMessage,
  decision: approvedDecision,
};

export const conversationAfterDecision: ConversationDetail = {
  ...verifyResponse,
  conversation: sendResponse.conversation,
  order: {
    ...verifyResponse.order,
    items: verifyResponse.order.items.map((item) =>
      item.id === IDS.itemBlender ? { ...item, refundStatus: 'approved' } : item,
    ),
  },
  messages: [...verifyResponse.messages, customerMessage, replyMessage],
  decision: approvedDecision,
};

export const escalatedDetail: RefundRequestDetail = {
  id: IDS.refund,
  status: 'escalated',
  decidedBy: 'policy',
  customer: { name: 'Emeka Obi', email: 'emeka.obi@example.com' },
  orderNumber: 'WN-1005',
  amountCents: 129900,
  currency: 'USD',
  reasonCategory: 'damaged',
  flags: [],
  decisiveRuleIds: ['R06'],
  createdAt: T0,
  items: [
    {
      orderItemId: IDS.itemBlender,
      sku: 'ELE-AERO-14',
      name: 'AeroBook 14 Laptop',
      quantity: 1,
      amountCents: 129900,
      finalSale: false,
    },
  ],
  conversation: { id: IDS.conversation, messages: [customerMessage, replyMessage] },
  trace: {
    policyVersion: '1.0',
    evaluatedAt: T0,
    facts: {
      orderStatus: 'delivered',
      daysSinceDelivery: 3,
      amountCents: 129900,
      recentApprovedRefunds: 0,
      finalSaleItemIds: [],
      alreadyRefundedItemIds: [],
    },
    rules: [
      { ruleId: 'R06', outcome: 'escalate', reason: 'Total above $500.00 needs human review' },
      { ruleId: 'R08', outcome: 'approve', reason: 'Damaged item within the window' },
    ],
    extraction: {
      reasonCategory: 'damaged',
      itemsMentioned: ['laptop'],
      claimsConflict: false,
      injectionSuspected: false,
      summary: 'Laptop screen cracked on arrival.',
      confidence: 0.92,
    },
    heuristicMatches: [],
    flags: [],
    clarificationTurns: 0,
    ai: {
      provider: 'mock',
      model: 'mock',
      promptVersions: { extract: 'extract.v1', compose: 'compose.v1' },
      calls: [
        {
          step: 'extract',
          attempt: 1,
          ok: true,
          latencyMs: 3,
          inputTokens: 0,
          outputTokens: 0,
          error: null,
        },
      ],
    },
    replyGuard: { passed: true, violations: [], usedTemplate: false },
  },
  review: null,
  auditEvents: [
    {
      id: IDS.audit,
      type: 'refund.decided',
      actor: 'system',
      data: { status: 'escalated' },
      createdAt: T0,
    },
  ],
};
