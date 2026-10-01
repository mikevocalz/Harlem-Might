/**
 * Direct access to Expo SDK 58's universal native component layer.
 *
 * Application code should normally consume the styled @acme/ui components.
 * This escape hatch exists for composed native surfaces that need SwiftUI /
 * Jetpack Compose primitives while still keeping platform imports inside /ui.
 */
export {
  BottomSheet,
  Button,
  Checkbox,
  Collapsible,
  Column,
  FieldGroup,
  Host,
  Icon,
  List,
  ListItem,
  Picker,
  RNHostView,
  Row,
  ScrollView,
  Slider,
  Spacer,
  Switch,
  Text,
  TextInput,
  useNativeState,
} from '@expo/ui';

export {
  SegmentedControl as NativeSegmentedControl,
  type SegmentedControlProps as NativeSegmentedControlProps,
} from '@expo/ui/community/segmented-control';

export {
  MenuView as NativeMenuView,
  type MenuComponentProps as NativeMenuViewProps,
} from '@expo/ui/community/menu';
