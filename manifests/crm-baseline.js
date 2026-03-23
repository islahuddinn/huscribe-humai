// CRM Baseline Manifest - 15 Core Modules
// This defines the standard data model imported into every new Corteza namespace

export const crmBaselineManifest = {
  namespace: {
    name: "Huscribe CRM",
    slug: "huscribe-crm", 
    enabled: true,
    meta: {
      description: "Complete CRM solution powered by Corteza",
      version: "1.0.0"
    }
  },
  
  modules: [
    {
      name: "Lead",
      handle: "lead",
      fields: [
        { name: "Name", handle: "name", kind: "String", required: true },
        { name: "Email", handle: "email", kind: "Email", required: true, unique: true },
        { name: "Phone", handle: "phone", kind: "String" },
        { name: "Status", handle: "status", kind: "Select", 
          options: [
            { value: "new", text: "New" },
            { value: "contacted", text: "Contacted" },
            { value: "qualified", text: "Qualified" },
            { value: "converted", text: "Converted" },
            { value: "lost", text: "Lost" }
          ]
        },
        { name: "Score", handle: "score", kind: "Number" },
        { name: "Company", handle: "company", kind: "String" },
        { name: "Notes", handle: "notes", kind: "String", isMultiLine: true }
      ]
    },
    
    {
      name: "Contact", 
      handle: "contact",
      fields: [
        { name: "First Name", handle: "firstName", kind: "String", required: true },
        { name: "Last Name", handle: "lastName", kind: "String", required: true },
        { name: "Email", handle: "email", kind: "Email", required: true, unique: true },
        { name: "Phone", handle: "phone", kind: "String" },
        { name: "Role", handle: "role", kind: "String" },
        { name: "Notes", handle: "notes", kind: "String", isMultiLine: true }
      ]
    },
    
    {
      name: "Account",
      handle: "account", 
      fields: [
        { name: "Name", handle: "name", kind: "String", required: true },
        { name: "Industry", handle: "industry", kind: "String" },
        { name: "Website", handle: "website", kind: "Url" },
        { name: "Phone", handle: "phone", kind: "String" },
        { name: "Description", handle: "description", kind: "String", isMultiLine: true }
      ]
    },
    
    {
      name: "Opportunity",
      handle: "opportunity",
      fields: [
        { name: "Name", handle: "name", kind: "String", required: true },
        { name: "Stage", handle: "stage", kind: "Select", required: true,
          options: [
            { value: "prospecting", text: "Prospecting" },
            { value: "qualification", text: "Qualification" },
            { value: "proposal", text: "Proposal" },
            { value: "negotiation", text: "Negotiation" },
            { value: "won", text: "Won" },
            { value: "lost", text: "Lost" }
          ]
        },
        { name: "Amount", handle: "amount", kind: "Number", precision: 2 },
        { name: "Close Date", handle: "closeDate", kind: "DateTime", required: true }
      ]
    },
    
    {
      name: "Task", 
      handle: "task", 
      fields: [
        { name: "Subject", handle: "subject", kind: "String", required: true },
        { name: "Status", handle: "status", kind: "Select",
          options: [
            { value: "not_started", text: "Not Started" },
            { value: "in_progress", text: "In Progress" },
            { value: "completed", text: "Completed" },
            { value: "cancelled", text: "Cancelled" }
          ]
        },
        { name: "Priority", handle: "priority", kind: "Select",
          options: [
            { value: "low", text: "Low" },
            { value: "medium", text: "Medium" },
            { value: "high", text: "High" },
            { value: "urgent", text: "Urgent" }
          ]
        },
        { name: "Due Date", handle: "dueDate", kind: "DateTime" },
        { name: "Description", handle: "description", kind: "String", isMultiLine: true }
      ]
    },
    
    {
      name: "Event", 
      handle: "event", 
      fields: [
        { name: "Title", handle: "title", kind: "String", required: true },
        { name: "Start", handle: "start", kind: "DateTime", required: true },
        { name: "End", handle: "end", kind: "DateTime" },
        { name: "Location", handle: "location", kind: "String" },
        { name: "Description", handle: "description", kind: "String", isMultiLine: true }
      ]
    },
    
    {
      name: "Call", 
      handle: "call", 
      fields: [
        { name: "Direction", handle: "direction", kind: "Select",
          options: [
            { value: "inbound", text: "Inbound" },
            { value: "outbound", text: "Outbound" }
          ]
        },
        { name: "Duration", handle: "duration", kind: "Number" },
        { name: "Notes", handle: "notes", kind: "String", isMultiLine: true }
      ]
    },
    
    {
      name: "Email", 
      handle: "email", 
      fields: [
        { name: "Subject", handle: "subject", kind: "String", required: true },
        { name: "Body", handle: "body", kind: "String", isMultiLine: true },
        { name: "From", handle: "from", kind: "Email", required: true },
        { name: "To", handle: "to", kind: "Email", required: true },
        { name: "Sent Date", handle: "sentDate", kind: "DateTime" }
      ]
    },
    
    {
      name: "Note", 
      handle: "note", 
      fields: [  
        { name: "Title", handle: "title", kind: "String" },
        { name: "Body", handle: "body", kind: "String", isMultiLine: true, required: true },
        { name: "Category", handle: "category", kind: "String" }
      ]
    },
    
    {
      name: "Quote", 
      handle: "quote", 
      fields: [
        { name: "Quote Number", handle: "quoteNumber", kind: "String", required: true, unique: true },
        { name: "Total", handle: "total", kind: "Number", precision: 2 },
        { name: "Status", handle: "status", kind: "Select",
          options: [
            { value: "draft", text: "Draft" },
            { value: "sent", text: "Sent" },
            { value: "accepted", text: "Accepted" },
            { value: "declined", text: "Declined" }
          ]
        },
        { name: "Valid Until", handle: "validUntil", kind: "DateTime" }
      ]
    },
    
    {
      name: "Order", 
      handle: "order", 
      fields: [
        { name: "Order Number", handle: "orderNumber", kind: "String", required: true, unique: true },
        { name: "Total", handle: "total", kind: "Number", precision: 2 },
        { name: "Status", handle: "status", kind: "Select",
          options: [
            { value: "pending", text: "Pending" },
            { value: "processing", text: "Processing" },
            { value: "shipped", text: "Shipped" },
            { value: "delivered", text: "Delivered" },
            { value: "cancelled", text: "Cancelled" }
          ]
        },
        { name: "Order Date", handle: "orderDate", kind: "DateTime", required: true }
      ]
    },
    
    {
      name: "Case", 
      handle: "case", 
      fields: [
        { name: "Case Number", handle: "caseNumber", kind: "String", required: true, unique: true },
        { name: "Subject", handle: "subject", kind: "String", required: true },
        { name: "Priority", handle: "priority", kind: "Select",
          options: [
            { value: "low", text: "Low" },
            { value: "medium", text: "Medium" },
            { value: "high", text: "High" },
            { value: "critical", text: "Critical" }
          ]
        },
        { name: "Status", handle: "status", kind: "Select",
          options: [
            { value: "new", text: "New" },
            { value: "working", text: "Working" },
            { value: "escalated", text: "Escalated" },
            { value: "closed", text: "Closed" }
          ]
        },
        { name: "Description", handle: "description", kind: "String", isMultiLine: true }
      ]
    },
    
    {
      name: "Campaign", 
      handle: "campaign", 
      fields: [
        { name: "Name", handle: "name", kind: "String", required: true },
        { name: "Budget", handle: "budget", kind: "Number", precision: 2 },
        { name: "Start Date", handle: "startDate", kind: "DateTime" },
        { name: "End Date", handle: "endDate", kind: "DateTime" },
        { name: "Status", handle: "status", kind: "Select",
          options: [
            { value: "planning", text: "Planning" },
            { value: "active", text: "Active" },
            { value: "paused", text: "Paused" },
            { value: "completed", text: "Completed" }
          ]
        }
      ]
    },
    
    {
      name: "Product", 
      handle: "product", 
      fields: [
        { name: "SKU", handle: "sku", kind: "String", required: true, unique: true },
        { name: "Name", handle: "name", kind: "String", required: true },
        { name: "Price", handle: "price", kind: "Number", precision: 2 },
        { name: "Category", handle: "category", kind: "String" },
        { name: "Active", handle: "active", kind: "Bool" },
        { name: "Description", handle: "description", kind: "String", isMultiLine: true }
      ]
    },
    
    {
      name: "Goal", 
      handle: "goal", 
      fields: [
        { name: "Goal Name", handle: "goalName", kind: "String", required: true },
        { name: "Target Value", handle: "targetValue", kind: "Number", precision: 2 },
        { name: "Current Value", handle: "currentValue", kind: "Number", precision: 2 },
        { name: "Period", handle: "period", kind: "Select",
          options: [
            { value: "monthly", text: "Monthly" },
            { value: "quarterly", text: "Quarterly" },
            { value: "yearly", text: "Yearly" }
          ]
        },
        { name: "Due Date", handle: "dueDate", kind: "DateTime" }
      ]
    }
  ],
  
  workflows: [
    {
      name: "OnOpportunityWon",
      handle: "onOpportunityWon",
      trigger: {
        eventType: "onUpdate",
        resourceType: "compose:record",
        resource: "opportunity"
      },
      steps: [
        {
          type: "condition",
          ref: "checkStage",
          expr: "stage == 'won'"
        }
      ]
    },
    
    {
      name: "LeadConversion",
      handle: "leadConversion",
      trigger: {
        eventType: "onUpdate",
        resourceType: "compose:record",
        resource: "lead"
      },
      steps: [
        {
          type: "condition", 
          ref: "checkConversion",
          expr: "status == 'converted'"
        }
      ]
    }
  ],
  
  roles: [
    { 
      name: "Owner", 
      handle: "owner", 
      permissions: ["read", "update", "create", "delete", "manage"] 
    },
    { 
      name: "Manager", 
      handle: "manager", 
      permissions: ["read", "update", "create", "delete"] 
    },
    { 
      name: "Rep", 
      handle: "rep", 
      permissions: ["read", "update", "create"] 
    },
    { 
      name: "ReadOnly", 
      handle: "readonly", 
      permissions: ["read"] 
    }
  ],
  
  pages: [
    {
      name: "Dashboard",
      handle: "dashboard",
      visible: true,
      blocks: [
        {
          kind: "Chart",
          title: "Opportunities by Stage",
          options: {
            module: "opportunity",
            groupBy: "stage"
          }
        },
        {
          kind: "Chart", 
          title: "Leads by Status",
          options: {
            module: "lead",
            groupBy: "status"
          }
        }
      ]
    },
    
    {
      name: "Pipeline",
      handle: "pipeline", 
      visible: true,
      blocks: [
        {
          kind: "RecordList",
          title: "Active Opportunities",
          options: {
            module: "opportunity",
            filter: "stage NOT IN ('won', 'lost')"
          }
        }
      ]
    }
  ]
}; 