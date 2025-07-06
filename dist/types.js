import { z } from 'zod';
export const OrderStatusSchema = z.object({
    orderId: z.string(),
    status: z.string(),
    carrier: z.string().optional(),
    trackingNumber: z.string().optional(),
    estimatedDelivery: z.string().optional(),
    shippingAddress: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zipCode: z.string(),
        country: z.string()
    }).optional()
});
export const ReturnRequestSchema = z.object({
    orderId: z.string(),
    lineItemId: z.string(),
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
    channel: z.string().optional(),
    priority: z.enum(['info', 'warning', 'error', 'critical']).default('info'),
    caseId: z.string().optional(),
    customFields: z.record(z.string(), z.any()).optional()
});
//# sourceMappingURL=types.js.map