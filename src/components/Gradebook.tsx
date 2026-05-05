import { useState, useEffect, FormEvent } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Student, Grade } from '../types';
import { GraduationCap, Plus, Search, Trophy, Filter, X, Check, Edit2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { handleFirestoreError } from '../lib/error-handler';
import { OperationType } from '../types';

export default function Gradebook() {
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');

  const [formData, setFormData] = useState({
    studentId: '',
    title: '',
    score: '',
    maxScore: ''
  });

  const fetchData = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const sRef = query(collection(db, 'students'), where('teacherUid', '==', auth.currentUser.uid));
      const gRef = query(collection(db, 'grades'), where('teacherUid', '==', auth.currentUser.uid), orderBy('date', 'desc'));
      
      const [sSnap, gSnap] = await Promise.all([getDocs(sRef), getDocs(gRef)]);
      
      setStudents(sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[]);
      setGrades(gSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Grade[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      if (editingId) {
        await updateDoc(doc(db, 'grades', editingId), {
          studentId: formData.studentId,
          title: formData.title,
          score: Number(formData.score),
          maxScore: Number(formData.maxScore),
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'grades'), {
          studentId: formData.studentId,
          teacherUid: auth.currentUser.uid,
          title: formData.title,
          score: Number(formData.score),
          maxScore: Number(formData.maxScore),
          date: serverTimestamp()
        });
      }
      setIsAdding(false);
      setFormData({ studentId: '', title: '', score: '', maxScore: '' });
      fetchData();
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'grades');
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId !== id) {
      setDeletingId(id);
      setTimeout(() => setDeletingId(null), 3000);
      return;
    }
    try {
      await deleteDoc(doc(db, 'grades', id));
      setDeletingId(null);
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `grades/${id}`);
    }
  };

  const startEdit = (grade: Grade) => {
    setEditingId(grade.id);
    setFormData({
      studentId: grade.studentId,
      title: grade.title,
      score: grade.score.toString(),
      maxScore: grade.maxScore.toString()
    });
    setIsAdding(true);
  };

  const getStudentName = (id: string) => students.find(s => s.id === id)?.name || 'Unknown';

  const filteredGrades = grades.filter(g => {
    const student = students.find(s => s.id === g.studentId);
    const matchesSearch = g.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          student?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = gradeFilter === 'all' || student?.gradeLevel === gradeFilter;
    return matchesSearch && matchesGrade;
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Gradebook</h1>
          <p className="text-gray-500 mt-1">Track assignments and academic progress.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Grade
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-2 h-full">
           <div className="relative h-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by assignment or student..." 
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:outline-none transition-all h-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="md:col-span-1 h-full">
          <select 
            value={gradeFilter} 
            onChange={(e) => setGradeFilter(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:outline-none transition-all h-full text-sm font-medium"
          >
            <option value="all">All Grades</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={(i + 1).toString()}>Grade {i + 1}</option>
            ))}
          </select>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-center gap-2 text-sm font-bold text-gray-600">
          <Trophy className="w-4 h-4 text-amber-500" />
          AVG. : {grades.length > 0 ? (grades.reduce((acc, g) => acc + (g.score / g.maxScore), 0) / grades.length * 100).toFixed(0) : 0}%
        </div>
      </div>

       <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-gray-900">Add New Grade</h2>
                <button type="button" onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Student</label>
                  <select 
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900 focus:outline-none transition-all text-sm font-medium"
                    value={formData.studentId}
                    onChange={e => setFormData({...formData, studentId: e.target.value})}
                  >
                    <option value="">Select a student...</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Assignment Title</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Midterm Exams"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900 focus:outline-none transition-all text-sm font-medium"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Score</label>
                  <input 
                    type="number" 
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900 focus:outline-none transition-all text-sm font-medium"
                    value={formData.score}
                    onChange={e => setFormData({...formData, score: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Max Score</label>
                  <input 
                    type="number" 
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900 focus:outline-none transition-all text-sm font-medium"
                    value={formData.maxScore}
                    onChange={e => setFormData({...formData, maxScore: e.target.value})}
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
              >
                <Check className="w-5 h-5" />
                Submit Grade
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Student</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Assignment</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Score</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Grade</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-400">Loading gradebook...</td></tr>
            ) : filteredGrades.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-400">No grades recorded yet.</td></tr>
            ) : (
              filteredGrades.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4 text-sm text-gray-500">{format(g.date.toDate(), 'MMM d')}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">
                    {getStudentName(g.studentId)}
                    <span className="ml-2 px-2 py-0.5 bg-gray-100 text-[10px] text-gray-500 rounded uppercase font-bold tracking-tighter">
                      Grade {students.find(s => s.id === g.studentId)?.gradeLevel}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-medium">{g.title}</td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">{g.score}/{g.maxScore}</td>
                  <td className="px-6 py-4">
                    <GradeBadge percentage={(g.score / g.maxScore) * 100} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEdit(g)} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(g.id)} 
                        className={cn(
                          "p-1.5 transition-all rounded-lg flex items-center gap-1",
                          deletingId === g.id ? "bg-red-500 text-white text-[10px] font-bold px-2" : "text-gray-400 hover:text-red-500"
                        )}
                      >
                        {deletingId === g.id ? 'Confirm?' : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GradeBadge({ percentage }: { percentage: number }) {
  let color = "text-emerald-600 bg-emerald-50";
  let label = "A";

  if (percentage < 60) { label = "F"; color = "text-red-600 bg-red-50"; }
  else if (percentage < 70) { label = "D"; color = "text-orange-600 bg-orange-50"; }
  else if (percentage < 80) { label = "C"; color = "text-amber-600 bg-amber-50"; }
  else if (percentage < 90) { label = "B"; color = "text-blue-600 bg-blue-50"; }

  return (
    <span className={cn("px-3 py-1 rounded-full text-xs font-bold", color)}>
      {label} ({percentage.toFixed(0)}%)
    </span>
  );
}
