import { z } from 'zod';
export declare const OrderStatusSchema: z.ZodObject<{
    orderId: z.ZodString;
    status: z.ZodString;
    carrier: z.ZodOptional<z.ZodString>;
    trackingNumber: z.ZodOptional<z.ZodString>;
    estimatedDelivery: z.ZodOptional<z.ZodString>;
    shippingAddress: z.ZodOptional<z.ZodObject<{
        street: z.ZodString;
        city: z.ZodString;
        state: z.ZodString;
        zipCode: z.ZodString;
        country: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    }, {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    status: string;
    carrier?: string | undefined;
    trackingNumber?: string | undefined;
    estimatedDelivery?: string | undefined;
    shippingAddress?: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    } | undefined;
}, {
    orderId: string;
    status: string;
    carrier?: string | undefined;
    trackingNumber?: string | undefined;
    estimatedDelivery?: string | undefined;
    shippingAddress?: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    } | undefined;
}>;
export declare const ReturnRequestSchema: z.ZodObject<{
    orderId: z.ZodString;
    lineItemId: z.ZodString;
    reason: z.ZodString;
    quantity: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    lineItemId: string;
    reason: string;
    quantity: number;
}, {
    orderId: string;
    lineItemId: string;
    reason: string;
    quantity: number;
}>;
export declare const ReturnLabelRequestSchema: z.ZodObject<{
    returnId: z.ZodString;
    customerEmail: z.ZodString;
}, "strip", z.ZodTypeAny, {
    returnId: string;
    customerEmail: string;
}, {
    returnId: string;
    customerEmail: string;
}>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type ReturnRequest = z.infer<typeof ReturnRequestSchema>;
export type ReturnLabelRequest = z.infer<typeof ReturnLabelRequestSchema>;
export interface SalesforceConfig {
    loginUrl: string;
    username: string;
    password: string;
    securityToken?: string;
    clientId?: string;
    clientSecret?: string;
}
//# sourceMappingURL=types.d.ts.map