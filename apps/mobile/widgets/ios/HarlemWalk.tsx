import { Link, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

/**
 * Native WidgetKit rendering environment: this function is serialized.
 * Only props and inline literals may be referenced. No React hooks, app
 * stores, imports from @acme/widgets, async work or closures.
 */
export type HarlemWalkProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  destination: string;
};

const HarlemWalkView = (props: HarlemWalkProps, env: WidgetEnvironment) => {
  'widget';
  const compact = env.widgetFamily === 'systemSmall';
  const accessory = env.widgetFamily === 'accessoryRectangular' ||
    env.widgetFamily === 'accessoryInline' ||
    env.widgetFamily === 'accessoryCircular';
  return (
    <Link destination={props.destination}>
      <VStack spacing={compact || accessory ? 3 : 7} alignment="leading">
        <Text modifiers={[font({ size: accessory ? 9 : 11, weight: 'bold' }), foregroundStyle('#F8C626')]}>
          {props.eyebrow}
        </Text>
        <Text modifiers={[font({ size: accessory ? 14 : compact ? 17 : 23, weight: 'bold' })]}>
          {props.title}
        </Text>
        {!accessory && !compact ? <Text modifiers={[font({ size: 12 })]}>{props.subtitle}</Text> : null}
      </VStack>
    </Link>
  );
};

export default createWidget<HarlemWalkProps>('HarlemWalk', HarlemWalkView, {
  eyebrow: 'TAKE ME THERE',
  title: 'No walk in progress',
  subtitle: 'Open Harlem Might to discover more.',
  destination: 'harlemmight://walks',
});
