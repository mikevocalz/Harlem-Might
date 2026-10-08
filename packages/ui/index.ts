// @acme/ui — pure presentational components (depends only on theme).
// Primitives: '@acme/ui/primitives' · styling wrappers: '@acme/ui/tw'.

// layout
export { Container, type ContainerProps } from './layout/Container';

// core
export { Text, type TextProps } from './Text';
export { Heading, type HeadingProps } from './Heading';
export { Button, type ButtonProps } from './Button';
export { IconButton, type IconButtonProps } from './IconButton';
export { Card, type CardProps } from './Card';
export { Badge, type BadgeProps } from './Badge';
export { Avatar, Avatar as MightsAvatar, type AvatarProps } from './Avatar';
export { BusinessIdentity, type BusinessIdentityProps } from './BusinessIdentity';
export { Image, type ImageProps } from './Image';

// forms
export { TextField, type TextFieldProps, type PasteEventPayload } from './TextField';
export { Textarea, type TextareaProps } from './Textarea';
export { Select, type SelectProps } from './Select';
export { Checkbox, type CheckboxProps } from './Checkbox';
export { Switch, type SwitchProps } from './Switch';
export { FormField, type FormFieldProps } from './FormField';
export { ErrorMessage, type ErrorMessageProps } from './ErrorMessage';
export { SearchBar, type SearchBarProps } from './SearchBar';
export { DropZone, type DropZoneProps, type DropAsset } from './DropZone';

// feedback
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { LoadingSkeleton, type LoadingSkeletonProps } from './LoadingSkeleton';
export { Toast, type ToastProps } from './Toast';
export { ToastCard, type ToastCardProps } from './ToastCard';
export { notify, Toaster } from './notify';
export type { NotifyOptions, NotifyVariant } from './notify.shared';

// overlays + nav
export { Modal, type ModalProps } from './Modal';
export { Dialog, DialogCard, type DialogProps } from './Dialog';
export { Lightbox, type LightboxProps } from './Lightbox';
export { BottomSheet, SheetSurface, type BottomSheetProps } from './BottomSheet';
export { TabBar, type TabBarProps } from './TabBar';
export { Toolbar, type ToolbarProps } from './Toolbar';
export { TabBarAccessory, type TabBarAccessoryProps } from './TabBarAccessory';

// data
export { VirtualList, type VirtualListProps } from './VirtualList';
export {
  DataTable,
  DataTable as MightsTable,
  type DataTableProps,
  type ColumnDef,
} from './DataTable';
export { useAppForm, withForm, useFieldContext, useFormContext, useFormStore } from './form';

export { SafeArea, type SafeAreaProps } from './SafeArea';
export { KeyboardAwareScroll, type KeyboardAwareScrollProps } from './keyboard-aware';
export { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from './SegmentedControl';
export { FieldGroup, type FieldGroupProps, type FieldSectionProps } from './FieldGroup';
export { Slider, type SliderProps } from './Slider';
export { Collapsible, type CollapsibleProps } from './Collapsible';
export { List, ListItem, type ListProps, type ListItemProps } from './List';
export { NativeSlot, type NativeSlotProps } from './NativeSlot';
export { Menu, type MenuProps, type MenuAction } from './Menu';
export { useSizeClass, type SizeClass } from './use-size-class';
export {
  Motion, AnimatePresence, createMotionComponent, createMotionAnimatedComponent,
  motion, MotionView, MotionText, FadeIn, ScaleIn, SlideUp, useHydrated,
  type MotionViewProps, type MotionTextProps, type MotionPresetProps,
} from './motion';
export { PressScale, type PressScaleProps } from './press-scale';
export {
  useReducedMotion,
  useReducedMotionStore,
  transitionFor,
  INSTANT_TRANSITION,
} from './reduced-motion';
export { Chip, type ChipProps } from './Chip';
export { useInstanceStore, useStore } from './use-instance-store';
export * from './audio';

export { GridFloor, type GridFloorProps } from './backgrounds/GridFloor';
export { GridScene, type GridSceneProps } from './backgrounds/GridScene';
export { GlyphCity, type GlyphCityProps, type GlyphCityVariant } from './backgrounds/GlyphCity';
export {
  CircuitButton,
  MightsCircuitButton,
  type CircuitButtonProps,
  GridCard,
  MightsNotchCard,
  type GridCardProps,
} from './future';
