import scenariosData from '@repo-contracts/scenarios.json';
import { RefundStatusSchema, type RefundStatus } from '@worknoon/contracts';
import { z } from 'zod';

const ScenarioFileSchema = z.object({
  customers: z.array(z.object({ key: z.string(), name: z.string() })),
  scenarios: z.array(
    z.object({
      id: z.number().int(),
      title: z.string(),
      customerKey: z.string(),
      email: z.string(),
      orderNumber: z.string(),
      skus: z.array(z.string()),
      messages: z.array(z.string()).min(1),
      expected: z.object({ status: RefundStatusSchema }),
    }),
  ),
});

export interface DemoScenario {
  id: number;
  title: string;
  customerName: string;
  email: string;
  orderNumber: string;
  skus: string[];
  messages: string[];
  expectedStatus: RefundStatus;
}

function loadScenarios(): DemoScenario[] {
  const parsed = ScenarioFileSchema.safeParse(scenariosData);
  if (!parsed.success) return [];
  const names = new Map(parsed.data.customers.map((customer) => [customer.key, customer.name]));
  return parsed.data.scenarios.map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    customerName: names.get(scenario.customerKey) ?? scenario.email,
    email: scenario.email,
    orderNumber: scenario.orderNumber,
    skus: scenario.skus,
    messages: scenario.messages,
    expectedStatus: scenario.expected.status,
  }));
}

/** Parsed once at module load: the file is static, bundled demo data. */
const SCENARIOS = loadScenarios();

export function useScenarios(): DemoScenario[] {
  return SCENARIOS;
}
