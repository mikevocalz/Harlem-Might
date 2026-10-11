'use client';
import { MightsButton, MightsText } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';
export function JourneyDeviceActions({ watchEnabled, watchBusy, watchMessage, onWatch, arAvailable, onAr }: {
  watchEnabled: boolean; watchBusy: boolean; watchMessage: string; onWatch(): void;
  arAvailable: boolean; onAr(): void;
}) {
  return <View className="gap-3">
    <MightsText size="small">{watchMessage}</MightsText>
    <MightsText size="small">Watch handoff shares this walk’s title, stop names and current instruction with your paired watch. Both apps must stay open. It ends when you leave the app; reconnecting requires a new handoff.</MightsText>
    <View className="flex-row flex-wrap gap-3">
      <MightsButton disabled={watchBusy} variant="outline" onPress={onWatch}>{watchEnabled ? 'End watch handoff' : 'Hand off to paired watch'}</MightsButton>
      {arAvailable ? <MightsButton variant="secondary" onPress={onAr}>Try Viro AR guidance</MightsButton> : null}
    </View>
    <MightsText size="small">{arAvailable ? 'Camera access and device AR tracking are checked when Viro opens. You can always return to the map and story.' : 'AR guidance needs a supported phone build and an active route. The text story above is available without AR.'}</MightsText>
  </View>;
}
