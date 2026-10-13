# Harlem Might — Specs Mobile Kit handoff contract

This is the **application-side message contract** for the future Expo Modules
2.0 Mobile Kit adapter, not an implementation of Bluetooth pairing. The
implementation deliberately does not expose React Native views, ViroCore, or
Payload access from Lens Studio.

## Ownership

- The signed-in phone app owns account permission, place selection and the
  canonical navigation controller.
- `projectHarlemSpecs` prepares a limited view of the current app state.
- `createSpecsHandoffSnapshot` sends **only** serializable `scene + targets`.
  It does not transfer cookies, auth tokens, user records or route geometry.
- `SpecsHandoffGate` checks session, ephemeral pairing epoch, monotonic
  revision, expiry, action target binding and bounded replay ledger.
- A future `SpecsMobileKitTransport` must authenticate the paired owner and
  carry messages over the official iOS/Android Mobile Kit SDK. A matching
  `handoffId` alone is not authentication.

## Wire types

```ts
interface SpecsHandoffSnapshot {
  schemaVersion: 1;
  handoffId: string;
  sessionId: string;
  revision: number;
  issuedAtMs: number;
  expiresAtMs: number;
  presentation: { scene: { version: 1; nodes: SpecsSceneNode[] };
                  targets: { targetId: string; action: string }[] };
}
```

No unsolicited dynamic commands should execute directly in Lens. The phone
must check owner/login, permission scope, active handoff, fresh canonical
session, expected revision and a genuine user confirmation before invoking a
real app action. The gate is defense in depth, not the auth provider.

## Transport requirements (next native PR)

1. Use official `specs-devs/samples/Specs Mobile Kit` and the current Specs
   framework for BLE bonding + session establishment. No new backend.
2. Expo Modules 2.0 Android/iOS adapters expose connect/status/send/receive/
   disconnect with a single active session, consent and clean teardown.
3. A successful send or request-response transport ACK is **not** evidence
   the canonical navigation command was accepted by the phone. Return a
   separate revisioned app-state projection after successful controller work.
4. Rotate a random `handoffId` on login switch, logout, reconnect, permission
   revocation or expiry. Clear outstanding commands. Never reattach an old
   session merely because the physical glasses are the same.
5. Chunk authenticated route geometry separately with bounded size and
   route-generation IDs, and only present it on Lens with permissioned GPS
   alignment. Do not reconstruct turns by drawing straight lines.
6. Limit frame size (12 KiB), commands per handoff (128), age (60 seconds),
   total SceneObjects (32) and action targets (4). Reject unknown fields
   and remote image/model URLs; use registered Lens asset IDs.
7. If transport is offline, keep the explicitly labelled offline Preview and
   disable real navigation. No stale "live" information.
8. Test interrupt/reconnect, BLE loss, stale revision, duplicate commands,
   malformed payload, large Unicode strings, account switching and shutdown.

## Real-world test ladder

Run app Node tests and typecheck; follow with Specs Mobile Kit simulator,
CLAD LEAF interaction and actual iOS/Android phone ↔ Specs hardware tests.
BLE radio range, device bonding and physical sensor behavior are **not**
validated by this pure TypeScript contract.
