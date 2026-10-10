import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { Toaster } from './UI';
import { useUIStore } from '../stores/uiStore';

/**
 * Shell for every signed-in surface.
 *
 * The sidebar reserves space with a left margin on `lg+` (icons-only when
 * collapsed) and overlays the page as a drawer below `lg`. Toasts mount here so
 * they survive route changes.
 */
export const DashboardLayout: React.FC = () => {
  const sidebarOpen = useUIStore(state => state.sidebarOpen);

  return (
    <div className="min-h-screen">
      <Sidebar variant="desktop" />
      <Sidebar variant="mobile" />

      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        <Navbar />
        <main className="p-4 sm:p-6 min-h-[calc(100vh-70px)] animate-fade-in">
          <div className="mx-auto max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>

      <Toaster />
    </div>
  );
};
