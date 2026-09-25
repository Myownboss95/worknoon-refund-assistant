import {
  ConversationDetailSchema,
  SendMessageResponseSchema,
  VerifyResponseSchema,
  type ConversationDetail,
  type Message,
  type SendMessageRequest,
  type VerifyRequest,
} from '@worknoon/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient, useBackend, type Backend } from '@/app/BackendContext';
import { ApiError } from '@/shared/api/ApiError';

export const chatKeys = {
  conversation: (backend: Backend, id: string) => [backend, 'conversation', id] as const,
};

function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  const seen = new Set(existing.map((message) => message.id));
  return [...existing, ...incoming.filter((message) => !seen.has(message.id))];
}

/** POST /customers/verify. Seeds the conversation cache so the chat renders without a refetch. */
export function useVerifyCustomer() {
  const { backend } = useBackend();
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: VerifyRequest) =>
      client.post('/customers/verify', input, VerifyResponseSchema),
    onSuccess: (data) => {
      queryClient.setQueryData<ConversationDetail>(
        chatKeys.conversation(backend, data.conversation.id),
        {
          ...data,
          decision: null,
        },
      );
    },
  });
}

/** GET /conversations/{id}. */
export function useConversation(conversationId: string) {
  const { backend } = useBackend();
  const client = useApiClient();
  return useQuery({
    queryKey: chatKeys.conversation(backend, conversationId),
    queryFn: () =>
      client.get(
        `/conversations/${encodeURIComponent(conversationId)}`,
        undefined,
        ConversationDetailSchema,
      ),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** POST /conversations/{id}/messages. */
export function useSendMessage(conversationId: string) {
  const { backend } = useBackend();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const key = chatKeys.conversation(backend, conversationId);

  return useMutation({
    mutationFn: (input: SendMessageRequest) =>
      client.post(
        `/conversations/${encodeURIComponent(conversationId)}/messages`,
        input,
        SendMessageResponseSchema,
      ),
    onSuccess: async (response) => {
      queryClient.setQueryData<ConversationDetail>(key, (previous) =>
        previous
          ? {
              ...previous,
              conversation: response.conversation,
              messages: mergeMessages(previous.messages, response.messages),
              decision: response.decision,
            }
          : previous,
      );
      // A decision changes item refund states (approved / pending); reload the order from the server.
      if (response.decision) await queryClient.invalidateQueries({ queryKey: key });
    },
    onError: async (error) => {
      if (
        error instanceof ApiError &&
        (error.code === 'CONVERSATION_CLOSED' || error.code === 'REFUND_ALREADY_EXISTS')
      ) {
        await queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
