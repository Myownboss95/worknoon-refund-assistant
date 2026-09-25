import {
  clearStoredConversations,
  readStoredConversationId,
  storeConversationId,
} from './conversationStorage';

describe('conversation storage', () => {
  it('keeps one conversation id per backend in sessionStorage', () => {
    storeConversationId('laravel', 'a');
    storeConversationId('nest', 'b');

    expect(window.sessionStorage.getItem('worknoon.conversation.laravel')).toBe('a');
    expect(readStoredConversationId('laravel')).toBe('a');
    expect(readStoredConversationId('nest')).toBe('b');

    storeConversationId('laravel', null);
    expect(readStoredConversationId('laravel')).toBeNull();
  });

  it('clears every backend on a backend switch', () => {
    storeConversationId('laravel', 'a');
    storeConversationId('nest', 'b');
    clearStoredConversations();
    expect(readStoredConversationId('laravel')).toBeNull();
    expect(readStoredConversationId('nest')).toBeNull();
  });

  it('keeps working when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => storeConversationId('laravel', 'a')).not.toThrow();
    expect(readStoredConversationId('laravel')).toBeNull();
  });
});
