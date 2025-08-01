import { z } from 'zod';

export const OrderStatusSchema = z.object({
  orderId: z.string(),
  status: z.string(),
  amount: z.number().optional()
});

export const ReturnRequestSchema = z.object({
  orderId: z.string(),
  lineItemId: z.string(), // Can be Salesforce ID or 'AUTO_DETECT'
  reason: z.enum(['Defective', 'Damaged', 'Wrong Item', 'Not Needed', 'Quality Issue', 'Size/Color', 'Other']),
  quantity: z.number().min(1),
  description: z.string().optional()
});

export const ReturnLabelRequestSchema = z.object({
  returnOrderId: z.string(),
  customerEmail: z.string()
});

export const CaseStatusUpdateSchema = z.object({
  caseId: z.string(),
  status: z.enum(['New', 'Working', 'Escalated', 'Closed']),
  reason: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  assignedTo: z.string().optional()
});

export const SlackAlertSchema = z.object({
  message: z.string(),
  priority: z.enum(['info', 'warning', 'error', 'critical']).default('info'),
  caseId: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional()
});

export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type ReturnRequest = z.infer<typeof ReturnRequestSchema>;
export type ReturnLabelRequest = z.infer<typeof ReturnLabelRequestSchema>;
export type CaseStatusUpdate = z.infer<typeof CaseStatusUpdateSchema>;
export type SlackAlert = z.infer<typeof SlackAlertSchema>;

export interface SalesforceConfig {
  loginUrl: string;
  username: string;
  password: string;
  securityToken: string;
  slackWebhookUrl?: string;
}