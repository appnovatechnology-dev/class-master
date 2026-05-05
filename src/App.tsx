/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, signIn, logout } from './lib/firebase';
import { doc, getDocFromServer } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Users, Calendar, Inbox, GraduationCap, LogOut, Loader2 } from 'lucide-react';
import Dashboard from './components/Dashboard';
import StudentList from './components/StudentList';
import SessionTracker from './components/SessionTracker';
import Gradebook from './components/Gradebook';
import AuthPage from './components/AuthPage';
import { cn } from './lib/utils';

type View = 'dashboard' | 'students' | 'sessions' | 'grades';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    // Test Firestore Connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          setConnectionError(true);
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-900 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <p className="mt-4 text-sm font-medium">Initializing ClassMaster...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage connectionError={connectionError} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard setCurrentView={setCurrentView} />;
      case 'students': return <StudentList />;
      case 'sessions': return <SessionTracker />;
      case 'grades': return <Gradebook />;
      default: return <Dashboard setCurrentView={setCurrentView} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
        <div className="p-6 border-bottom">
          <div className="flex items-center gap-2 font-bold text-xl text-gray-900">
            <GraduationCap className="w-6 h-6" />
            <span>ClassMaster</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          <NavItem 
            icon={<Inbox className="w-5 h-5" />} 
            label="Dashboard" 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')} 
          />
          <NavItem 
            icon={<Users className="w-5 h-5" />} 
            label="Students" 
            active={currentView === 'students'} 
            onClick={() => setCurrentView('students')} 
          />
          <NavItem 
            icon={<Calendar className="w-5 h-5" />} 
            label="Sessions" 
            active={currentView === 'sessions'} 
            onClick={() => setCurrentView('sessions')} 
          />
          <NavItem 
            icon={<GraduationCap className="w-5 h-5" />} 
            label="Grades" 
            active={currentView === 'grades'} 
            onClick={() => setCurrentView('grades')} 
          />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group">
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
              alt="Avatar" 
              className="w-10 h-10 rounded-full border border-gray-200"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.displayName}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
            <button 
              onClick={logout}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="md:hidden bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg text-gray-900">
            <GraduationCap className="w-5 h-5" />
            <span>ClassMaster</span>
          </div>
          <button onClick={logout} className="text-gray-500"><LogOut className="w-5 h-5" /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-around">
          <MobileNavItem active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} icon={<Inbox className="w-6 h-6" />} />
          <MobileNavItem active={currentView === 'students'} onClick={() => setCurrentView('students')} icon={<Users className="w-6 h-6" />} />
          <MobileNavItem active={currentView === 'sessions'} onClick={() => setCurrentView('sessions')} icon={<Calendar className="w-6 h-6" />} />
          <MobileNavItem active={currentView === 'grades'} onClick={() => setCurrentView('grades')} icon={<GraduationCap className="w-6 h-6" />} />
        </nav>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
        active 
          ? "bg-gray-100 text-gray-900" 
          : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileNavItem({ active, onClick, icon }: { active: boolean, onClick: () => void, icon: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-3 rounded-xl transition-all",
        active ? "bg-gray-900 text-white" : "text-gray-400"
      )}
    >
      {icon}
    </button>
  );
}
