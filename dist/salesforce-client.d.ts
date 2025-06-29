import { SalesforceConfig, OrderStatus, ReturnRequest } from './types.js';
export declare class SalesforceClient {
    private conn;
    private config;
    constructor(config: SalesforceConfig);
    connect(): Promise<void>;
    getOrderStatus(orderId: string): Promise<OrderStatus>;
    createReturn(returnRequest: ReturnRequest): Promise<string>;
    emailReturnLabel(returnId: string, customerEmail: string): Promise<boolean>;
}
//# sourceMappingURL=salesforce-client.d.ts.map