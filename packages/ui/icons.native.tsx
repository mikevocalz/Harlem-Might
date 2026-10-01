'use client';
/**
 * PLATFORM FORK — lucide-react-native wrapped with the css shim:
 * className text-* classes land as style.color, which drives the SVG
 * stroke via currentColor. Same call sites as web.
 */
import * as L from 'lucide-react-native';
import { css } from './html/css';

export type IconProps = React.ComponentProps<typeof L.Bell> & { className?: string };

const icon = (Component: React.ComponentType<object>, name: string) =>
  css(Component, `Icon(${name})`) as React.FC<IconProps>;

export const TrendingUp = icon(L.TrendingUp as React.ComponentType<object>, 'TrendingUp');
export const Users = icon(L.Users as React.ComponentType<object>, 'Users');
export const ShoppingCart = icon(L.ShoppingCart as React.ComponentType<object>, 'ShoppingCart');
export const BarChart3 = icon(L.BarChart3 as React.ComponentType<object>, 'BarChart3');
export const MessageCircle = icon(L.MessageCircle as React.ComponentType<object>, 'MessageCircle');
export const Calendar = icon(L.Calendar as React.ComponentType<object>, 'Calendar');
export const CheckSquare = icon(L.CheckSquare as React.ComponentType<object>, 'CheckSquare');
export const Bell = icon(L.Bell as React.ComponentType<object>, 'Bell');
export const ArrowUp = icon(L.ArrowUp as React.ComponentType<object>, 'ArrowUp');
export const LayoutGrid = icon(L.LayoutGrid as React.ComponentType<object>, 'LayoutGrid');
export const Palette = icon(L.Palette as React.ComponentType<object>, 'Palette');
export const Code = icon(L.Code as React.ComponentType<object>, 'Code');
export const Briefcase = icon(L.Briefcase as React.ComponentType<object>, 'Briefcase');
export const Brush = icon(L.Brush as React.ComponentType<object>, 'Brush');
export const Smartphone = icon(L.Smartphone as React.ComponentType<object>, 'Smartphone');
export const LineChart = icon(L.LineChart as React.ComponentType<object>, 'LineChart');
export const Star = icon(L.Star as React.ComponentType<object>, 'Star');
export const Box = icon(L.Box as React.ComponentType<object>, 'Box');
export const Navigation = icon(L.Navigation as React.ComponentType<object>, 'Navigation');
export const Moon = icon(L.Moon as React.ComponentType<object>, 'Moon');
export const ShieldCheck = icon(L.ShieldCheck as React.ComponentType<object>, 'ShieldCheck');
export const Layers = icon(L.Layers as React.ComponentType<object>, 'Layers');
export const ArrowRight = icon(L.ArrowRight as React.ComponentType<object>, 'ArrowRight');
export const Heart = icon(L.Heart as React.ComponentType<object>, 'Heart');
export const Eye = icon(L.Eye as React.ComponentType<object>, 'Eye');
export const UserPlus = icon(L.UserPlus as React.ComponentType<object>, 'UserPlus');
export const Package = icon(L.Package as React.ComponentType<object>, 'Package');
export const Wallet = icon(L.Wallet as React.ComponentType<object>, 'Wallet');
export const Flag = icon(L.Flag as React.ComponentType<object>, 'Flag');
export const Shield = icon(L.Shield as React.ComponentType<object>, 'Shield');
export const Home = icon(L.Home as React.ComponentType<object>, 'Home');
export const Compass = icon(L.Compass as React.ComponentType<object>, 'Compass');
export const User = icon(L.User as React.ComponentType<object>, 'User');
export const ChevronRight = icon(L.ChevronRight as React.ComponentType<object>, 'ChevronRight');
export const Bold = icon(L.Bold as React.ComponentType<object>, 'Bold');
export const Italic = icon(L.Italic as React.ComponentType<object>, 'Italic');
export const Underline = icon(L.Underline as React.ComponentType<object>, 'Underline');
export const Strikethrough = icon(L.Strikethrough as React.ComponentType<object>, 'Strikethrough');
export const Heading1 = icon(L.Heading1 as React.ComponentType<object>, 'Heading1');
export const Heading2 = icon(L.Heading2 as React.ComponentType<object>, 'Heading2');
export const Heading3 = icon(L.Heading3 as React.ComponentType<object>, 'Heading3');
export const List = icon(L.List as React.ComponentType<object>, 'List');
export const ListOrdered = icon(L.ListOrdered as React.ComponentType<object>, 'ListOrdered');
export const ListChecks = icon(L.ListChecks as React.ComponentType<object>, 'ListChecks');
export const Quote = icon(L.Quote as React.ComponentType<object>, 'Quote');
export const ImagePlus = icon(L.ImagePlus as React.ComponentType<object>, 'ImagePlus');
export const ChevronLeft = icon(L.ChevronLeft as React.ComponentType<object>, 'ChevronLeft');
export const Menu = icon(L.Menu as React.ComponentType<object>, 'Menu');
export const X = icon(L.X as React.ComponentType<object>, 'X');
export const Check = icon(L.Check as React.ComponentType<object>, 'Check');
export const Info = icon(L.Info as React.ComponentType<object>, 'Info');
export const TriangleAlert = icon(L.TriangleAlert as React.ComponentType<object>, 'TriangleAlert');
export const LoaderCircle = icon(L.LoaderCircle as React.ComponentType<object>, 'LoaderCircle');
export const Settings = icon(L.Settings as React.ComponentType<object>, 'Settings');
export const PanelLeftClose = icon(L.PanelLeftClose as React.ComponentType<object>, 'PanelLeftClose');
export const PanelLeftOpen = icon(L.PanelLeftOpen as React.ComponentType<object>, 'PanelLeftOpen');
export const PanelRightClose = icon(L.PanelRightClose as React.ComponentType<object>, 'PanelRightClose');
export const PanelRightOpen = icon(L.PanelRightOpen as React.ComponentType<object>, 'PanelRightOpen');
export const Columns2 = icon(L.Columns2 as React.ComponentType<object>, 'Columns2');
export const Trash2 = icon(L.Trash2 as React.ComponentType<object>, 'Trash2');
export const Copy = icon(L.Copy as React.ComponentType<object>, 'Copy');
export const MoreHorizontal = icon(L.MoreHorizontal as React.ComponentType<object>, 'MoreHorizontal');
export const Paperclip = icon(L.Paperclip as React.ComponentType<object>, 'Paperclip');
export const Video = icon(L.Video as React.ComponentType<object>, 'Video');
export const Undo2 = icon(L.Undo2 as React.ComponentType<object>, 'Undo2');
export const Redo2 = icon(L.Redo2 as React.ComponentType<object>, 'Redo2');
export const SquareCode = icon(L.SquareCode as React.ComponentType<object>, 'SquareCode');
export const AlignLeft = icon(L.AlignLeft as React.ComponentType<object>, 'AlignLeft');
export const AlignCenter = icon(L.AlignCenter as React.ComponentType<object>, 'AlignCenter');
export const AlignRight = icon(L.AlignRight as React.ComponentType<object>, 'AlignRight');
export const Link = icon(L.Link as React.ComponentType<object>, 'Link');
export const Heading4 = icon(L.Heading4 as React.ComponentType<object>, 'Heading4');
export const Heading5 = icon(L.Heading5 as React.ComponentType<object>, 'Heading5');
export const Heading6 = icon(L.Heading6 as React.ComponentType<object>, 'Heading6');
export const GripVertical = icon(L.GripVertical as React.ComponentType<object>, 'GripVertical');
export const Settings2 = icon(L.Settings2 as React.ComponentType<object>, 'Settings2');
export const CloudUpload = icon(L.CloudUpload as React.ComponentType<object>, 'CloudUpload');
export const FileUp = icon(L.FileUp as React.ComponentType<object>, 'FileUp');
export const Mic = icon(L.Mic as React.ComponentType<object>, 'Mic');
export const Square = icon(L.Square as React.ComponentType<object>, 'Square');
export const AudioLines = icon(L.AudioLines as React.ComponentType<object>, 'AudioLines');
export const Play = icon(L.Play as React.ComponentType<object>, 'Play');
export const Pause = icon(L.Pause as React.ComponentType<object>, 'Pause');
