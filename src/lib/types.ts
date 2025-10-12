import { Timestamp } from 'firebase/firestore';

export interface Payment {
  id: string;
  amount: number;
  date: string | Date | Timestamp;
  receiptUrl?: string;
  isSettlement?: boolean; // Flag to identify settlement payments
  settlementId?: string;    // ID of the settlement event
}

export interface Debtor {
  id: string;
  name: string;
  contact?: string;
  type: 'person' | 'entity';
  userId: string;
}

export interface Debt {
  id: string;
  debtorId: string;
  debtorName: string; // Denormalized for easy display
  amount: number;
  currency: string;
  concept: string;
  type: 'iou' | 'uome'; // iou: I owe you (Tú debes), uome: You owe me (Te deben)
  createdAt: Timestamp;
  payments: Payment[];
  receiptUrl?: string;
  userId: string;
  isSettled?: boolean; // No longer used for logic, but for historical tracking if needed
  settlementId?: string; // Which settlement it was part of
}

export interface Settlement {
    id: string;
    debtorId: string;
    date: Timestamp;
    amountSettled: number;
    currency: string;
    userId: string;
}
