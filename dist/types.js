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
    reason: z.string(),
    quantity: z.number().min(1)
});
export const ReturnLabelRequestSchema = z.object({
    returnId: z.string(),
    customerEmail: z.string()
});
//# sourceMappingURL=types.js.map