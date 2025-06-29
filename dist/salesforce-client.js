import * as jsforce from 'jsforce';
export class SalesforceClient {
    conn;
    config;
    constructor(config) {
        this.config = config;
        this.conn = new jsforce.Connection({
            loginUrl: config.loginUrl
        });
    }
    async connect() {
        try {
            if (this.config.clientId && this.config.clientSecret) {
                await this.conn.login(this.config.username, this.config.password + (this.config.securityToken || ''));
            }
            else {
                await this.conn.login(this.config.username, this.config.password + (this.config.securityToken || ''));
            }
        }
        catch (error) {
            throw new Error(`Failed to connect to Salesforce: ${error}`);
        }
    }
    async getOrderStatus(orderId) {
        try {
            const orderQuery = `
        SELECT Id, OrderNumber, Status, ShippingCarrier__c, TrackingNumber__c, 
               EstimatedDeliveryDate__c, ShippingStreet, ShippingCity, 
               ShippingState, ShippingPostalCode, ShippingCountry
        FROM Order 
        WHERE OrderNumber = '${orderId}' OR Id = '${orderId}'
        LIMIT 1
      `;
            const result = await this.conn.query(orderQuery);
            if (result.records.length === 0) {
                throw new Error(`Order ${orderId} not found`);
            }
            const order = result.records[0];
            return {
                orderId: order.OrderNumber || order.Id,
                status: order.Status,
                carrier: order.ShippingCarrier__c,
                trackingNumber: order.TrackingNumber__c,
                estimatedDelivery: order.EstimatedDeliveryDate__c,
                shippingAddress: order.ShippingStreet ? {
                    street: order.ShippingStreet,
                    city: order.ShippingCity,
                    state: order.ShippingState,
                    zipCode: order.ShippingPostalCode,
                    country: order.ShippingCountry
                } : undefined
            };
        }
        catch (error) {
            throw new Error(`Failed to get order status: ${error}`);
        }
    }
    async createReturn(returnRequest) {
        try {
            const orderItemQuery = `
        SELECT Id, OrderId, Product2Id, Quantity, UnitPrice
        FROM OrderItem 
        WHERE Id = '${returnRequest.lineItemId}'
        LIMIT 1
      `;
            const orderItemResult = await this.conn.query(orderItemQuery);
            if (orderItemResult.records.length === 0) {
                throw new Error(`Order line item ${returnRequest.lineItemId} not found`);
            }
            const orderItem = orderItemResult.records[0];
            const returnRecord = {
                OrderId__c: orderItem.OrderId,
                OrderItemId__c: returnRequest.lineItemId,
                ProductId__c: orderItem.Product2Id,
                Quantity__c: returnRequest.quantity,
                Reason__c: returnRequest.reason,
                Status__c: 'Requested',
                RequestDate__c: new Date().toISOString()
            };
            const result = await this.conn.sobject('Return__c').create(returnRecord);
            if (result.success) {
                return result.id;
            }
            else {
                throw new Error(`Failed to create return: ${result.errors?.[0]?.message || 'Unknown error'}`);
            }
        }
        catch (error) {
            throw new Error(`Failed to create return: ${error}`);
        }
    }
    async emailReturnLabel(returnId, customerEmail) {
        try {
            const returnQuery = `
        SELECT Id, ReturnNumber__c, OrderId__c, Status__c
        FROM Return__c 
        WHERE Id = '${returnId}'
        LIMIT 1
      `;
            const result = await this.conn.query(returnQuery);
            if (result.records.length === 0) {
                throw new Error(`Return ${returnId} not found`);
            }
            const returnRecord = result.records[0];
            const emailTemplate = {
                targetObjectId: returnRecord.OrderId__c,
                templateId: 'ReturnLabelTemplate',
                toAddresses: [customerEmail],
                subject: `Return Label for Return #${returnRecord.ReturnNumber__c}`,
                htmlBody: `
          <p>Dear Customer,</p>
          <p>Please find attached your return label for Return #${returnRecord.ReturnNumber__c}.</p>
          <p>Please print this label and attach it to your return package.</p>
          <p>Thank you for your business.</p>
        `
            };
            await this.conn.sobject('EmailMessage').create(emailTemplate);
            await this.conn.sobject('Return__c').update({
                Id: returnId,
                LabelEmailSent__c: true,
                LabelEmailSentDate__c: new Date().toISOString()
            });
            return true;
        }
        catch (error) {
            throw new Error(`Failed to email return label: ${error}`);
        }
    }
}
//# sourceMappingURL=salesforce-client.js.map