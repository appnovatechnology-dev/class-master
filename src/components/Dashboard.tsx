import { useState, useEffect, ReactNode } from 'react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Student, Session, Performance } from '../types';
import { Users, Calendar, TrendingUp, Send, Plus, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

export default function Dashboard({ setCurrentView }: { setCurrentView: (v: 'dashboard' | 'students' | 'sessions' | 'grades') => void }) {
  const [stats, setStats] = useState({
    studentCount: 0,
    sessionCount: 0,
    lastSession: null as Session | null,
    recentPerformance: [] as Performance[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!auth.currentUser) return;
      setLoading(true);

      const userId = auth.currentUser.uid;
      
      try {
        const studentSnap = await getDocs(query(collection(db, 'students'), where('teacherUid', '==', userId)));
        const sessionSnap = await getDocs(query(collection(db, 'sessions'), where('teacherUid', '==', userId), orderBy('date', 'desc'), limit(1)));
        const performanceSnap = await getDocs(query(collection(db, 'performance'), where('teacherUid', '==', userId), orderBy('date', 'desc'), limit(5)));

        setStats({
          studentCount: studentSnap.size,
          sessionCount: 0, // In a real app I'd count all sessions, but for demo let's just use size of some initial fetch
          lastSession: sessionSnap.docs[0]?.data() as Session || null,
          recentPerformance: performanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Performance[]
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Overview</h1>
        <p className="text-gray-500 mt-1">Welcome back, {auth.currentUser?.displayName}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={<Users className="w-5 h-5 text-blue-500" />} 
          label="Total Students" 
          value={stats.studentCount.toString()} 
          bgColor="bg-blue-50"
        />
        <StatCard 
          icon={<Calendar className="w-5 h-5 text-purple-500" />} 
          label="Last Session" 
          value={stats.lastSession ? format(stats.lastSession.date.toDate(), 'MMM d') : 'No sessions yet'} 
          bgColor="bg-purple-50"
        />
        <StatCard 
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} 
          label="Average Rating" 
          value={stats.recentPerformance.length > 0 ? (stats.recentPerformance.reduce((acc, p) => acc + p.rating, 0) / stats.recentPerformance.length).toFixed(1) : '—'} 
          bgColor="bg-emerald-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Recent Performance</h2>
            <button onClick={() => setCurrentView('sessions')} className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-4">
            {stats.recentPerformance.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No reports generated yet.</p>
            ) : (
              stats.recentPerformance.map((p) => (
                <div key={p.id} className="flex items-center gap-4 p-3 rounded-xl border border-gray-50 hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400">
                    {p.rating}★
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.feedback}</p>
                    <p className="text-xs text-gray-500">{format(p.date.toDate(), 'MMM d, h:mm a')}</p>
                  </div>
                  {p.whatsappSent && <Send className="w-4 h-4 text-emerald-500" title="Sent via WhatsApp" />}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gray-900 text-white flex items-center justify-center">
            <Plus className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Start a Quick Session</h3>
            <p className="text-sm text-gray-500 max-w-xs mt-2">Ready to track today's lesson? Create a new session and start recording performance.</p>
          </div>
          <button 
            onClick={() => setCurrentView('sessions')}
            className="px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
          >
            New Session
          </button>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, bgColor }: { icon: ReactNode, label: string, value: string, bgColor: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex items-center gap-4">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", bgColor)}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}
