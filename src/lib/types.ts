
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
  createdBy: string;
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

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  userId: string;
}

export interface Recurrence {
    frequency: "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
    endDate?: Timestamp;
    nextOccurrenceDate: Timestamp;
    lastGeneratedDate?: Timestamp;
    status: 'active' | 'paused';
    dayOfMonth?: number;
    activeDebtId?: string;
}


export interface Debt {
  id: string;
  debtorId: string;
  debtorName: string; // Denormalized for easy display
  amount: number;
  currency: string;
  concept: string;
  description?: string; // Optional detailed description
  categoryId?: string; // This will be populated on the client from DebtUserMetadata
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
  originalDebtor?: string; // Name of the person who originally owed the money in a 3-way split
  // Approval system fields
  status?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string[];
  rejectedBy?: string;
  rejectionReason?: string;
  // Deletion system fields
  deletionStatus?: 'none' | 'requested';
  deletionRequestedBy?: string;
  // Recurring Debts
  isRecurring?: boolean;
  recurrence?: Recurrence;
  generatedFromRecurringId?: string; // ID of the template that generated this debt
}

export interface Settlement {
    id: string;
    debtorId: string;
    date: Timestamp;
    amountSettled: number;
    currency: string;
    proposerId: string;
    participants: string[];
    status: 'pending' | 'approved' | 'rejected' | 'reversal_pending';
}

export interface ActivityLog {
  id: string;
  debtId: string;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  message: string;
  timestamp: Timestamp;
  participants: string[];
}

export interface DebtUserMetadata {
    id: string; // Composite key: `${userId}_${debtId}`
    userId: string;
    debtId: string;
    categoryId: string;
}
