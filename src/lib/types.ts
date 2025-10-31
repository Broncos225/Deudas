
import { Timestamp } from 'firebase/firestore';

export interface Item {
  name: string;
  value: number;
}

export interface Payment {
  id: string;
  amount: number;
  date: Timestamp;
  receiptUrl?: string;
  isSettlement?: boolean; // Flag to identify settlement payments
  settlementId?: string;    // ID of the settlement event
  createdBy?: string; // UID of the user who added the payment
}

export interface Debtor {
  id:string;
  name: string;
  contact?: string;
  type: 'person' | 'entity';
  userId: string;
  // New, more detailed payment fields
  paymentMethod?: 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Otro';
  paymentInfo?: string; // For account number, etc.
  // New fields for app user linking
  isAppUser?: boolean;
  appUserId?: string; // To store the linked user's UID
  appUserPhotoUrl?: string; // Denormalized photo URL of the linked user
}

export interface Debt {
  id: string;
  debtorId: string;
  debtorName: string; // Denormalized for easy display
  amount: number;
  currency: string;
  concept: string;
  items?: Item[]; // Optional array for detailed items
  type: 'iou' | 'uome'; // iou: I owe you (Tú debes), uome: You owe me (Te deben)
  createdAt: Timestamp;
  dueDate?: Timestamp; // Optional due date
  payments: Payment[];
  receiptUrl?: string;
  userId?: string; // For private debts OR the creator of a shared debt
  userOneId?: string; // For shared debts
  userTwoId?: string; // For shared debts
  participants?: string[]; // Array with userOneId and userTwoId for querying
  isShared?: boolean;
  isSettled?: boolean; // No longer used for logic, but for historical tracking if needed
  settlementId?: string; // Which settlement it was part of
  creatorId?: string; // UID of the user who created the shared debt
  // Approval system fields
  status?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string[];
  rejectedBy?: string;
  rejectionReason?: string;
  // Deletion system fields
  deletionStatus?: 'none' | 'requested';
  deletionRequestedBy?: string;
}

export interface Settlement {
    id: string;
    debtorId: string;
    date: Timestamp;
    amountSettled: number;
    currency: string;
    userId: string;
}

export interface ActivityLog {
  id: string;
  debtId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Timestamp;
  participants: string[];
}
