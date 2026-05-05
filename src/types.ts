import { Timestamp } from 'firebase/firestore';

export interface Student {
  id: string; // Firebase doc ID
  studentId: string; // custom ID like ST-001
  name: string;
  gradeLevel: string;
  parentName: string;
  parentPhone: string;
  teacherUid: string;
  createdAt: Timestamp;
}

export interface Session {
  id: string;
  date: Timestamp;
  title: string;
  gradeLevel: string;
  teacherUid: string;
  createdAt: Timestamp;
}

export interface Attendance {
  id: string;
  sessionId: string;
  studentId: string;
  teacherUid: string;
  status: 'present' | 'absent' | 'late';
  date: Timestamp;
}

export interface Grade {
  id: string;
  studentId: string;
  teacherUid: string;
  title: string;
  score: number;
  maxScore: number;
  date: Timestamp;
}

export interface Performance {
  id: string;
  sessionId: string;
  studentId: string;
  teacherUid: string;
  feedback: string;
  rating: number; // 1-5
  date: Timestamp;
  whatsappSent: boolean;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
