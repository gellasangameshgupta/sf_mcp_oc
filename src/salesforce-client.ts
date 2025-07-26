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
      // Basic Auth (username, password, security token)
      if (!this.config.username || !this.config.password || !this.config.securityToken) {
        throw new Error('Salesforce credentials (username, password, securityToken) are required');
      }
      
      console.log('🔐 Authenticating with Salesforce using username/password...');
      console.log('Login URL:', this.config.loginUrl);
      console.log('Username:', this.config.username);
      
      this.conn = new jsforce.Connection({
        loginUrl: this.config.loginUrl
      });
      
      await this.conn.login(
        this.config.username,
        this.config.password + this.config.securityToken
      );
      
      // Test the connection with a simple query
      try {
        await this.conn.query("SELECT Id FROM User LIMIT 1");
        console.log('✅ Salesforce connection established and verified');
      } catch (testError) {
        console.error('❌ Connection test failed:', testError);
        throw new Error(`Connection established but test query failed: ${testError}`);
      }
    } catch (error) {
      console.error('❌ Salesforce connection failed:', error);
      throw error;
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

      // Launch auto-launched flow to send email
      const flowInputs = {
        returnOrderId: returnOrderId,
        customerEmail: customerEmail,
        returnOrderNumber: returnOrder.ReturnOrderNumber,
        returnStatus: returnOrder.Status,
        returnDescription: returnOrder.Description || 'N/A'
      };

      const request = {
        url: `/services/data/v54.0/actions/custom/flow/Send_Return_Label_Email`,
        method: 'POST',
        body: JSON.stringify({
          inputs: [
            {
              returnOrderId: flowInputs.returnOrderId,
              customerEmail: flowInputs.customerEmail,
              returnOrderNumber: flowInputs.returnOrderNumber,
              returnStatus: flowInputs.returnStatus,
              returnDescription: flowInputs.returnDescription
            }
          ]
        }),
        headers: { "Content-Type": "application/json" }
      };
      
      const flowResponse = await this.conn.request(request as any) as any[];
      console.log('Flow execution response:', flowResponse);
      
      if (!flowResponse[0]?.isSuccess) {
        throw new Error(`Flow execution failed: ${flowResponse[0]?.errors?.[0]?.message || 'Unknown error'}`);
      }
      
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
    
    // Validate webhook URL format - must be a Slack webhook URL
    if (!this.config.slackWebhookUrl.startsWith('https://hooks.slack.com/')) {
      throw new Error('Invalid Slack webhook URL format. Must be a valid Slack webhook URL starting with https://hooks.slack.com/');
    }
    
    // Build simple Slack message payload as per webhook documentation
    let messageText = `${this.getSlackIconByPriority(alert.priority)} ${alert.message}`;
    
    // Add priority information
    messageText += `\n*Priority:* ${alert.priority.toUpperCase()}`;
    
    // Add timestamp
    messageText += `\n*Time:* ${new Date().toISOString()}`;
    
    // Add case ID if provided
    if (alert.caseId) {
      messageText += `\n*Case ID:* ${alert.caseId}`;
    }
    
    // Add custom fields if provided
    if (alert.customFields) {
      for (const [key, value] of Object.entries(alert.customFields)) {
        const fieldName = key.charAt(0).toUpperCase() + key.slice(1);
        messageText += `\n*${fieldName}:* ${String(value)}`;
      }
    }
    
    const payload = {
      text: messageText
    };
    
    // Check if fetch is available
    if (typeof fetch === 'undefined') {
      throw new Error('fetch is not available in this environment. Consider using node-fetch or a similar polyfill.');
    }
    
    // Send to Slack with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    console.log('Sending Slack alert to:', this.config.slackWebhookUrl?.substring(0, 30) + '...');
    console.log('Payload size:', JSON.stringify(payload).length, 'characters');
    
    const response = await fetch(this.config.slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log('Slack response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const responseText = await response.text().catch(() => 'Unable to read response body');
      
      // Handle specific Slack webhook errors
      if (response.status === 400) {
        throw new Error(`Slack webhook error: Invalid payload. ${responseText}`);
      } else if (response.status === 404) {
        throw new Error(`Slack webhook error: Webhook URL not found. Check your webhook URL configuration.`);
      } else if (response.status === 403) {
        throw new Error(`Slack webhook error: Forbidden. The webhook may be disabled or invalid.`);
      } else if (response.status >= 500) {
        throw new Error(`Slack server error: ${response.status} ${response.statusText}. Try again later.`);
      } else {
        throw new Error(`Slack API error: ${response.status} ${response.statusText}. Response: ${responseText}`);
      }
    }
    
    return true;
  } catch (error) {
    // Enhanced error logging for debugging
    console.error('=== Slack Alert Failure Debug Info ===');
    console.error('Webhook URL configured:', !!this.config.slackWebhookUrl);
    console.error('Webhook URL format:', this.config.slackWebhookUrl?.substring(0, 30) + '...');
    console.error('Alert message:', alert.message?.substring(0, 100));
    console.error('Alert priority:', alert.priority);
    
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Slack alert timed out after 10 seconds');
    } else if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('Unknown error:', error);
    }
    console.error('=== End Debug Info ===');
    
    // Still return false to not break the main flow
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