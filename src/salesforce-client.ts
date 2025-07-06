import * as jsforce from 'jsforce';
import { SalesforceConfig, OrderStatus, ReturnRequest, CaseStatusUpdate, SlackAlert } from './types.js';

export class SalesforceClient {
  private conn: jsforce.Connection;
  private config: SalesforceConfig;

  constructor(config: SalesforceConfig) {
    this.config = config;
    this.conn = new jsforce.Connection({
      loginUrl: config.loginUrl
    });
  }

  async connect(): Promise<void> {
    try {
      if (this.config.clientId && this.config.clientSecret) {
        await this.conn.login(this.config.username, this.config.password + (this.config.securityToken || ''));
      } else {
        await this.conn.login(this.config.username, this.config.password + (this.config.securityToken || ''));
      }
    } catch (error) {
      throw new Error(`Failed to connect to Salesforce: ${error}`);
    }
  }

  async getOrderStatus(orderId: string): Promise<OrderStatus> {
    try {
      // Check if orderId looks like a Salesforce ID (15 or 18 chars, alphanumeric)
      const isSalesforceId = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(orderId);
      
      let orderQuery;
      if (isSalesforceId) {
        orderQuery = `
          SELECT Id, OrderNumber, Status, ShippingCarrier__c, TrackingNumber__c, 
                 EstimatedDeliveryDate__c, ShippingStreet, ShippingCity, 
                 ShippingState, ShippingPostalCode, ShippingCountry
          FROM Order 
          WHERE Id = '${orderId}'
          LIMIT 1
        `;
      } else {
        orderQuery = `
          SELECT Id, OrderNumber, Status, ShippingCarrier__c, TrackingNumber__c, 
                 EstimatedDeliveryDate__c, ShippingStreet, ShippingCity, 
                 ShippingState, ShippingPostalCode, ShippingCountry
          FROM Order 
          WHERE OrderNumber = '${orderId}'
          LIMIT 1
        `;
      }

      const result = await this.conn.query(orderQuery);
      
      if (result.records.length === 0) {
        throw new Error(`Order ${orderId} not found`);
      }

      const order = result.records[0] as any;
      
      return {
        orderId: order.OrderNumber,
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
    } catch (error) {
      throw new Error(`Failed to get order status: ${error}`);
    }
  }

  async createReturn(returnRequest: ReturnRequest): Promise<string> {
    try {
      // Input validation
      if (!returnRequest.lineItemId || typeof returnRequest.lineItemId !== 'string') {
        throw new Error('Line Item ID is required and must be a string');
      }

      if (!returnRequest.quantity || returnRequest.quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }

      // Validate line item ID format (Salesforce ID format)
      if (!/^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(returnRequest.lineItemId)) {
        throw new Error('Invalid line item ID format. Must be a valid Salesforce ID (15 or 18 characters)');
      }

      const orderItemQuery = `
        SELECT Id, OrderId, Product2Id, Quantity, UnitPrice, Order.AccountId
        FROM OrderItem 
        WHERE Id = '${returnRequest.lineItemId}'
        LIMIT 1
      `;

      const orderItemResult = await this.conn.query(orderItemQuery);
      
      if (orderItemResult.records.length === 0) {
        throw new Error(`Order line item ${returnRequest.lineItemId} not found`);
      }

      const orderItem = orderItemResult.records[0] as any;

      // Validate return quantity doesn't exceed original quantity
      if (returnRequest.quantity > orderItem.Quantity) {
        throw new Error(`Return quantity (${returnRequest.quantity}) cannot exceed original order quantity (${orderItem.Quantity})`);
      }

      // Create ReturnOrder first
      const returnOrderRecord = {
        OrderId: orderItem.OrderId,
        AccountId: orderItem.Order.AccountId,
        Status: 'Draft',
        Description: returnRequest.description || `Return for Order Item ${returnRequest.lineItemId}`
      };

      const returnOrderResult = await this.conn.sobject('ReturnOrder').create(returnOrderRecord);
      
      if (!returnOrderResult.success) {
        throw new Error(`Failed to create return order: ${returnOrderResult.errors?.[0]?.message || 'Unknown error'}`);
      }

      // Create ReturnOrderLineItem
      const returnLineItemRecord = {
        ReturnOrderId: returnOrderResult.id,
        OrderItemId: returnRequest.lineItemId,
        Product2Id: orderItem.Product2Id,
        QuantityReturned: returnRequest.quantity,
        Description: returnRequest.description || `Return ${returnRequest.quantity} unit(s) - ${returnRequest.reason || 'No reason provided'}`,
      };

      const returnLineItemResult = await this.conn.sobject('ReturnOrderLineItem').create(returnLineItemRecord);
      
      if (!returnLineItemResult.success) {
        // Rollback the ReturnOrder if LineItem creation fails
        await this.conn.sobject('ReturnOrder').delete(returnOrderResult.id);
        throw new Error(`Failed to create return line item: ${returnLineItemResult.errors?.[0]?.message || 'Unknown error'}`);
      }

      // Update ReturnOrder status to Submitted
      await this.conn.sobject('ReturnOrder').update({
        Id: returnOrderResult.id,
        Status: 'Submitted'
      });

      return returnOrderResult.id;
    } catch (error) {
      throw new Error(`Failed to create return: ${error}`);
    }
  }

  async emailReturnLabel(returnOrderId: string, customerEmail: string): Promise<boolean> {
    try {
      // Input validation
      if (!returnOrderId || typeof returnOrderId !== 'string') {
        throw new Error('Return Order ID is required and must be a string');
      }

      if (!customerEmail || typeof customerEmail !== 'string') {
        throw new Error('Customer email is required and must be a string');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail)) {
        throw new Error('Invalid email format');
      }

      // Validate return order ID format
      if (!/^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(returnOrderId)) {
        throw new Error('Invalid return order ID format. Must be a valid Salesforce ID (15 or 18 characters)');
      }

      const returnQuery = `
        SELECT Id, ReturnOrderNumber, OrderId, Status, Description, LabelEmailSent__c, LabelEmailSentDate__c
        FROM ReturnOrder 
        WHERE Id = '${returnOrderId}'
        LIMIT 1
      `;

      const result = await this.conn.query(returnQuery);
      
      if (result.records.length === 0) {
        throw new Error(`Return Order ${returnOrderId} not found`);
      }

      const returnOrder = result.records[0] as any;

      // Business validation - only send labels for approved returns
      if (!['Approved', 'Partially Fulfilled'].includes(returnOrder.Status)) {
        throw new Error(`Cannot send return label. Return order status is ${returnOrder.Status}. Status must be Approved or Partially Fulfilled.`);
      }

      // Check if label was already sent
      if (returnOrder.LabelEmailSent__c) {
        throw new Error(`Return label has already been sent on ${returnOrder.LabelEmailSentDate__c}. Cannot send duplicate labels.`);
      }

      const emailTemplate = {
        //targetObjectId: returnOrder.OrderId,
        ToAddress: customerEmail,
        Subject: `Return Label for Return Order #${returnOrder.ReturnOrderNumber}`,
        HtmlBody: `
          <p>Dear Customer,</p>
          <p>Please find attached your return label for Return Order #${returnOrder.ReturnOrderNumber}.</p>
          <p><strong>Return Details:</strong></p>
          <ul>
            <li>Return Order Number: ${returnOrder.ReturnOrderNumber}</li>
            <li>Status: ${returnOrder.Status}</li>
            <li>Description: ${returnOrder.Description || 'N/A'}</li>
          </ul>
          <p><strong>Instructions:</strong></p>
          <ol>
            <li>Print this return label</li>
            <li>Package your items securely</li>
            <li>Attach the label to your return package</li>
            <li>Drop off at any authorized shipping location</li>
          </ol>
          <p>Please allow 3-5 business days for processing once we receive your return.</p>
          <p>Thank you for your business.</p>
          <p>Best regards,<br/>Customer Service Team</p>
        `
      };

      await this.conn.sobject('EmailMessage').create(emailTemplate);
      
      // Update return order with custom fields (these would need to be added to ReturnOrder)
      const updateFields: any = {};
      
      // Check if custom fields exist before updating
      try {
        updateFields.LabelEmailSent__c = true;
        updateFields.LabelEmailSentDate__c = new Date().toISOString();
        
        await this.conn.sobject('ReturnOrder').update({
          Id: returnOrderId,
          ...updateFields
        });
      } catch (customFieldError) {
        // If custom fields don't exist, just log and continue
        console.warn('Custom email tracking fields not found on ReturnOrder. Email sent but tracking not updated:', customFieldError);
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to email return label: ${error}`);
    }
  }

  async updateCaseStatus(caseUpdate: CaseStatusUpdate): Promise<boolean> {
    try {
      // Input validation
      if (!caseUpdate.caseId || typeof caseUpdate.caseId !== 'string') {
        throw new Error('Case ID is required and must be a string');
      }

      if (!caseUpdate.status || typeof caseUpdate.status !== 'string') {
        throw new Error('Status is required and must be a string');
      }

      // Validate case ID format (Salesforce ID format)
      if (!/^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(caseUpdate.caseId)) {
        throw new Error('Invalid case ID format. Must be a valid Salesforce ID (15 or 18 characters)');
      }

      // First, validate the case exists and get current status
      const caseQuery = `
        SELECT Id, CaseNumber, Status, Priority, OwnerId, Subject, Description, IsClosed
        FROM Case 
        WHERE Id = '${caseUpdate.caseId}'
        LIMIT 1
      `;

      const queryResult = await this.conn.query(caseQuery);
      
      if (queryResult.records.length === 0) {
        throw new Error(`Case ${caseUpdate.caseId} not found`);
      }

      const currentCase = queryResult.records[0] as any;
      const previousStatus = currentCase.Status;

      // Business rule validations
      if (currentCase.IsClosed && caseUpdate.status !== 'Closed') {
        throw new Error('Cannot reopen a closed case. Please create a new case instead.');
      }

      if (previousStatus === caseUpdate.status) {
        throw new Error(`Case is already in ${caseUpdate.status} status. No update needed.`);
      }

      // Validate status transition rules
      if (!this.isValidStatusTransition(previousStatus, caseUpdate.status)) {
        throw new Error(`Invalid status transition from ${previousStatus} to ${caseUpdate.status}`);
      }

      // Build update record
      const updateRecord: any = {
        Id: caseUpdate.caseId,
        Status: caseUpdate.status
      };

      if (caseUpdate.priority) {
        updateRecord.Priority = caseUpdate.priority;
      }

      if (caseUpdate.assignedTo) {
        // Validate user exists
        const userQuery = `SELECT Id FROM User WHERE Id = '${caseUpdate.assignedTo}' OR Username = '${caseUpdate.assignedTo}' LIMIT 1`;
        const userResult = await this.conn.query(userQuery);
        
        if (userResult.records.length === 0) {
          throw new Error(`User ${caseUpdate.assignedTo} not found`);
        }
        
        updateRecord.OwnerId = userResult.records[0].Id;
      }

      // Update the case
      const updateResult = await this.conn.sobject('Case').update(updateRecord);
      
      // Handle JSForce update result
      const updateResponse = Array.isArray(updateResult) ? updateResult[0] : updateResult;
      if (!(updateResponse as any).success) {
        throw new Error(`Failed to update case: ${(updateResponse as any).errors?.[0]?.message || 'Unknown error'}`);
      }

      // Create case history record for audit trail
      if (caseUpdate.reason) {
        await this.conn.sobject('CaseComment').create({
          ParentId: caseUpdate.caseId,
          CommentBody: `Status changed from ${previousStatus} to ${caseUpdate.status}. Reason: ${caseUpdate.reason}`,
          IsPublished: true
        });
      }

      // Send Slack alert for status change
      if (this.config.slackWebhookUrl) {
        await this.sendSlackAlert({
          message: `Case ${currentCase.CaseNumber} status updated from ${previousStatus} to ${caseUpdate.status}`,
          priority: caseUpdate.status === 'Escalated' ? 'warning' : 'info',
          caseId: caseUpdate.caseId,
          customFields: {
            caseNumber: currentCase.CaseNumber,
            subject: currentCase.Subject,
            previousStatus,
            newStatus: caseUpdate.status,
            reason: caseUpdate.reason
          }
        });
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to update case status: ${error}`);
    }
  }

  async createCaseFromReturn(returnOrderId: string): Promise<string> {
    try {
      // Input validation
      if (!returnOrderId || typeof returnOrderId !== 'string') {
        throw new Error('Return Order ID is required and must be a string');
      }

      // Validate return order ID format (Salesforce ID format)
      if (!/^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(returnOrderId)) {
        throw new Error('Invalid return order ID format. Must be a valid Salesforce ID (15 or 18 characters)');
      }

      // Get return order details with line items
      const returnQuery = `
        SELECT Id, ReturnOrderNumber, OrderId, Status, Description, Account.Name, CaseId,
               (SELECT Id, Product2Id, Product2.Name, QuantityReturned, Description 
                FROM ReturnOrderLineItems)
        FROM ReturnOrder 
        WHERE Id = '${returnOrderId}'
        LIMIT 1
      `;

      const returnResult = await this.conn.query(returnQuery);
      
      if (returnResult.records.length === 0) {
        throw new Error(`Return Order ${returnOrderId} not found`);
      }

      const returnOrder = returnResult.records[0] as any;

      // Check if case already exists for this return
      if (returnOrder.CaseId) {
        throw new Error(`A case already exists for return order ${returnOrder.ReturnOrderNumber}. Case ID: ${returnOrder.CaseId}`);
      }

      // Validate return status - only create cases for certain statuses
      if (!['Submitted', 'Approved', 'Partially Fulfilled'].includes(returnOrder.Status)) {
        throw new Error(`Cannot create case for return order with status: ${returnOrder.Status}. Return must be in Submitted, Approved, or Partially Fulfilled status.`);
      }

      // Get order details for context
      const orderQuery = `
        SELECT Id, OrderNumber, AccountId, Account.Name, TotalAmount
        FROM Order 
        WHERE Id = '${returnOrder.OrderId}'
        LIMIT 1
      `;

      const orderResult = await this.conn.query(orderQuery);
      
      if (orderResult.records.length === 0) {
        throw new Error(`Order ${returnOrder.OrderId} not found`);
      }

      const order = orderResult.records[0] as any;

      // Build description with line item details
      let caseDescription = `Case created for return order ${returnOrder.ReturnOrderNumber}.\n\n`;
      caseDescription += `Order: ${order.OrderNumber}\n`;
      caseDescription += `Return Status: ${returnOrder.Status}\n`;
      
      if (returnOrder.Description) {
        caseDescription += `Return Description: ${returnOrder.Description}\n`;
      }

      if (returnOrder.ReturnOrderLineItems && returnOrder.ReturnOrderLineItems.records.length > 0) {
        caseDescription += `\nReturning Items:\n`;
        returnOrder.ReturnOrderLineItems.records.forEach((lineItem: any, index: number) => {
          caseDescription += `${index + 1}. ${lineItem.Product2?.Name || 'Unknown Product'} (Qty: ${lineItem.QuantityReturned}) - Reason: ${lineItem.ReasonCode}\n`;
        });
      }

      // Determine priority based on return reason
      const hasDefectiveItems = returnOrder.ReturnOrderLineItems?.records?.some((item: any) => 
        ['Defective', 'Damaged', 'Quality Issue'].includes(item.ReasonCode)
      );
      const priority = hasDefectiveItems ? 'High' : 'Medium';

      // Create case
      const caseRecord = {
        Subject: `Return Order Issue - ${returnOrder.ReturnOrderNumber}`,
        Description: caseDescription,
        Status: 'New',
        Priority: priority,
        Origin: 'Web',
        Type: 'Other',
        AccountId: order.AccountId
      };

      const caseResult = await this.conn.sobject('Case').create(caseRecord);
      
      if (!caseResult.success) {
        throw new Error(`Failed to create case: ${caseResult.errors?.[0]?.message || 'Unknown error'}`);
      }

      // Update return order with case ID (standard field)
      try {
        await this.conn.sobject('ReturnOrder').update({
          Id: returnOrderId,
          CaseId: caseResult.id
        });
      } catch (customFieldError) {
        // If standard field doesn't exist, just log and continue
        console.warn('Standard CaseId field not found on ReturnOrder. Case created but link not established:', customFieldError);
      }

      // Send Slack alert for new case
      if (this.config.slackWebhookUrl) {
        const lineItemSummary = returnOrder.ReturnOrderLineItems?.records?.map((item: any) => 
          `${item.Product2?.Name || 'Unknown'} (${item.QuantityReturned})`
        ).join(', ') || 'No items';

        await this.sendSlackAlert({
          message: `New case created for return order ${returnOrder.ReturnOrderNumber}`,
          priority: hasDefectiveItems ? 'warning' : 'info',
          caseId: caseResult.id,
          customFields: {
            returnOrderId,
            returnOrderNumber: returnOrder.ReturnOrderNumber,
            orderNumber: order.OrderNumber,
            customerName: order.Account.Name,
            returnStatus: returnOrder.Status,
            items: lineItemSummary,
            priority: priority
          }
        });
      }

      return caseResult.id;
    } catch (error) {
      throw new Error(`Failed to create case from return order: ${error}`);
    }
  }

  async sendSlackAlert(alert: SlackAlert): Promise<boolean> {
    try {
      // Input validation
      if (!alert.message || typeof alert.message !== 'string') {
        throw new Error('Alert message is required and must be a string');
      }

      if (alert.message.length > 4000) {
        throw new Error('Alert message is too long. Maximum length is 4000 characters.');
      }

      if (!this.config.slackWebhookUrl) {
        throw new Error('Slack webhook URL not configured. Please set SLACK_WEBHOOK_URL environment variable.');
      }

      // Validate webhook URL format
      if (!this.config.slackWebhookUrl.startsWith('https://hooks.slack.com/services/')) {
        throw new Error('Invalid Slack webhook URL format. Must start with https://hooks.slack.com/services/');
      }

      const channel = alert.channel || this.config.slackDefaultChannel || '#general';

      // Validate channel format if provided
      if (alert.channel && !alert.channel.startsWith('#') && !alert.channel.startsWith('@')) {
        throw new Error('Channel must start with # for public channels or @ for direct messages');
      }
      
      // Build Slack message payload
      const payload = {
        channel,
        text: alert.message,
        username: 'Salesforce Order Concierge',
        icon_emoji: this.getSlackIconByPriority(alert.priority),
        attachments: [
          {
            color: this.getSlackColorByPriority(alert.priority),
            fields: [
              {
                title: 'Priority',
                value: alert.priority.toUpperCase(),
                short: true
              },
              {
                title: 'Timestamp',
                value: new Date().toISOString(),
                short: true
              }
            ]
          }
        ]
      };

      // Add case ID if provided
      if (alert.caseId) {
        payload.attachments[0].fields.push({
          title: 'Case ID',
          value: alert.caseId,
          short: true
        });
      }

      // Add custom fields if provided
      if (alert.customFields) {
        for (const [key, value] of Object.entries(alert.customFields)) {
          payload.attachments[0].fields.push({
            title: key.charAt(0).toUpperCase() + key.slice(1),
            value: String(value),
            short: true
          });
        }
      }

      // Send to Slack with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(this.config.slackWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
      }

      return true;
    } catch (error) {
      // Log error but don't throw - Slack alerts are non-critical
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Slack alert timed out after 10 seconds');
      } else {
        console.error(`Failed to send Slack alert: ${error}`);
      }
      return false;
    }
  }

  private isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
    // Define valid status transitions
    const validTransitions: { [key: string]: string[] } = {
      'New': ['Working', 'Escalated', 'Closed'],
      'Working': ['Escalated', 'Closed'],
      'Escalated': ['Working', 'Closed'],
      'Closed': [] // Closed cases cannot be transitioned to other statuses
    };

    const allowedTransitions = validTransitions[currentStatus] || [];
    return allowedTransitions.includes(newStatus);
  }

  private getSlackIconByPriority(priority: string): string {
    switch (priority) {
      case 'critical': return ':rotating_light:';
      case 'error': return ':x:';
      case 'warning': return ':warning:';
      case 'info': 
      default: return ':information_source:';
    }
  }

  private getSlackColorByPriority(priority: string): string {
    switch (priority) {
      case 'critical': return '#ff0000';
      case 'error': return '#ff6600';
      case 'warning': return '#ffcc00';
      case 'info': 
      default: return '#36a64f';
    }
  }
}