import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth, Timestamp } from '../lib/firebase';
import { Student, Session, Attendance, Performance } from '../types';
import { Plus, CheckCircle2, Circle, MessageCircle, Star, Save, Calendar, ArrowLeft, Edit2, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError } from '../lib/error-handler';
import { OperationType } from '../types';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

export default function SessionTracker() {
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [performance, setPerformance] = useState<Record<string, { rating: number, feedback: string }>>({});
  const [loading, setLoading] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionFormData, setSessionFormData] = useState({ title: '', gradeLevel: '1' });

  useEffect(() => {
    async function init() {
      if (!auth.currentUser) return;
      setLoading(true);
      try {
        const userId = auth.currentUser.uid;
        const [studentSnap, sessionSnap] = await Promise.all([
          getDocs(query(collection(db, 'students'), where('teacherUid', '==', userId))),
          getDocs(query(collection(db, 'sessions'), where('teacherUid', '==', userId), orderBy('date', 'desc'), limit(10)))
        ]);

        const fetchedStudents = studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[];
        const fetchedSessions = sessionSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Session[];
        
        setStudents(fetchedStudents);
        setSessions(fetchedSessions);

        if (fetchedSessions.length > 0) {
          const lSession = fetchedSessions[0];
          const createdTime = lSession.date.toDate().getTime();
          if (Date.now() - createdTime < 1000 * 60 * 60 * 4) {
             setCurrentSession(lSession);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const createSession = async () => {
    if (!auth.currentUser || !sessionFormData.title) return;
    try {
      if (editingSessionId) {
        await updateDoc(doc(db, 'sessions', editingSessionId), {
          title: sessionFormData.title,
          gradeLevel: sessionFormData.gradeLevel
        });
        setSessions(prev => prev.map(s => s.id === editingSessionId ? { ...s, ...sessionFormData } : s));
        if (currentSession?.id === editingSessionId) {
          setCurrentSession({ ...currentSession, ...sessionFormData });
        }
        setEditingSessionId(null);
      } else {
        const docRef = await addDoc(collection(db, 'sessions'), {
          title: sessionFormData.title,
          gradeLevel: sessionFormData.gradeLevel,
          teacherUid: auth.currentUser.uid,
          date: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        const newS: Session = { ...sessionFormData, id: docRef.id, teacherUid: auth.currentUser.uid, date: Timestamp.now(), createdAt: Timestamp.now() };
        setCurrentSession(newS);
        setSessions(prev => [newS, ...prev]);
        setIsCreatingSession(false);
      }
      setSessionFormData({ title: '', gradeLevel: '1' });
    } catch (err) {
      handleFirestoreError(err, editingSessionId ? OperationType.UPDATE : OperationType.CREATE, 'sessions');
    }
  };

  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deletingSessionId !== id) {
      setDeletingSessionId(id);
      // Auto-clear after 3 seconds
      setTimeout(() => setDeletingSessionId(null), 3000);
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'sessions', id));
      setSessions(prev => prev.filter(s => s.id !== id));
      if (currentSession?.id === id) setCurrentSession(null);
      setDeletingSessionId(null);
    } catch (err) {
      console.error('Delete failed:', err);
      handleFirestoreError(err, OperationType.DELETE, `sessions/${id}`);
    }
  };

  const startEditSession = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setSessionFormData({ title: session.title, gradeLevel: session.gradeLevel });
    setIsCreatingSession(true);
  };

  const toggleAttendance = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const updatePerformance = (studentId: string, updates: Partial<{ rating: number, feedback: string }>) => {
    setPerformance(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || { rating: 5, feedback: '' }), ...updates }
    }));
  };

  const saveReport = async (student: Student) => {
    if (!currentSession || !auth.currentUser) return;
    const p = performance[student.id] || { rating: 5, feedback: 'Great performance today!' };
    const att = attendance[student.id] || 'present';

    try {
      // Save Performance
      await addDoc(collection(db, 'performance'), {
        sessionId: currentSession.id,
        studentId: student.id,
        teacherUid: auth.currentUser.uid,
        rating: p.rating,
        feedback: p.feedback || 'No specific feedback provided.',
        date: serverTimestamp(),
        whatsappSent: false
      });

      // Save Attendance
      await addDoc(collection(db, 'attendance'), {
        sessionId: currentSession.id,
        studentId: student.id,
        teacherUid: auth.currentUser.uid,
        status: att,
        date: serverTimestamp()
      });

      alert(`Report saved for ${student.name}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'performance/attendance');
    }
  };

  const sendWhatsApp = (student: Student) => {
    const p = performance[student.id] || { rating: 5, feedback: '' };
    const att = attendance[student.id] || 'present';
    const stars = '★'.repeat(p.rating) + '☆'.repeat(5 - p.rating);
    
    const message = `Hello ${student.parentName}, this is a report for ${student.name} from ClassMaster.
Session: ${currentSession?.title}
Date: ${format(new Date(), 'EEEE, MMM d')}
Attendance: ${att.toUpperCase()}
Performance: ${stars}
Feedback: ${p.feedback || 'Great session!'}
    `;

    const url = `https://wa.me/${student.parentPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  if (loading) return <div>Loading sessions...</div>;

  if (!currentSession) {
    return (
      <div className="h-full flex flex-col space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Sessions</h2>
          <button 
            onClick={() => setIsCreatingSession(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Session
          </button>
        </div>

        {sessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map(s => (
              <div 
                key={s.id}
                onClick={() => setCurrentSession(s)}
                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-gray-900 transition-all text-left group relative cursor-pointer"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-gray-900 group-hover:text-white transition-colors">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Grade {s.gradeLevel}</span>
                    <button 
                      onClick={(e) => startEditSession(e, s)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => deleteSession(e, s.id)}
                      className={cn(
                        "p-1.5 transition-all rounded-lg flex items-center gap-1",
                        deletingSessionId === s.id ? "bg-red-500 text-white text-[10px] font-bold px-2" : "text-gray-400 hover:text-red-500"
                      )}
                    >
                      {deletingSessionId === s.id ? 'Confirm?' : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{s.title}</h3>
                <p className="text-xs text-gray-500">{format(s.date.toDate(), 'MMMM d, yyyy')}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
              <Calendar className="w-10 h-10" />
            </div>
            <div className="text-center">
              <p className="font-bold text-lg text-gray-900">No sessions yet</p>
              <p className="text-gray-500">Create your first lesson session above.</p>
            </div>
          </div>
        )}

        <AnimatePresence>
          {isCreatingSession && (
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6 text-left"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">{editingSessionId ? 'Edit Session' : 'Start New Session'}</h3>
                  <button onClick={() => { setIsCreatingSession(false); setEditingSessionId(null); setSessionFormData({ title: '', gradeLevel: '1' }); }}>
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lesson Title</label>
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="e.g. Science - Photosynthesis" 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900 focus:outline-none transition-all"
                      value={sessionFormData.title}
                      onChange={e => setSessionFormData({...sessionFormData, title: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Target Grade</label>
                    <select 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900 focus:outline-none transition-all"
                      value={sessionFormData.gradeLevel}
                      onChange={e => setSessionFormData({...sessionFormData, gradeLevel: e.target.value})}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={(i + 1).toString()}>Grade {i + 1}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => { setIsCreatingSession(false); setEditingSessionId(null); setSessionFormData({ title: '', gradeLevel: '1' }); }} className="flex-1 py-3 bg-gray-100 text-gray-900 font-bold rounded-xl active:scale-95 transition-all">Cancel</button>
                  <button onClick={createSession} className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-xl active:scale-95 transition-all">
                    {editingSessionId ? 'Update' : 'Start'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCurrentSession(null)}
            className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{currentSession.title}</h1>
            <p className="text-gray-500 font-mono text-xs uppercase tracking-widest mt-1">SESSION ACTIVE • {format(new Date(), 'MMM d, h:mm a')}</p>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {students.filter(s => s.gradeLevel === currentSession.gradeLevel).map((student) => (
          <motion.div 
            key={student.id}
            layout
            className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-400">
                  {student.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{student.name}</h3>
                  <p className="text-xs text-gray-400 font-mono uppercase">{student.studentId}</p>
                </div>
              </div>

              <div className="flex items-center bg-gray-50 p-1 rounded-xl">
                <AttendanceBtn 
                  label="Present" 
                  active={(attendance[student.id] || 'present') === 'present'} 
                  onClick={() => toggleAttendance(student.id, 'present')} 
                />
                <AttendanceBtn 
                  label="Absent" 
                  active={attendance[student.id] === 'absent'} 
                  onClick={() => toggleAttendance(student.id, 'absent')} 
                />
                <AttendanceBtn 
                  label="Late" 
                  active={attendance[student.id] === 'late'} 
                  onClick={() => toggleAttendance(student.id, 'late')} 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Performance Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button 
                      key={star}
                      onClick={() => updatePerformance(student.id, { rating: star })}
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                        (performance[student.id]?.rating || 5) >= star ? "text-amber-400 bg-amber-50" : "text-gray-200"
                      )}
                    >
                      <Star className={cn("w-6 h-6", (performance[student.id]?.rating || 5) >= star ? "fill-amber-400" : "")} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Session Feedback</label>
                <textarea 
                  placeholder="How did they do today?"
                  className="w-full h-24 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-gray-900 focus:bg-white focus:outline-none transition-all resize-none text-sm"
                  value={performance[student.id]?.feedback || ''}
                  onChange={(e) => updatePerformance(student.id, { feedback: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 pt-2">
               <button 
                onClick={() => saveReport(student)}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-900 font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                <Save className="w-5 h-5" />
                Save Locally
              </button>
              <button 
                onClick={() => sendWhatsApp(student)}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                Send to Parent
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AttendanceBtn({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-xs font-bold rounded-lg transition-all",
        active ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
      )}
    >
      {label}
    </button>
  );
}

