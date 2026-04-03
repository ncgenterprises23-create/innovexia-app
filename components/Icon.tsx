"use client";

import {
  Table,
  LayoutGrid,
  List,
  CreditCard,
  Search,
  Bell,
  MessageSquare,
  User,
  Settings,
  LogOut,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Info,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Sun,
  Moon,
  Clock,
  Inbox,
  UserCheck,
  Check,
  CheckCircle,
  BarChart3,
  Trophy,
  Clipboard,
  ClipboardList,
  FileText,
  TrendingUp,
  Headset,
  Layout,
  Factory
} from 'lucide-react';

export type IconName =
  | 'table'
  | 'grid'
  | 'list'
  | 'card'
  | 'search'
  | 'bell'
  | 'message'
  | 'user'
  | 'settings'
  | 'logout'
  | 'plus'
  | 'edit'
  | 'trash'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'loader'
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-left'
  | 'chevron-right'
  | 'menu'
  | 'close'
  | 'sun'
  | 'moon'
  | 'clock'
  | 'inbox'
  | 'user-check'
  | 'check'
  | 'check-circle'
  | 'chart'
  | 'trophy'
  | 'clipboard'
  | 'checklist'
  | 'document'
  | 'trending'
  | 'headset'
  | 'layout'
  | 'factory';

interface IconProps {
  name: IconName;
  className?: string;
  size?: number;
}

export default function Icon({ name, className = 'ui-icon', size = 20 }: IconProps) {
  const iconProps = {
    className,
    size,
    strokeWidth: 2
  };

  switch (name) {
    case 'table':
      return <Table {...iconProps} />;
    case 'grid':
      return <LayoutGrid {...iconProps} />;
    case 'list':
      return <List {...iconProps} />;
    case 'card':
      return <CreditCard {...iconProps} />;
    case 'search':
      return <Search {...iconProps} />;
    case 'bell':
      return <Bell {...iconProps} />;
    case 'message':
      return <MessageSquare {...iconProps} />;
    case 'user':
      return <User {...iconProps} />;
    case 'settings':
      return <Settings {...iconProps} />;
    case 'logout':
      return <LogOut {...iconProps} />;
    case 'plus':
      return <Plus {...iconProps} />;
    case 'edit':
      return <Edit {...iconProps} />;
    case 'trash':
      return <Trash2 {...iconProps} />;
    case 'success':
      return <CheckCircle2 {...iconProps} />;
    case 'error':
      return <XCircle {...iconProps} />;
    case 'warning':
      return <AlertCircle {...iconProps} />;
    case 'info':
      return <Info {...iconProps} />;
    case 'loader':
      return <Loader2 {...iconProps} className={`${className} animate-spin`} />;
    case 'chevron-down':
      return <ChevronDown {...iconProps} />;
    case 'chevron-up':
      return <ChevronUp {...iconProps} />;
    case 'chevron-left':
      return <ChevronLeft {...iconProps} />;
    case 'chevron-right':
      return <ChevronRight {...iconProps} />;
    case 'menu':
      return <Menu {...iconProps} />;
    case 'close':
      return <X {...iconProps} />;
    case 'sun':
      return <Sun {...iconProps} />;
    case 'moon':
      return <Moon {...iconProps} />;
    case 'clock':
      return <Clock {...iconProps} />;
    case 'inbox':
      return <Inbox {...iconProps} />;
    case 'user-check':
      return <UserCheck {...iconProps} />;
    case 'check':
      return <Check {...iconProps} />;
    case 'check-circle':
      return <CheckCircle {...iconProps} />;
    case 'chart':
      return <BarChart3 {...iconProps} />;
    case 'trophy':
      return <Trophy {...iconProps} />;
    case 'clipboard':
      return <Clipboard {...iconProps} />;
    case 'checklist':
      return <ClipboardList {...iconProps} />;
    case 'document':
      return <FileText {...iconProps} />;
    case 'trending':
      return <TrendingUp {...iconProps} />;
    case 'headset':
      return <Headset {...iconProps} />;
    case 'layout':
      return <Layout {...iconProps} />;
    case 'factory':
      return <Factory {...iconProps} />;
    default:
      return <Info {...iconProps} />;
  }
}
