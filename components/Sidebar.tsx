'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

interface MenuItem {
  label: string;
  icon: string;
  href?: string;
  roles: string[];
  children?: MenuItem[];
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const pathname = usePathname();

  const menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'chart', href: '/dashboard', roles: ['Admin', 'Manager', 'Employee'] },
    { label: 'PC Dashboard', icon: 'chart', href: '/pc-dashboard', roles: ['Admin', 'Manager', 'Employee'] },
    { label: 'Score', icon: 'trophy', href: '/score', roles: ['Admin', 'Manager'] },
    { label: 'Attendance', icon: 'clock', href: '/attendance', roles: ['Admin', 'Manager', 'Employee'] },
    {
      label: 'Tasks', icon: 'clipboard', roles: ['Admin', 'Manager', 'Employee'], children: [
        { label: 'Delegations', icon: 'clipboard', href: '/delegation', roles: ['Admin', 'Manager'] },
        { label: 'Checklist', icon: 'checklist', href: '/checklist', roles: ['Admin', 'Manager'] },
        { label: 'Todo', icon: 'check', href: '/todo', roles: ['Admin', 'Manager', 'Employee'] },
      ]
    },

    {
      label: 'CRM', icon: 'clipboard', roles: ['Admin', 'Manager'], children: [
        { label: 'CRM', icon: 'users', href: '/crm', roles: ['Admin', 'Manager'] },
        { label: 'O2D', icon: 'trending', href: '/o2d', roles: ['Admin', 'Manager'] },
        { label: 'Collection', icon: 'currency-dollar', href: '/collection', roles: ['Admin', 'Manager'] },
        { label: 'Payable', icon: 'currency-dollar', href: '/payable', roles: ['Admin', 'Manager'] },
        { label: 'Client Complain', icon: 'alert', href: '/client-complain', roles: ['Admin', 'Manager'] },
        { label: 'Dealer_Kit', icon: 'calendar', href: '/Dealer_Kit', roles: ['Admin', 'Manager'] },
      ]
    },
    {
      label: 'Sales', icon: 'currency-dollar', roles: ['Admin', 'Manager'], children: [
        { label: 'NBD', icon: 'document', href: '/nbd', roles: ['Admin', 'Manager'] },
        { label: 'NBD Incoming', icon: 'trending', href: '/nbd-incoming', roles: ['Admin', 'Manager'] },
        { label: 'CRR', icon: 'clipboard', href: '/crr', roles: ['Admin', 'Manager'] },
      ]
    },
    {
      label: 'Factory', icon: 'clipboard', roles: ['Admin', 'Manager'], children: [
        { label: 'Production', icon: 'factory', href: '/production', roles: ['Admin', 'Manager'] },
        { label: 'Scrap Sales', icon: 'clipboard', href: '/scrap-sales', roles: ['Admin', 'Manager'] },
        { label: 'Purchase FMS', icon: 'clock', href: '/purchase-fms', roles: ['Admin', 'Manager'] },
        { label: 'Factory Requirement', icon: 'document', href: '/factory-requirements', roles: ['Admin', 'Manager'] },
        { label: 'New Product Search FMS', icon: 'package', href: '/fms-product-search', roles: ['Admin', 'Manager'] },
        { label: 'Job Work', icon: 'clipboard-check', href: '/job-work', roles: ['Admin', 'Manager'] },
        { label: 'RM Defects', icon: 'alert', href: '/rm-defects', roles: ['Admin', 'Manager'] },
        { label: 'RM Audit Stock', icon: 'clipboard-check', href: '/rm-audit-stock', roles: ['Admin', 'Manager'] },
      ],
    },
    {
      label: 'Export',
      icon: 'clipboard',
      roles: ['Admin', 'Manager'],
      children: [
        { label: 'Export FMS', icon: 'clipboard', href: '/export-fms', roles: ['Admin', 'Manager'] },

        { label: 'IGST Refund', icon: 'currency-dollar', href: '/igst-refund', roles: ['Admin', 'Manager'] },
      ]
    },
    {
      label: 'IMS', icon: 'clipboard', roles: ['Admin', 'Manager'], children: [
        { label: 'IMS RM', icon: 'package', href: '/ims-rm', roles: ['Admin', 'Manager'] },
        { label: 'IMS FG', icon: 'package', href: '/ims-fg', roles: ['Admin', 'Manager'] },
      ]
    },
    { label: 'Client Interface', icon: 'users', href: '/client-interface', roles: ['Admin', 'Manager', 'Employee'] },
    { label: 'HelpDesk', icon: 'headset', href: '/helpdesk', roles: ['Admin', 'Manager', 'Employee'] },
    { label: 'Users', icon: 'users', href: '/users', roles: ['Admin'] },
    { label: 'Chat', icon: 'message', href: '/chat', roles: ['Admin', 'Manager', 'Employee'] },
  ];

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'chart':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
      case 'clipboard':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
      case 'checklist':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
      case 'check':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
      case 'document':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
      case 'headset':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" /></svg>;
      case 'users':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
      case 'bell':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
      case 'message':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
      case 'trending':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
      case 'currency-dollar':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      case 'trophy':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>;
      case 'clock':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      case 'calendar':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
      case 'alert':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      case 'package':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14v14m0-14L4 7m8 4L4 7m0 0v10l8 4" /></svg>;
      case 'clipboard-check':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
      case 'factory':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
      default:
        return null;
    }
  };

  const isActive = (href?: string) => href ? pathname === href : false;

  // Initialize expandedMenus based on current path
  const [expandedMenus, setExpandedMenus] = useState<string[]>(() => {
    const activeParent = menuItems.find(item =>
      item.children?.some(child => child.href && isActive(child.href))
    );

    if (activeParent) {
      return [activeParent.label];
    }
    return []; // No menu expanded by default
  });

  const isMenuExpanded = (label: string) => expandedMenus.includes(label);

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev =>
      prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  // Keep expanded state in sync with external navigation
  useEffect(() => {
    const activeParent = menuItems.find(item =>
      item.children?.some(child => child.href && isActive(child.href))
    );

    if (activeParent) {
      // Expand the parent if it has an active child and isn't already expanded
      if (!expandedMenus.includes(activeParent.label)) {
        setExpandedMenus([activeParent.label]);
      }
    } else {
      // Collapse all menus if no active child is found (navigated to a non-child page)
      setExpandedMenus([]);
    }
  }, [pathname]);

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[70] lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        onMouseEnter={() => {
          if (window.innerWidth >= 1024) setIsOpen(true);
        }}
        onMouseLeave={() => {
          if (window.innerWidth >= 1024) setIsOpen(false);
        }}
        className={`fixed left-0 top-0 h-screen bg-[var(--theme-light)] dark:bg-gray-800 text-gray-900 dark:text-white transition-all duration-300 z-[80] ${isOpen ? 'w-64' : '-translate-x-full lg:translate-x-0 lg:w-20'
          } lg:relative lg:z-auto shadow-lg`}
      >
        {/* Logo Section */}
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md overflow-hidden">
              <img src="/logo.png" alt="SS Enterprises" className="w-full h-full object-contain p-1" />
            </div>
            {isOpen && <span className="font-bold text-lg whitespace-nowrap text-gray-900 dark:text-white">SS Enterprises</span>}
          </div>
        </div>

        {/* Menu Items */}
        <nav className="p-4 space-y-0.5 overflow-y-auto h-[calc(100vh-80px)]">
          {menuItems.map((item) => {
            if (item.children) {
              const expanded = isMenuExpanded(item.label);
              // Check if any child is active
              const hasActiveChild = item.children.some(child => child.href && isActive(child.href));

              return (
                <div key={item.label} className="space-y-1">
                  <button
                    onClick={() => {
                      if (!isOpen) setIsOpen(true);
                      toggleMenu(item.label);
                    }}
                    className={`w-full flex items-center justify-between gap-4 px-4 py-2 rounded-xl transition-all duration-200 ${hasActiveChild || expanded
                      ? 'bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] font-semibold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-[var(--theme-primary)]/20 dark:hover:bg-gray-700'
                      }`}
                    title={!isOpen ? item.label : ''}
                  >
                    <div className="flex items-center gap-4">
                      {getIcon(item.icon)}
                      {isOpen && <span className="font-medium">{item.label}</span>}
                    </div>
                    {isOpen && (
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>

                  <AnimatePresence>
                    {isOpen && expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-4 space-y-1">
                          {item.children.map(child => (
                            <Link
                              key={child.label}
                              href={child.href || '#'}
                              className={`flex items-center gap-4 px-4 py-2 rounded-xl transition-all duration-200 text-sm ${isActive(child.href)
                                ? 'bg-[var(--theme-primary)] text-gray-900 shadow-sm font-semibold'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-[var(--theme-primary)]/20 dark:hover:bg-gray-700'
                                }`}
                            >
                              <div className="w-5 flex justify-center flex-shrink-0 transition-colors">
                                {getIcon(child.icon)}
                              </div>
                              <span className="font-medium">{child.label}</span>
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href || '#'}
                className={`flex items-center gap-4 px-4 py-2 rounded-xl transition-all duration-200 ${isActive(item.href)
                  ? 'bg-[var(--theme-primary)] text-gray-900 shadow-md font-semibold'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-[var(--theme-primary)]/20 dark:hover:bg-gray-700'
                  }`}
                title={!isOpen ? item.label : ''}
              >
                {getIcon(item.icon)}
                {isOpen && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Settings - Bottom (Hidden on Desktop hover mode) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-[var(--theme-light)] dark:bg-gray-800 lg:hidden">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center gap-4 px-4 py-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-[var(--theme-primary)]/20 dark:hover:bg-gray-700 transition-all"
            title={isOpen ? 'Collapse' : 'Expand'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isOpen ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
            </svg>
            {isOpen && <span className="font-medium">Collapse</span>}
          </button>
        </div>
      </div>
    </>
  );
}
