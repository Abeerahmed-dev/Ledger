'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { dashboardNavItems } from './nav-items';
import { DashboardMobileNav } from './DashboardMobileNav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardMobileNav />

      {/* Sub Navigation Bar — desktop only, unchanged */}
      <div className="hidden md:flex bg-white border-b border-slate-200 sticky top-0 z-30 items-center h-14 px-4 overflow-x-auto scrollbar-none">
        <div className="flex space-x-8 overflow-x-auto scrollbar-none shrink-0 h-14">
          {dashboardNavItems.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-semibold transition-colors h-14 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.name}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
