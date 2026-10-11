# Paired watch event compatibility

The internal native-to-JavaScript command event now includes `expiresAt` from
the exact snapshot that validated the command. JavaScript rejects an event
whose expiry has passed before invoking its listener. A newer snapshot does
not extend an older event. The paired wire command schema remains version 1.

Rebuild the iOS and Android native binaries together with this JavaScript
update. Older native emitters that omit the field fail closed for commands.

Regression coverage executes the production JavaScript event listener with a
native-emitter double and checks the Swift/Kotlin event fields. The tests do
not replace Xcode/Gradle compilation or real paired-device timing checks.
