import { FinanceTransaction } from '../lib/validations';
import { v4 as uuidv4 } from 'uuid';

const API_BASE = '/api';

export class FinanceService {
  /**
   * Records a student payment (tuition or registration)
   */
  static async recordPayment(paymentData: Partial<FinanceTransaction>, token?: string) {
    const idempotencyKey = uuidv4();
    const finalToken = token || localStorage.getItem('token');
    
    // Prepare the payload for the atomic endpoint
    const response = await fetch(`${API_BASE}/financial-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalToken}`
      },
      body: JSON.stringify({
        type: 'payment',
        payload: {
          ...paymentData,
          idempotencyKey
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erreur lors de l’enregistrement du paiement');
    }

    return await response.json();
  }

  /**
   * Records a general expense
   */
  static async recordExpense(expenseData: Partial<FinanceTransaction>, token?: string) {
    const idempotencyKey = uuidv4();
    const finalToken = token || localStorage.getItem('token');
    
    const response = await fetch(`${API_BASE}/financial-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalToken}`
      },
      body: JSON.stringify({
        type: 'expense',
        payload: {
          ...expenseData,
          idempotencyKey
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erreur lors de l’enregistrement de la dépense');
    }

    return await response.json();
  }

  /**
   * Reverses an existing transaction
   */
  static async reverseTransaction(originalFinanceId: string, reason: string, token?: string) {
    const idempotencyKey = uuidv4();
    const finalToken = token || localStorage.getItem('token');
    
    const response = await fetch(`${API_BASE}/financial-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalToken}`
      },
      body: JSON.stringify({
        type: 'reversal',
        payload: {
          originalFinanceId,
          description: `ANNULATION: ${reason}`,
          amount: 1, // Placeholder, logic uses original amount
          category: 'other_expense',
          date: new Date().toISOString(),
          idempotencyKey
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erreur lors de l’annulation de la transaction');
    }

    return await response.json();
  }

  /**
   * Fetches the ledger with optional filters
   */
  static async getLedger(filters?: { year?: string; month?: string }, token?: string) {
    const params = new URLSearchParams();
    if (filters?.year) params.append('year', filters.year);
    if (filters?.month) params.append('month', filters.month);

    const finalToken = token || localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/finances?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${finalToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération du grand livre');
    }

    return await response.json();
  }
}
