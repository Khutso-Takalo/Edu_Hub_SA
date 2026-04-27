import React, { useState } from 'react';
import { GraduationCap, Search, Menu, X, User, LogOut, BookOpen, Building2, Award, FileText, Compass, ChevronDown, Bell, Shield, ClipboardList, Sparkles, FileUser, PenLine, Users, Crown } from 'lucide-react';
import type { NotificationRecord } from '@/infrastructure/database/indexeddb/schema';
import type { UserProfile } from '@/hooks/useAuth';

interface NavbarUser {
  email?: string;
}

interface NavbarProps {
  user: NavbarUser | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  onAuthClick: () => void;
  onSignOut: () => void;
  currentView: string;
  onNavigate: (view: string) => void;
  notifications: NotificationRecord[];
  unreadCount: number;
  onMarkNotificationRead: (id: string) => Promise<void>;
  onMarkAllNotificationsRead: () => Promise<void>;
}

const Navbar: React.FC<NavbarProps> = ({
  user,
  profile,
  isAdmin,
  onAuthClick,
  onSignOut,
  currentView,
  onNavigate,
  notifications,
  unreadCount,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const navItems = [
    { id: 'careers', label: 'Career Explorer', icon: Compass },
    { id: 'bursaries', label: 'Bursaries', icon: Award },
    { id: 'institutions', label: 'Institutions', icon: Building2 },
    { id: 'papers', label: 'Past Papers', icon: FileText },
    { id: 'resources', label: 'Guides', icon: BookOpen },
    { id: 'knowledge', label: 'Knowledge Hub', icon: Sparkles },
    { id: 'classroom', label: 'Classroom', icon: Users },
    { id: 'cv-builder', label: 'CV Builder', icon: FileUser },
    { id: 'essay-studio', label: 'Essay Studio', icon: PenLine },
    { id: 'tracker', label: 'Tracker', icon: ClipboardList },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="section-shell">
        <div className="flex items-center justify-between gap-3 h-16 min-w-0">
          {/* Logo */}
          <button onClick={() => onNavigate('home')} className="flex items-center gap-2 flex-shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-700 to-green-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xl font-bold text-gray-900">EduHub</span>
              <span className="text-xl font-bold text-green-600">SA</span>
            </div>
          </button>

          {/* Desktop Nav */}
          <div className="hidden xl:flex flex-1 min-w-0 justify-center px-2">
            <div className="no-scrollbar flex max-w-full items-center gap-1.5 overflow-x-auto overflow-y-hidden rounded-xl border border-gray-200/80 bg-gray-50/70 px-2 py-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`interactive-chip shrink-0 whitespace-nowrap px-2.5 xl:px-3.5 py-2 text-sm font-medium flex items-center gap-1.5 ${
                    currentView === item.id
                      ? 'bg-white text-blue-700 border border-blue-100 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/80 border border-transparent'
                  }`}
                  title={item.label}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden xl:inline">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            {user ? (
              <div className="flex items-center gap-2 min-w-0 shrink-0">
                <div className="relative">
                  <button
                    onClick={() => setNotificationOpen(!notificationOpen)}
                    className="relative p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Notifications"
                  >
                    <Bell className="w-5 h-5 text-gray-600" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {notificationOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setNotificationOpen(false)} />
                      <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20">
                        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">Notifications</p>
                          <button onClick={onMarkAllNotificationsRead} className="text-xs text-blue-600 hover:underline">
                            Mark all read
                          </button>
                        </div>
                        <div className="max-h-80 overflow-auto">
                          {notifications.filter((item) => item.channel === 'in-app').slice(0, 8).map((item) => (
                            <button
                              key={item.id}
                              onClick={() => onMarkNotificationRead(item.id)}
                              className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${item.read ? 'opacity-60' : ''}`}
                            >
                              <p className="text-sm font-medium text-gray-900">{item.title}</p>
                              <p className="text-xs text-gray-600 mt-1">{item.message}</p>
                            </button>
                          ))}
                          {notifications.filter((item) => item.channel === 'in-app').length === 0 && (
                            <p className="px-4 py-6 text-sm text-gray-500">No notifications yet.</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-semibold">
                        {(profile?.full_name || user.email || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="hidden md:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
                      {profile?.full_name || 'User'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400 hidden md:block" />
                  </button>

                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 mt-2 w-[min(14rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20">
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900">{profile?.full_name || 'User'}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                        <button
                          onClick={() => { onNavigate('dashboard'); setUserMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <User className="w-4 h-4" />
                          Dashboard
                        </button>
                        <button
                          onClick={() => { onNavigate('profile'); setUserMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <User className="w-4 h-4" />
                          Edit Profile
                        </button>
                        <button
                          onClick={() => { onNavigate('tracker'); setUserMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <ClipboardList className="w-4 h-4" />
                          Application Tracker
                        </button>
                        {isAdmin ? (
                          <button
                            onClick={() => { onNavigate('admin'); setUserMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <Shield className="w-4 h-4" />
                            Data Lab
                          </button>
                        ) : null}
                        <button
                          onClick={() => { onNavigate('security'); setUserMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Shield className="w-4 h-4" />
                          Security Settings
                        </button>
                        <button
                          onClick={() => { onNavigate('premium'); setUserMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Crown className="w-4 h-4" />
                          Premium Settings
                        </button>
                        <hr className="my-1 border-gray-100" />
                        <button
                          onClick={() => { onSignOut(); setUserMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={onAuthClick}
                className="px-4 py-2 bg-gradient-to-r from-blue-700 to-green-600 text-white text-sm font-medium rounded-lg hover:from-blue-800 hover:to-green-700 transition-all shadow-sm"
              >
                Sign In
              </button>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <>
          {/* Blurred dark overlay for focus */}
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity animate-fade-in" onClick={() => setMobileMenuOpen(false)} />
          {/* Animated menu panel */}
          <div className="fixed inset-0 z-50 bg-white flex flex-col lg:hidden animate-slide-in-up">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-700 to-green-600 rounded-lg flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900 tracking-tight">EduHub <span className="text-green-600">SA</span></span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-3 rounded-full text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <X className="w-7 h-7" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileMenuOpen(false);
                      setTimeout(() => {
                        // Try scroll to anchor if exists, else scroll to top
                        const anchor = document.getElementById(item.id);
                        if (anchor) {
                          anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        } else {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }, 200);
                    }}
                    className={`w-full flex items-center gap-4 px-5 py-5 rounded-2xl text-xl font-semibold transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      currentView === item.id
                        ? 'bg-gradient-to-r from-blue-50 to-green-50 text-blue-700'
                        : 'text-gray-700 hover:bg-blue-50/60 hover:text-blue-800'
                    }`}
                  >
                    <Icon className="w-7 h-7" />
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="px-6 pb-8 pt-2">
              <p className="text-xs text-gray-400 text-center">&copy; {new Date().getFullYear()} EduHub SA. All rights reserved.</p>
            </div>
          </div>
          {/* Animations */}
          <style>{`
            @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
            .animate-fade-in { animation: fade-in 0.25s ease; }
            @keyframes slide-in-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
            .animate-slide-in-up { animation: slide-in-up 0.35s cubic-bezier(.4,1.4,.6,1) both; }
          `}</style>
        </>
      )}
    </nav>
  );
};

export default Navbar;
