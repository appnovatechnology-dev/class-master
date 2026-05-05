import { useState, useEffect, FormEvent } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Student } from '../types';
import { Search, UserPlus, MoreVertical, Trash2, Edit2, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError } from '../lib/error-handler';
import { OperationType } from '../types';
import { cn } from '../lib/utils';

export default function StudentList() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    studentId: '',
    name: '',
    gradeLevel: '1',
    parentName: '',
    parentPhone: ''
  });

  const fetchStudents = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'students'), where('teacherUid', '==', auth.currentUser.uid));
      const snap = await getDocs(q);
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[]);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      if (editingId) {
        await updateDoc(doc(db, 'students', editingId), {
          ...formData
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'students'), {
          ...formData,
          teacherUid: auth.currentUser.uid,
          createdAt: serverTimestamp()
        });
        setIsAdding(false);
      }
      setFormData({ studentId: '', name: '', gradeLevel: '1', parentName: '', parentPhone: '' });
      fetchStudents();
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'students');
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (deletingId !== id) {
      setDeletingId(id);
      setTimeout(() => setDeletingId(null), 3000);
      return;
    }
    try {
      await deleteDoc(doc(db, 'students', id));
      setDeletingId(null);
      fetchStudents();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `students/${id}`);
    }
  };

  const startEdit = (student: Student) => {
    setEditingId(student.id);
    setFormData({
      studentId: student.studentId,
      name: student.name,
      gradeLevel: student.gradeLevel || '1',
      parentName: student.parentName,
      parentPhone: student.parentPhone
    });
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `grade ${s.gradeLevel}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Students</h1>
          <p className="text-gray-500 mt-1">Manage your student roster and parent contacts.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Add Student
        </button>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input 
          type="text" 
          placeholder="Search by name or ID..." 
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:outline-none transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <AnimatePresence>
        {(isAdding || editingId) && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Student' : 'Add New Student'}</h2>
                <button type="button" onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Student ID (e.g. ST-001)" value={formData.studentId} onChange={v => setFormData({...formData, studentId: v})} required />
                <Input label="Full Name" value={formData.name} onChange={v => setFormData({...formData, name: v})} required />
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Grade Level</label>
                  <select 
                    value={formData.gradeLevel} 
                    onChange={(e) => setFormData({...formData, gradeLevel: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900 focus:outline-none transition-all text-sm font-medium"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={(i + 1).toString()}>Grade {i + 1}</option>
                    ))}
                  </select>
                </div>
                <Input label="Parent Name" value={formData.parentName} onChange={v => setFormData({...formData, parentName: v})} required />
                <Input label="Parent WhatsApp (include country code)" value={formData.parentPhone} onChange={v => setFormData({...formData, parentPhone: v})} placeholder="+1..." required />
              </div>
              <button 
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
              >
                <Check className="w-5 h-5" />
                {editingId ? 'Update Student' : 'Save Student'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">ID</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Grade</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Parent</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">WhatsApp</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-400">Loading students...</td></tr>
            ) : filteredStudents.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-400">No students found.</td></tr>
            ) : (
              filteredStudents.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4 font-mono text-sm text-gray-500">{s.studentId}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">{s.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-medium">Grade {s.gradeLevel}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.parentName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.parentPhone}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <button onClick={() => startEdit(s)} className="p-2 text-gray-400 hover:text-blue-500 transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(s.id)} 
                        className={cn(
                          "p-2 transition-all rounded-lg flex items-center gap-1",
                          deletingId === s.id ? "bg-red-500 text-white text-[10px] font-bold px-2" : "text-gray-400 hover:text-red-500"
                        )}
                      >
                        {deletingId === s.id ? 'Confirm?' : <Trash2 className="w-4 h-4" />}
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

function Input({ label, value, onChange, required, placeholder }: { label: string, value: string, onChange: (v: string) => void, required?: boolean, placeholder?: string }) {
  return (
    <div className="space-y-1.5 text-left">
      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</label>
      <input 
        type="text" 
        value={value} 
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900 focus:outline-none transition-all text-sm font-medium"
      />
    </div>
  );
}
