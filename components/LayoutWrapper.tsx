'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import { ensureSessionId } from '@/utils/session';

export default function LayoutWrapper({ children, disableNotifications = false }: { children: React.ReactNode; disableNotifications?: boolean }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Handle mobile resize only
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const sessionId = ensureSessionId();
        const response = await fetch('/api/auth', { headers: { 'x-session-id': sessionId } });

        if (!response.ok) {
          if (response.status === 401) {
            console.log("Not authenticated, redirecting to login");
            router.push('/login');
          } else {
            console.error("Auth check failed with status:", response.status);
            // Don't redirect on other errors (like 500 or 429) to avoid loops
            setIsLoading(false);
          }
          return;
        }
        setIsLoading(false);
      } catch (error) {
        console.error("Auth check error:", error);
        // Don't redirect on network errors (Failed to fetch) to avoid loops
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--theme-lighter)] dark:bg-gray-800">
        <div className="text-center">
          <div className="w-16 h-16 bg-[var(--theme-primary)] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <span className="text-gray-900 font-bold text-2xl">E</span>
          </div>
          <p className="text-gray-800 dark:text-gray-200 font-medium">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--theme-lighter)] dark:bg-gray-800">,
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header isOpen={sidebarOpen} setIsOpen={setSidebarOpen} disableNotifications={disableNotifications} />

        {/* Page Content */}
        <main className="flex-1 overflow-auto flex flex-col">
          <div className="flex-1">
            {children}
          </div>

          {/* Footer Banner */}
          <footer className="w-full bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 py-3 px-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] mt-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 max-w-[1600px] mx-auto">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-[var(--theme-primary)] rounded-lg flex items-center justify-center shadow-lg shadow-[var(--theme-primary)]/20">
                  <span className="text-gray-900 font-black text-xs">E</span>
                </div>
                <p className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] whitespace-nowrap">
                  © 2026 Sohan ERP Solutions Pvt. Ltd. <span className="hidden sm:inline">| All Rights Reserved.</span>
                </p>
              </div>

              <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-750 px-4 py-1.5 rounded-full border border-gray-100 dark:border-gray-700">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold whitespace-nowrap">
                  ERP Developed & Maintained by <span className="text-[var(--theme-primary)] font-black">Sohan</span>
                </p>
                <div className="h-3 w-[1px] bg-gray-200 dark:bg-gray-600" />
                <p className="text-[9px] text-gray-400 dark:text-gray-500 font-black tracking-widest uppercase">
                  v1.0
                </p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
