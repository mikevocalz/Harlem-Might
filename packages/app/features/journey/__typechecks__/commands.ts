// Compiler-only consumers of the production runtime API; never executed.
import { journeyCommand } from '../runtime.ts';

export function commands(
  pauseOrResume: 'pause' | 'resume',
  stopOrConfirm: 'stop' | 'confirm-stop',
  unconfirmed: boolean,
  maybeConfirmed: true | undefined,
  mixedCommand: 'pause' | 'stop',
) {
  const pause: Promise<boolean> = journeyCommand('pause');
  const resume: Promise<boolean> = journeyCommand('resume');
  void journeyCommand(pauseOrResume);
  // Preserve the existing optional argument on pause/resume calls.
  void journeyCommand('pause', true);
  void journeyCommand('resume', undefined);
  void journeyCommand(pauseOrResume, maybeConfirmed);
  const stop: Promise<boolean> = journeyCommand('stop', true);
  const confirmStop: Promise<boolean> = journeyCommand('confirm-stop', true);
  void journeyCommand(stopOrConfirm, true);
  void journeyCommand(mixedCommand, true);

  // @ts-expect-error stopping a walk requires explicit confirmation
  void journeyCommand('stop');
  // @ts-expect-error confirming a visit requires explicit confirmation
  void journeyCommand('confirm-stop');
  // @ts-expect-error undefined is not confirmation
  void journeyCommand('stop', undefined);
  // @ts-expect-error undefined is not confirmation
  void journeyCommand('confirm-stop', undefined);
  // @ts-expect-error false is not confirmation
  void journeyCommand('stop', false);
  // @ts-expect-error false is not confirmation
  void journeyCommand('confirm-stop', false);
  // @ts-expect-error an unchecked boolean is not confirmation
  void journeyCommand(stopOrConfirm, unconfirmed);
  // @ts-expect-error potentially absent confirmation is not sufficient
  void journeyCommand(stopOrConfirm, maybeConfirmed);
  // @ts-expect-error a union containing stop still requires confirmation
  void journeyCommand(mixedCommand);

  return { pause, resume, stop, confirmStop };
}
