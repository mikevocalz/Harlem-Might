import type { CompanionCommand, CompanionSnapshot } from './src/protocol.ts';
export type { CompanionCommand, CompanionSnapshot } from './src/protocol.ts';
export const watchTransport = {
  async createHandoffId(): Promise<string> { throw new Error('Watch handoff requires the mobile app'); },
  async getStatus() { return { available: false, reachable: false }; },
  async publish(_snapshot: CompanionSnapshot): Promise<void> { throw new Error('Watch handoff requires the mobile app'); },
  async clear() {},
  addCommandListener(_listener: (command: CompanionCommand) => void) { return { remove() {} }; },
};
