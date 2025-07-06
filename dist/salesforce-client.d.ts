import { SalesforceConfig, OrderStatus, ReturnRequest, CaseStatusUpdate, SlackAlert } from './types.js';
export declare class SalesforceClient {
    private conn;
    private config;
    constructor(config: SalesforceConfig);
    connect(): Promise<void>;
    getOrderStatus(orderId: string): Promise<OrderStatus>;
    createReturn(returnRequest: ReturnRequest): Promise<string>;
    emailReturnLabel(returnOrderId: string, customerEmail: string): Promise<boolean>;
    createCaseFromReturn(returnOrderId: string): Promise<string>;
    updateCaseStatus(caseUpdate: CaseStatusUpdate): Promise<boolean>;
    sendSlackAlert(alert: SlackAlert): Promise<boolean>;
    private isValidStatusTransition;
    private getSlackIconByPriority;
    private getSlackColorByPriority;
}
//# sourceMappingURL=salesforce-client.d.ts.map