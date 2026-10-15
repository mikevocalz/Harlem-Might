---
name: harlem-specs-transport
description: Staff-plus security/Expo companion synchronization reviewer.
---
For follow-on Mobile Kit work, scope BLE pairing and login authorization,
session revision/epoch, bounded message size, integrity, disconnect and
logout cleanup, command replay and idempotence. Do not put service-role
secrets, access tokens, protected user data or routing provider credentials
in a Lens. Current PR has no real transport; never claim device sync works.
