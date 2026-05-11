import { z } from 'zod';

export const TransactionStatusSchema = z.enum(['active', 'reversed', 'pending', 'deleted']);
export const FinanceTypeSchema = z.enum(['income', 'expense']);
export const FinanceCategorySchema = z.enum([
  'tuition', 
  'registration', 
  'other_income',
  'salary',
  'rent',
  'utility',
  'internet',
  'maintenance',
  'other_expense'
]);

export const FinanceTransactionSchema = z.object({
  id: z.string().optional(),
  type: FinanceTypeSchema,
  amount: z.number().positive(),
  description: z.string().min(3),
  category: FinanceCategorySchema,
  date: z.string(), // ISO string
  studentId: z.string().optional(),
  studentName: z.string().optional(),
  studentMatricule: z.string().optional(),
  paymentMethod: z.string().optional(),
  receiptNumber: z.string().optional(),
  accountType: z.enum(['caisse', 'banque']).default('caisse'),
  status: TransactionStatusSchema.default('active'),
  idempotencyKey: z.string().optional(),
  levelId: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdBy: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type FinanceTransaction = z.infer<typeof FinanceTransactionSchema>;

export const AuditLogSchema = z.object({
  id: z.string().optional(),
  action: z.string(),
  userId: z.string(),
  userEmail: z.string().optional(),
  resourceType: z.string(),
  resourceId: z.string().optional(),
  oldValue: z.any().optional(),
  newValue: z.any().optional(),
  timestamp: z.string(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
});

export type AuditLogEntry = z.infer<typeof AuditLogSchema>;
