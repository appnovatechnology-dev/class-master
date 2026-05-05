import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  auth,
  db
} from '../lib/firebase';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'motion/react';
import { GraduationCap, LogIn, UserPlus, Mail, Lock, User, Phone, Loader2 } from 'lucide-react';
import { handleFirestoreError } from '../lib/error-handler';
import { OperationType } from '../types';

interface AuthPageProps {
  connectionError: boolean;
}

export default function AuthPage({ connectionError }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;

        // Update Auth Profile
        await updateProfile(user, { displayName: formData.name });

        // Save supplementary data to Firestore
        await setDoc(doc(db, 'teachers', user.uid), {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          createdAt: serverTimestamp()
        });
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already in use. Try logging in instead.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password sign-in is not enabled. Please enable it in the Firebase Console (Authentication > Sign-in method).');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError('An unexpected error occurred. Please try again.');
        // Only report to handleFirestoreError if it's not a known validation error
        handleFirestoreError(err, isLogin ? OperationType.GET : OperationType.CREATE, 'auth');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-8 md:p-10 border border-gray-100">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gray-900 text-white flex items-center justify-center mb-4">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">ClassMaster</h1>
            <p className="text-gray-500 text-sm mt-1">{isLogin ? 'Welcome back, Teacher!' : 'Create your teacher account'}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                    <input 
                      required
                      type="text"
                      placeholder="Enter your name"
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900 focus:outline-none transition-all text-sm"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                    <input 
                      required
                      type="tel"
                      placeholder="+123..."
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900 focus:outline-none transition-all text-sm"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input 
                  required
                  type="email"
                  placeholder="name@school.com"
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900 focus:outline-none transition-all text-sm"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input 
                  required
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900 focus:outline-none transition-all text-sm"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            {error && (
              <motion.p 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xs font-medium text-red-500 ml-1"
              >
                {error}
              </motion.p>
            )}

            <button
              disabled={loading}
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 active:scale-[0.98] transition-all shadow-lg shadow-gray-200 disabled:opacity-70 disabled:pointer-events-none mt-6"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isLogin ? (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Create Account
                </>
              )}
            </button>
          </form>

          <footer className="mt-8 text-center text-sm">
            <span className="text-gray-500">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
            </span>
            <button 
              onClick={() => { setIsLogin(!isLogin); setError(null); }}
              className="ml-2 font-bold text-gray-900 hover:underline"
            >
              {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </footer>

          {connectionError && (
            <p className="mt-6 text-[10px] text-center text-red-400 uppercase tracking-widest font-bold">
              Database Connection Error
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
