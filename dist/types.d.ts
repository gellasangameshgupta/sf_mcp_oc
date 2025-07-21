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
    reason: z.ZodEnum<["Defective", "Damaged", "Wrong Item", "Not Needed", "Quality Issue", "Size/Color", "Other"]>;
    quantity: z.ZodNumber;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    lineItemId: string;
    reason: "Defective" | "Damaged" | "Wrong Item" | "Not Needed" | "Quality Issue" | "Size/Color" | "Other";
    quantity: number;
    description?: string | undefined;
}, {
    orderId: string;
    lineItemId: string;
    reason: "Defective" | "Damaged" | "Wrong Item" | "Not Needed" | "Quality Issue" | "Size/Color" | "Other";
    quantity: number;
    description?: string | undefined;
}>;
export declare const ReturnLabelRequestSchema: z.ZodObject<{
    returnOrderId: z.ZodString;
    customerEmail: z.ZodString;
}, "strip", z.ZodTypeAny, {
    returnOrderId: string;
    customerEmail: string;
}, {
    returnOrderId: string;
    customerEmail: string;
}>;
export declare const CaseStatusUpdateSchema: z.ZodObject<{
    caseId: z.ZodString;
    status: z.ZodEnum<["New", "Working", "Escalated", "Closed"]>;
    reason: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodEnum<["Low", "Medium", "High", "Critical"]>>;
    assignedTo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "New" | "Working" | "Escalated" | "Closed";
    caseId: string;
    reason?: string | undefined;
    priority?: "Low" | "Medium" | "High" | "Critical" | undefined;
    assignedTo?: string | undefined;
}, {
    status: "New" | "Working" | "Escalated" | "Closed";
    caseId: string;
    reason?: string | undefined;
    priority?: "Low" | "Medium" | "High" | "Critical" | undefined;
    assignedTo?: string | undefined;
}>;
export declare const SlackAlertSchema: z.ZodObject<{
    message: z.ZodString;
    priority: z.ZodDefault<z.ZodEnum<["info", "warning", "error", "critical"]>>;
    caseId: z.ZodOptional<z.ZodString>;
    customFields: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    priority: "info" | "warning" | "error" | "critical";
    caseId?: string | undefined;
    customFields?: Record<string, any> | undefined;
}, {
    message: string;
    caseId?: string | undefined;
    priority?: "info" | "warning" | "error" | "critical" | undefined;
    customFields?: Record<string, any> | undefined;
}>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type ReturnRequest = z.infer<typeof ReturnRequestSchema>;
export type ReturnLabelRequest = z.infer<typeof ReturnLabelRequestSchema>;
export type CaseStatusUpdate = z.infer<typeof CaseStatusUpdateSchema>;
export type SlackAlert = z.infer<typeof SlackAlertSchema>;
export interface SalesforceConfig {
    loginUrl: string;
    username: string;
    password: string;
    securityToken?: string;
    clientId?: string;
    clientSecret?: string;
    slackWebhookUrl?: string;
}
//# sourceMappingURL=types.d.ts.map