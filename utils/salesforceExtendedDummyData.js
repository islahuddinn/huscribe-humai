/**
 * Dummy data for Salesforce Extended Objects
 * This file contains sample data for testing the extended Salesforce objects in Postman
 * Each object includes comments indicating required and optional fields
 */

export const dummyData = {
  // Territory/Region
  territory: {
    // Required Fields
    "Name": "North America", // Required: Name of the territory
    
    // Optional Fields
    "City": "New York", // Optional: City of the territory
    "State": "NY", // Optional: State of the territory
    "Country": "USA", // Optional: Country of the territory
    "Description": "North American territory" // Optional: Description of the territory
  },

  // Invoice
  invoice: {
    // Required Fields
    "Name": "INV-2024-001", // Required: Invoice name/number
    "Status": "Draft", // Required: Status of the invoice (Draft, Posted, Canceled)
    "InvoiceDate": "2024-03-20", // Required: Date when invoice was created
    "DueDate": "2024-04-20", // Required: Date when payment is due
    "TotalAmount": 1000.00, // Required: Total amount of the invoice
    
    // Optional Fields
    "Description": "Monthly service invoice" // Optional: Description of the invoice
  },

  // Pipeline/Forecast Item
  forecastItem: {
    // Required Fields
    "Name": "Q2 2024 Forecast", // Required: Name of the forecast item
    "ForecastCategory": "Pipeline", // Required: Category of the forecast (Pipeline, Best Case, etc.)
    "Amount": 5000.00, // Required: Amount of the forecast
    "ForecastDate": "2024-03-20", // Required: Date of the forecast
    
    // Optional Fields
    "ProductFamily": "Services", // Optional: Product family
    "Description": "Q2 forecast item" // Optional: Description
  },

  // Competitor
  competitor: {
    // Required Fields
    "Name": "Competitor Corp", // Required: Name of the competitor
    "Type": "Direct", // Required: Type of competitor (Direct, Indirect, etc.)
    
    // Optional Fields
    "Website": "www.competitor.com", // Optional: Competitor's website
    "Description": "Main competitor in the market", // Optional: Description
    "Strength": "Strong in enterprise segment", // Optional: Competitor's strengths
    "Weakness": "Limited product portfolio", // Optional: Competitor's weaknesses
    "MarketShare": "25%", // Optional: Market share
    "AnnualRevenue": 1000000.00 // Optional: Annual revenue
  },

  // Service Appointment
  serviceAppointment: {
    // Required Fields
    "ParentRecordId": "001000000000000", // Required: ID of the parent record (Account or Contact)
    "EarliestStartTime": "2024-03-20T09:00:00.000Z", // Required: Earliest possible start time
    "DueDate": "2024-03-20T10:00:00.000Z", // Required: Due date and time
    "Status": "Scheduled", // Required: Status of the appointment
    "Subject": "Annual Maintenance", // Required: Subject of the appointment
    
    // Optional Fields
    "Description": "Regular maintenance appointment", // Optional: Description
    "ServiceTerritoryId": "0XX000000000000", // Optional: ID of service territory
    "DurationInMinutes": 60, // Optional: Duration in minutes
    "Priority": "High", // Optional: Priority level
    "ServiceResourceId": "0XX000000000001" // Optional: ID of service resource
  },

  // Customer Asset
  customerAsset: {
    // Required Fields
    Name: "Product Serial #123", // Required: Name of the asset
    AccountId: "001000000000000", // Required: ID of the account
    Product2Id: "01t000000000000", // Required: ID of the product
    Status: "Installed", // Required: Status of the asset
    PurchaseDate: "2024-01-01", // Required: Date of purchase
    
    // Optional Fields
    InstallDate: "2024-01-02", // Optional: Installation date
    SerialNumber: "SN123456", // Optional: Serial number
    Description: "Enterprise license", // Optional: Description
    Quantity: 1, // Optional: Quantity
    Price: 1000.00, // Optional: Price
    UsageEndDate: "2025-01-01" // Optional: End date of usage
  },

  // Knowledge Article
  knowledgeArticle: {
    // Required Fields
    "Title": "How to Reset Password", // Required: Title of the article
    "Language": "en_US", // Required: Language code
    "PublishStatus": "Draft", // Required: Status (Draft, Online, Archived)
    "Summary": "Step by step guide to reset password", // Required: Summary
    "ArticleType": "HowTo", // Required: Type of article
    "Content": "Detailed content here...", // Required: Main content
    
    // Optional Fields
    "IsVisibleInPkb": true, // Optional: Visible in public knowledge base
    "IsVisibleInCsp": true, // Optional: Visible in customer service portal
    "IsVisibleInPrm": true, // Optional: Visible in partner relationship management
    "Keywords": "password, reset, account", // Optional: Keywords for search
    "VersionNumber": 1, // Optional: Version number
    "IsMasterLanguage": true // Optional: Whether this is the master language version
  },

  // Call Log
  callLog: {
    // Required Fields
    "Subject": "Follow-up call with client", // Required: Subject/title of the call
    "CallType": "Outbound", // Required: Type of call (Outbound, Inbound)
    "CallDurationInSeconds": 300, // Required: Duration of the call in seconds
    "CallDateTime": "2024-03-20T10:00:00.000Z", // Required: Date and time of the call
    "WhoId": "003000000000000", // Required: ID of the Contact or Lead the call was with
    "WhatId": "006000000000000", // Required: ID of the related record (Account, Opportunity, etc.)
    
    // Optional Fields
    "Description": "Discussed project timeline and next steps", // Optional: Detailed description of the call
    "CallDisposition": "Completed", // Optional: Outcome of the call (Completed, Busy, No Answer, etc.)
    "CallObject": "Phone", // Optional: Object used for the call (Phone, Mobile, etc.)
    "CallResult": "Positive", // Optional: Result of the call (Positive, Negative, Neutral)
    "Priority": "High", // Optional: Priority level of the call
    "Status": "Completed", // Optional: Status of the call
    "Location": "Office", // Optional: Location where the call was made
    "IsPrivate": false, // Optional: Whether the call details are private
    "ReminderDateTime": "2024-03-20T09:45:00.000Z" // Optional: Reminder time for the call
  },

  // Email Log
  emailLog: {
    // Required Fields
    "Subject": "Project Update - March 2024", // Required: Subject of the email
    "FromAddress": "sender@example.com", // Required: Sender's email address
    "ToAddress": "recipient@example.com", // Required: Recipient's email address
    "MessageDate": "2024-03-20T10:00:00.000Z", // Required: Date and time the email was sent
    "WhoId": "003000000000000", // Required: ID of the Contact or Lead the email was sent to
    "WhatId": "006000000000000", // Required: ID of the related record (Account, Opportunity, etc.)
    
    // Optional Fields
    "HtmlBody": "<p>Dear Client,</p><p>This is a test email body.</p>", // Optional: HTML content of the email
    "TextBody": "Dear Client,\n\nThis is a test email body.", // Optional: Plain text content of the email
    "CcAddress": "cc@example.com", // Optional: CC email addresses
    "BccAddress": "bcc@example.com", // Optional: BCC email addresses
    "Status": "Sent", // Optional: Status of the email (Sent, Failed, Draft)
    "Priority": "Normal", // Optional: Priority of the email
    "IsPrivate": false, // Optional: Whether the email details are private
    "HasAttachment": false, // Optional: Whether the email has attachments
    "EmailTemplateId": "00X000000000000", // Optional: ID of the email template used
    "RelatedToId": "006000000000000", // Optional: ID of the related record
    "InReplyToId": "00X000000000000", // Optional: ID of the email this is replying to
    "Headers": { // Optional: Email headers
      "Message-ID": "<123456789@example.com>",
      "References": "<987654321@example.com>",
      "In-Reply-To": "<987654321@example.com>"
    }
  }
};

/**
 * Example usage in Postman:
 * 
 * 1. Create a new territory:
 * POST /api/salesforce/extended/territories/create
 * Body: dummyData.territory
 * 
 * 2. Create a new invoice:
 * POST /api/salesforce/extended/invoices/create
 * Body: dummyData.invoice
 * 
 * 3. Create a new forecast item:
 * POST /api/salesforce/extended/forecast-items/create
 * Body: dummyData.forecastItem
 * 
 * 4. Create a new competitor:
 * POST /api/salesforce/extended/competitors/create
 * Body: dummyData.competitor
 * 
 * 5. Create a new service appointment:
 * POST /api/salesforce/extended/service-appointments/create
 * Body: dummyData.serviceAppointment
 * 
 * 6. Create a new customer asset:
 * POST /api/salesforce/extended/customer-assets/create
 * Body: dummyData.customerAsset
 * 
 * 7. Create a new knowledge article:
 * POST /api/salesforce/extended/knowledge-articles/create
 * Body: dummyData.knowledgeArticle
 * 
 * 8. Create a call log:
 * POST /api/salesforce/extended/activities/log-call
 * Body: dummyData.callLog
 * 
 * 9. Create an email log:
 * POST /api/salesforce/extended/activities/log-email
 * Body: dummyData.emailLog
 * 
 * Note: Replace the IDs (0XX000000000000, 001000000000000, etc.) with actual Salesforce IDs
 * from your org when testing.
 */ 