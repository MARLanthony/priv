import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useUIStore } from '../stores/appStores';

export const DashboardLayout: React.FC = () => {
  const { sidebarOpen } = useUIStore();

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        <Navbar />
        <main className="p-6 min-h-[calc(100vh-65px)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
