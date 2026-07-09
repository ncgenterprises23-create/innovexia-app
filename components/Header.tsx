"use client";
// Version: 1.0.3 - UI Cleanup (Date, ID, Delete)
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ensureSessionId } from '@/utils/session';
import Icon, { IconName } from './Icon';
import { useThemeColor } from './ThemeColorProvider';

// Extend window type for nbdDrawerOpen flag
declare global {
  interface Window {
    nbdDrawerOpen?: boolean;
  }
}

interface HeaderProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  disableNotifications?: boolean;
}

interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  resource_id?: string | number;
  target_page?: string;
  action_by?: string;
  is_read: boolean;
  created_at: string;
}

export default function Header({ isOpen, setIsOpen, disableNotifications = false }: HeaderProps) {
  const { theme, setTheme, colors } = useThemeColor();
  const [user, setUser] = useState<any>(null);
  const [fullUserData, setFullUserData] = useState<any>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [activeNotifTab, setActiveNotifTab] = useState('all');
  const notificationBtnRef = useRef<HTMLButtonElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const router = useRouter();

  const pages: { name: string; path: string; icon: IconName }[] = [
    { name: 'Dashboard', path: '/dashboard', icon: 'chart' },
    { name: 'PC Dashboard', path: '/pc-dashboard', icon: 'chart' },
    { name: 'Score', path: '/score', icon: 'trophy' },
    { name: 'Attendance', path: '/attendance', icon: 'clock' },
    { name: 'Delegations', path: '/delegation', icon: 'clipboard' },
    { name: 'Checklist', path: '/checklist', icon: 'checklist' },
    { name: 'Todo', path: '/todo', icon: 'check' },

    { name: 'O2D', path: '/o2d', icon: 'clipboard' },
    { name: 'Dealer_Kit', path: '/Dealer_Kit', icon: 'clock' },
    { name: 'Export FMS', path: '/export-fms', icon: 'clipboard' },
    { name: 'NBD', path: '/nbd', icon: 'clipboard' },
    { name: 'Collection', path: '/collection', icon: 'clipboard' },
    { name: 'Payable', path: '/payable', icon: 'clipboard' },
    { name: 'NBD Incoming', path: '/nbd-incoming', icon: 'clipboard' },
    { name: 'CRR', path: '/crr', icon: 'clipboard' },
    { name: 'IMS RM', path: '/ims-rm', icon: 'clipboard' },
    { name: 'Pre Order', path: '/pre-order', icon: 'clipboard' },
    { name: 'Inventory', path: '/inventory', icon: 'clipboard' },
    { name: 'Freshness', path: '/freshness', icon: 'chart' },
    { name: 'Tracker', path: '/tracker', icon: 'clock' },
    { name: 'Documents', path: '/documents', icon: 'document' },
    { name: 'Production', path: '/production', icon: 'factory' },
    { name: 'HelpDesk', path: '/helpdesk', icon: 'headset' },
    { name: 'Users', path: '/users', icon: 'user' },
    { name: 'Chat', path: '/chat', icon: 'message' },
  ];

  const filteredPages = pages.filter(page =>
    page.name.toLowerCase().includes(searchQuery.toLowerCase())
  );



  useEffect(() => {
    const checkAuth = async () => {
      try {
        const sessionId = ensureSessionId();
        const response = await fetch('/api/auth', { headers: { 'x-session-id': sessionId } });
        const data = await response.json();
        if (data.authenticated) {
          setUser(data.user);
          // Fetch notification count with user data (only if notifications are enabled)
          if (!disableNotifications) {
            fetchNotificationCount(data.user.id, data.user.role_name || data.user.role || '');
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      }
    };

    checkAuth();

    // Poll for notifications every 30 seconds (only if notifications are enabled)
    const interval = disableNotifications ? null : setInterval(() => {
      if (user) {
        fetchNotificationCount(user.id, user.role_name || user.role || '');
      }
    }, 30000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user?.id, disableNotifications]);

  const fetchNotificationCount = async (userId: string, userRole: string) => {
    try {
      const response = await fetch(`/api/notifications?userId=${userId}&userRole=${userRole}&unreadOnly=true`);
      if (response.ok) {
        const data = await response.json();
        setNotificationCount(data.length);
      }
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    setLoadingNotifications(true);
    try {
      const userRole = user.role_name || user.role || '';
      const response = await fetch(`/api/notifications?userId=${user.id}&userRole=${userRole}&unreadOnly=false`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      } else {
        console.error('❌ Failed to fetch notifications:', response.statusText);
      }
    } catch (error) {
      console.error('❌ Failed to fetch notifications:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) {
      fetchNotifications();
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const response = await fetch(`/api/notifications?id=${id}`, {
        method: 'PUT',
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notif => notif.id === id ? { ...notif, is_read: true } : notif)
        );
        fetchNotificationCount(user.id, user.role_name);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleDeleteNotification = async (id: number) => {
    try {
      const response = await fetch(`/api/notifications?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(notif => notif.id !== id));
        fetchNotificationCount(user.id, user.role_name);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNavigateToTask = async (notification: Notification) => {
    // ONLY delete if current user is the target recipient
    if (String(notification.user_id) === String(user?.id)) {
      await handleDeleteNotification(notification.id);
    }

    setShowNotifications(false);

    // Deep linking
    const page = notification.target_page || notification.type?.split('_')[0] || 'delegation';
    const resourceId = notification.resource_id || (notification as any).delegation_id;

    if (resourceId) {
      router.push(`/${page}?id=${resourceId}`);
    } else {
      router.push(`/${page}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'delegation_created':
        return <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>;
      case 'delegation_updated':
        return <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
      case 'status_changed':
        return <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      case 'remark_added':
        return <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>;
      default:
        return <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr || dateStr === 'N/A') return '';

    let date: Date;

    // Try to extract numbers from any string (dd/mm/yyyy HH:mm:ss or similar)
    const parts = dateStr.split(/[^0-9]/).filter(p => p.length > 0);

    if (parts.length >= 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]);
      const hour = parts[3] ? parseInt(parts[3]) : 0;
      const min = parts[4] ? parseInt(parts[4]) : 0;
      const sec = parts[5] ? parseInt(parts[5]) : 0;

      date = new Date(year, month, day, hour, min, sec);
    } else {
      date = new Date(dateStr);
    }

    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const handleLogout = async () => {
    const sessionId = ensureSessionId();
    await fetch('/api/logout', { method: 'POST', headers: { 'x-session-id': sessionId } });
    router.push('/login');
  };

  const fetchFullUserData = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        const fullUser = data.users?.find((u: any) => u.id === user.id);
        if (fullUser) {
          setFullUserData(fullUser);
        }
      }
    } catch (error) {
      console.error('Error fetching full user data:', error);
    }
  };

  const handleOpenProfile = () => {
    setShowProfileMenu(false);
    setShowProfileModal(true);
    fetchFullUserData();
  };

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen toggle failed:', error);
    }
  };

  const handlePageNavigation = (path: string) => {
    router.push(path);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  return (
    <>
      <motion.header
        className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-40"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="flex items-center justify-between px-4 py-4">
          {/* Left: Menu Toggle & Search */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            {/* Hamburger Menu Button - Visible on all screens */}
            <motion.button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-xl text-gray-800 dark:text-gray-200 hover:bg-[var(--theme-primary)]/20 dark:hover:bg-gray-700 transition-all"
              title="Toggle sidebar"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </motion.button>

            {/* Search */}
            <div className="flex-1 relative">
              <Icon name="search" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="text"
                placeholder="Search pages..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
                onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-[var(--theme-lighter)] dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-[var(--theme-primary)] outline-none transition-all"
              />
            </div>

            {/* Search Results Dropdown */}
            <AnimatePresence>
              {showSearchResults && (
                <motion.div
                  className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-y-auto max-h-96 z-50"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  {filteredPages.length > 0 ? (
                    <div className="py-2">
                      {filteredPages.map((page) => (
                        <button
                          key={page.path}
                          onClick={() => handlePageNavigation(page.path)}
                          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[var(--theme-primary)]/20 dark:hover:bg-gray-700 transition-colors text-left"
                        >
                          <Icon name={page.icon} className="text-[var(--theme-primary)]" size={18} />
                          <span className="text-gray-900 dark:text-white font-medium">{page.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-gray-500 dark:text-gray-400 text-sm">
                      No pages found
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Website Button */}
            <motion.button
              onClick={() => router.push('/website')}
              className="hidden lg:flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-lg shadow-indigo-200 dark:shadow-none transition-all ml-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
              Website
            </motion.button>
          </div>

          {/* Right: Icons and Profile */}
          <div className="flex items-center gap-3">
            {/* Fullscreen toggle */}

            <motion.button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-[var(--theme-primary)]/20 dark:hover:bg-gray-700 transition"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isFullscreen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m0 6v4a2 2 0 002 2h4m6-18h4a2 2 0 012 2v4m0 6v4a2 2 0 01-2 2h-4" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9l-4-4m0 0h4m-4 0v4m10 6l4 4m0 0h-4m4 0v-4" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9V5a2 2 0 012-2h4m6 0h4a2 2 0 012 2v4m0 6v4a2 2 0 01-2 2h-4m-6 0H5a2 2 0 01-2-2v-4" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3L5 7m0 0h4M5 7V3m10 14l4-4m0 0h-4m4 0v4" />
                </svg>
              )}
            </motion.button>

            {/* Chat Notification */}
            <motion.button
              onClick={() => router.push('/chat')}
              className="relative p-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-[var(--theme-primary)]/20 dark:hover:bg-gray-700 transition"
              title="Messages"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
            </motion.button>

            {/* Notifications */}
            <div className="relative">
              <motion.button
                ref={notificationBtnRef}
                onClick={handleNotificationClick}
                className="relative p-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-[var(--theme-primary)]/20 dark:hover:bg-gray-700 transition"
                title="Notifications"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {notificationCount}
                  </span>
                )}
              </motion.button>

              {/* Notifications Modal */}
              <AnimatePresence>
                {showNotifications && (
                  <>
                    <motion.div
                      className="fixed inset-0 z-[60]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowNotifications(false)}
                    />
                    <motion.div
                      className="absolute right-0 top-full mt-2 w-[32rem] max-h-[38rem] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-[70] overflow-hidden"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Arrow pointing to notification button */}
                      <div className="absolute -top-2 right-4 w-4 h-4 bg-white dark:bg-gray-800 border-l border-t border-gray-200 dark:border-gray-700 transform rotate-45"></div>

                      {/* Tabs */}
                      <div className="flex items-center gap-1 overflow-x-auto p-2 bg-gray-50 dark:bg-gray-750 scrollbar-none border-b border-gray-200 dark:border-gray-700">
                        {['all', 'delegation', 'checklist', 'todo'].filter(tab => {
                          if (tab === 'all') return true;
                          return notifications.some(n =>
                            n.target_page?.toLowerCase() === tab ||
                            n.type?.startsWith(tab)
                          );
                        }).map(tab => (
                          <button
                            key={tab}
                            onClick={() => setActiveNotifTab(tab)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition capitalize whitespace-nowrap ${activeNotifTab === tab
                              ? 'bg-[var(--theme-primary)] text-gray-900 shadow-sm'
                              : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                              }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>

                      {/* Notifications List */}
                      <div className="overflow-y-auto max-h-96">
                        {loadingNotifications ? (
                          <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--theme-primary)]"></div>
                          </div>
                        ) : notifications.filter(n => activeNotifTab === 'all' || n.target_page?.toLowerCase() === activeNotifTab || n.type?.startsWith(activeNotifTab)).length === 0 ? (
                          <div className="text-center py-12 px-4">
                            <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">No notifications in {activeNotifTab}</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {notifications
                              .filter(n => activeNotifTab === 'all' || n.target_page?.toLowerCase() === activeNotifTab || n.type?.startsWith(activeNotifTab))
                              .map((notification, index) => (
                                <motion.div
                                  key={`${notification.id}-${index}`}
                                  className={`p-4 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition cursor-pointer relative group ${!notification.is_read ? 'bg-[var(--theme-light)]/30 dark:bg-gray-750/30' : ''
                                    }`}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  onClick={() => handleNavigateToTask(notification)}
                                >
                                  <div className="flex items-start gap-3">
                                    {/* Icon */}
                                    <div className="flex-shrink-0 mt-0.5">
                                      {getNotificationIcon(notification.type)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="flex flex-col">
                                          <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                                            {notification.title}
                                          </h4>
                                          <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                                            {notification.action_by || 'System'} {notification.type.includes('created') ? 'created a task for you' : 'updated a task details'}
                                          </p>
                                        </div>
                                        <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                                          {formatTimeAgo(notification.created_at)}
                                        </span>
                                      </div>

                                      <div className="bg-gray-50 dark:bg-gray-750/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700 mb-2">
                                        <div className="flex items-start gap-2">
                                          <div className="mt-0.5 text-blue-500">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                          </div>
                                          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 italic">
                                            "{notification.message}"
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1 text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                          </svg>
                                          {notification.target_page || 'System'}
                                        </span>
                                        {notification.resource_id &&
                                          !['N/A', '#N/A', 'undefined', 'null', ''].includes(String(notification.resource_id).trim()) && (
                                            <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                              </svg>
                                              ID: #{notification.resource_id}
                                            </div>
                                          )}
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <Link
                        href="/notifications"
                        onClick={() => setShowNotifications(false)}
                        className="block w-full p-3 text-center text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-200 dark:border-gray-700 transition"
                      >
                        See All Activity
                      </Link>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* User Profile */}
            <div className="relative">
              <motion.button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white dark:bg-gray-700 hover:bg-[var(--theme-primary)]/20 dark:hover:bg-gray-600 transition shadow-sm"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {user?.image_url ? (
                  <img
                    src={user.image_url}
                    alt={user.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-[var(--theme-primary)] rounded-full flex items-center justify-center text-gray-900 text-sm font-bold">
                    {user?.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {user?.username || 'User'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {user?.role_name || 'User'}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </motion.button>

              {/* Profile Dropdown */}
              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden z-50"
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="p-4 bg-[var(--theme-lighter)] dark:bg-gray-700">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{user?.username || 'Admin User'}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{user?.role_name || 'User'}</p>
                    </div>
                    <div className="p-2 space-y-1">
                      <button
                        onClick={handleOpenProfile}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-[var(--theme-primary)]/20 dark:hover:bg-gray-700 rounded-lg transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        My Profile
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Profile Modal - Right Slide */}
      <AnimatePresence>
        {showProfileModal && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/50 z-[9997]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfileModal(false)}
            />

            {/* Right Slide Modal */}
            <motion.div
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-white dark:bg-gray-800 shadow-2xl z-[10000] overflow-y-auto"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              {/* Header */}
              <div className="sticky top-0 p-6 z-10" style={{ background: `linear-gradient(to right, ${colors.primary}, ${colors.secondary})` }}>
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition"
                >
                  <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div className="flex flex-col items-center text-center">
                  {/* Large Profile Photo */}
                  <div className="w-32 h-32 rounded-full bg-white shadow-lg flex items-center justify-center overflow-hidden mb-4">
                    {(fullUserData || user)?.image_url ? (
                      <img
                        src={(fullUserData || user).image_url}
                        alt={(fullUserData || user).username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white text-4xl font-bold">
                        {(fullUserData || user)?.username?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>

                  <h2 className="text-2xl font-bold text-gray-900">{(fullUserData || user)?.username || 'User'}</h2>
                  <div className="mt-2 px-4 py-1 bg-white/30 rounded-full">
                    <p className="text-sm font-semibold text-gray-900">{(fullUserData || user)?.role_name || 'User'}</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                {/* Theme Color Selector */}
                <div>
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Theme Color</h3>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => setTheme('yellow')}
                      className={`w-12 h-12 rounded-full transition-all ${theme === 'yellow' ? 'ring-4 ring-offset-2 ring-[#f4d24a] scale-110' : 'hover:scale-105'}`}
                      style={{ background: 'linear-gradient(135deg, #f4d24a, #e5c33a)' }}
                      title="Yellow"
                    />
                    <button
                      onClick={() => setTheme('blue')}
                      className={`w-12 h-12 rounded-full transition-all ${theme === 'blue' ? 'ring-4 ring-offset-2 ring-[#4a9ff4] scale-110' : 'hover:scale-105'}`}
                      style={{ background: 'linear-gradient(135deg, #4a9ff4, #3a8ee5)' }}
                      title="Blue"
                    />
                    <button
                      onClick={() => setTheme('green')}
                      className={`w-12 h-12 rounded-full transition-all ${theme === 'green' ? 'ring-4 ring-offset-2 ring-[#4af47d] scale-110' : 'hover:scale-105'}`}
                      style={{ background: 'linear-gradient(135deg, #4af47d, #3ae56c)' }}
                      title="Green"
                    />
                    <button
                      onClick={() => setTheme('pink')}
                      className={`w-12 h-12 rounded-full transition-all ${theme === 'pink' ? 'ring-4 ring-offset-2 ring-[#f44a9f] scale-110' : 'hover:scale-105'}`}
                      style={{ background: 'linear-gradient(135deg, #f44a9f, #e53a8e)' }}
                      title="Pink"
                    />
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                      <svg className="w-5 h-5" style={{ color: colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white font-medium truncate">{(fullUserData || user)?.email || 'N/A'}</p>
                      </div>
                    </div>

                    {(fullUserData || user)?.phone && (
                      <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                        <svg className="w-5 h-5" style={{ color: colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm text-gray-900 dark:text-white font-medium">{(fullUserData || user).phone}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Personal Details */}
                {(fullUserData?.dob || fullUserData?.uan_number || fullUserData?.aadhaar_number || fullUserData?.pan_number) && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Personal Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(fullUserData || user)?.dob && (
                        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                          <svg className="w-5 h-5 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Date of Birth</p>
                            <p className="text-sm text-gray-900 dark:text-white font-medium">{(fullUserData || user).dob}</p>
                          </div>
                        </div>
                      )}

                      {(fullUserData || user)?.uan_number && (
                        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                          <svg className="w-5 h-5 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400">UAN Number</p>
                            <p className="text-sm text-gray-900 dark:text-white font-medium font-mono">{(fullUserData || user).uan_number}</p>
                          </div>
                        </div>
                      )}

                      {(fullUserData || user)?.aadhaar_number && (
                        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                          <svg className="w-5 h-5 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Aadhaar Number</p>
                            <p className="text-sm text-gray-900 dark:text-white font-medium font-mono">{(fullUserData || user).aadhaar_number}</p>
                          </div>
                        </div>
                      )}

                      {(fullUserData || user)?.pan_number && (
                        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                          <svg className="w-5 h-5 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400">PAN Card</p>
                            <p className="text-sm text-gray-900 dark:text-white font-medium font-mono">{(fullUserData || user).pan_number}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Address */}
                {((fullUserData || user)?.present_address_line1 || (fullUserData || user)?.present_city) && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Present Address</h3>
                    <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                      <svg className="w-5 h-5 text-[var(--theme-primary)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 dark:text-white leading-relaxed">
                          {[
                            (fullUserData || user).present_address_line1,
                            (fullUserData || user).present_address_line2,
                            (fullUserData || user).present_city,
                            (fullUserData || user).present_state,
                            (fullUserData || user).present_postal_code,
                            (fullUserData || user).present_country
                          ].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Professional Details */}
                {((fullUserData || user)?.title || (fullUserData || user)?.department || (fullUserData || user)?.location) && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Professional Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(fullUserData || user)?.title && (
                        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                          <svg className="w-5 h-5 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Job Title</p>
                            <p className="text-sm text-gray-900 dark:text-white font-medium">{(fullUserData || user).title}</p>
                          </div>
                        </div>
                      )}

                      {(fullUserData || user)?.department && (
                        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                          <svg className="w-5 h-5 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Department</p>
                            <p className="text-sm text-gray-900 dark:text-white font-medium">{(fullUserData || user).department}</p>
                          </div>
                        </div>
                      )}

                      {(fullUserData || user)?.location && (
                        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                          <svg className="w-5 h-5 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Work Location</p>
                            <p className="text-sm text-gray-900 dark:text-white font-medium">{(fullUserData || user).location}</p>
                          </div>
                        </div>
                      )}

                      {(fullUserData || user)?.experience && (
                        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                          <svg className="w-5 h-5 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Experience</p>
                            <p className="text-sm text-gray-900 dark:text-white font-medium">{(fullUserData || user).experience}</p>
                          </div>
                        </div>
                      )}

                      {(fullUserData || user)?.highest_qualification && (
                        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                          <svg className="w-5 h-5 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Qualification</p>
                            <p className="text-sm text-gray-900 dark:text-white font-medium">{(fullUserData || user).highest_qualification}</p>
                          </div>
                        </div>
                      )}

                      {(fullUserData || user)?.skill_set && (
                        <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                          <svg className="w-5 h-5 text-[var(--theme-primary)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Skills</p>
                            <p className="text-sm text-gray-900 dark:text-white leading-relaxed">{(fullUserData || user).skill_set}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Account Info */}
                <div>
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Account Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                      <svg className="w-5 h-5 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">User ID</p>
                        <p className="text-sm text-gray-900 dark:text-white font-medium font-mono">{(fullUserData || user)?.id || 'N/A'}</p>
                      </div>
                    </div>

                    {(fullUserData || user)?.created_at && (
                      <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                        <svg className="w-5 h-5 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Member Since</p>
                          <p className="text-sm text-gray-900 dark:text-white font-medium">
                            {(() => {
                              const date = new Date((fullUserData || user).created_at);
                              const day = String(date.getDate()).padStart(2, '0');
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const year = date.getFullYear();
                              const hours = String(date.getHours()).padStart(2, '0');
                              const minutes = String(date.getMinutes()).padStart(2, '0');
                              const seconds = String(date.getSeconds()).padStart(2, '0');
                              return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
                            })()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

