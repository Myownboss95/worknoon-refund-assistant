import { useState } from 'react';
import { useBackend } from '@/app/BackendContext';
import { ConversationView } from './components/ConversationView';
import { ScenarioPanel } from './components/ScenarioPanel';
import { VerifyForm } from './components/VerifyForm';
import { readStoredConversationId, storeConversationId } from './conversationStorage';
import { useScenarios, type DemoScenario } from './hooks/useScenarios';

export function CustomerPage() {
  const scenarios = useScenarios();
  const { backend } = useBackend();
  // Restored from sessionStorage so a refresh reopens the same chat (the page remounts per backend).
  const [conversationId, setConversationIdState] = useState<string | null>(() =>
    readStoredConversationId(backend),
  );
  const [activeScenarioId, setActiveScenarioId] = useState<number | null>(null);
  // Bumped on every scenario pick so the form remounts with the new prefill.
  const [formVersion, setFormVersion] = useState(0);

  function setConversationId(next: string | null) {
    storeConversationId(backend, next);
    setConversationIdState(next);
  }

  const activeScenario = scenarios.find((scenario) => scenario.id === activeScenarioId) ?? null;

  function selectScenario(scenario: DemoScenario) {
    setActiveScenarioId(scenario.id);
    setConversationId(null);
    setFormVersion((version) => version + 1);
  }

  function startOver() {
    setConversationId(null);
    setFormVersion((version) => version + 1);
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12 lg:py-8">
      <section className="flex flex-col gap-4 lg:col-span-8" aria-labelledby="customer-heading">
        <div>
          <h1 id="customer-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
            Refund assistant
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verify an order, pick the items and describe the problem. Our policy engine decides; the
            AI only helps understand and explain.
          </p>
        </div>

        {conversationId ? (
          <ConversationView
            key={conversationId}
            conversationId={conversationId}
            scenario={activeScenario}
            onStartOver={startOver}
            onNotFound={startOver}
          />
        ) : (
          <VerifyForm
            key={formVersion}
            defaultValues={
              activeScenario
                ? { email: activeScenario.email, orderNumber: activeScenario.orderNumber }
                : undefined
            }
            onVerified={(response) => setConversationId(response.conversation.id)}
          />
        )}
      </section>

      <aside className="lg:col-span-4" aria-label="Demo scenarios">
        <div className="lg:sticky lg:top-20">
          <ScenarioPanel
            scenarios={scenarios}
            activeScenarioId={activeScenarioId}
            onSelect={selectScenario}
          />
        </div>
      </aside>
    </div>
  );
}
