import { requireOptionalNativeModule, type EventSubscription, type NativeModule } from 'expo';
import { isCompanionCommand, isCompanionSnapshot, type CompanionCommand, type CompanionSnapshot } from './src/protocol.ts';
export type { CompanionCommand, CompanionSnapshot } from './src/protocol.ts';

declare class NativeWalkCompanion extends NativeModule<{ onCommand: (event: { json: string; expiresAt: string }) => void }> {
  createHandoffId(): Promise<string>;
  getStatus(): Promise<{ available: boolean; reachable: boolean }>;
  publish(json: string): Promise<void>;
  clear(): Promise<void>;
}
const native = requireOptionalNativeModule<NativeWalkCompanion>('WalkCompanion');

export const watchTransport = {
  async createHandoffId() {
    if (!native) throw new Error('Paired watch support requires a native build');
    return native.createHandoffId();
  },
  async getStatus() { return native?.getStatus() ?? { available: false, reachable: false }; },
  async publish(snapshot: CompanionSnapshot) {
    if (!isCompanionSnapshot(snapshot)) throw new Error('Invalid or expired watch handoff');
    if (!native) throw new Error('Paired watch support requires a native build');
    await native.publish(JSON.stringify(snapshot));
  },
  async clear() { await native?.clear(); },
  addCommandListener(listener: (command: CompanionCommand) => void): EventSubscription {
    if (!native) return { remove() {} };
    return native.addListener('onCommand', ({ json, expiresAt }) => {
      try {
        // Native receipt is not a committed command. JS delivery can lag behind
        // the snapshot that authorized it, even while both apps remain active.
        // Keep that original expiry; a newer publication cannot renew this event.
        if (typeof expiresAt !== 'string' || !(Date.parse(expiresAt) > Date.now())) return;
        const command: unknown = JSON.parse(json);
        if (isCompanionCommand(command)) listener(command);
      } catch { /* Malformed transport data never reaches the session controller. */ }
    });
  },
};
