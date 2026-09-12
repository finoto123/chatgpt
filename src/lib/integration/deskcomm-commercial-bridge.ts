/**
 * Fronteira entre o módulo comercial e o domínio operacional Selma.
 *
 * O módulo comercial só recebe este contrato. A implementação concreta fica no
 * lado operacional e aplica autenticação, autorização, auditoria e idempotência.
 */

export interface FindOrCreateSelmaCustomerInput {
  organizationId: string
  deskcommContactId: string
  name: string
  email?: string | null
  phone?: string | null
}
export interface SelmaCustomerReference {
  customerId: string
  contactId: string | null
}

export interface CreateSelmaQuoteInput {
  organizationId: string
  deskcommLeadId: string
  deskcommContactId: string
  selmaCustomerId: string
  requestedByUserId: string
}

export interface SelmaQuoteReference {
  quoteId: string
  quoteNumber: string
  status: string
  publicProposalUrl: string | null
}

export interface SelmaOrderSummary {
  orderId: string
  number: string
  status: string
  value: number | null
  deadline: string | null
}

export interface SelmaOperationalGateway {
  findOrCreateCustomer(input: FindOrCreateSelmaCustomerInput): Promise<SelmaCustomerReference>
  createQuote(input: CreateSelmaQuoteInput): Promise<SelmaQuoteReference>
  getQuote(organizationId: string, quoteId: string): Promise<SelmaQuoteReference | null>
  getOrders(organizationId: string, deskcommContactId: string): Promise<SelmaOrderSummary[]>
  getOrderStatus(organizationId: string, orderId: string): Promise<SelmaOrderSummary | null>
}

export class DeskcommCommercialBridge {
  constructor(private readonly gateway: SelmaOperationalGateway) {}

  findOrCreateSelmaCustomer(input: FindOrCreateSelmaCustomerInput) {
    return this.gateway.findOrCreateCustomer(input)
  }

  createSelmaQuote(input: CreateSelmaQuoteInput) {
    return this.gateway.createQuote(input)
  }

  getSelmaQuote(organizationId: string, quoteId: string) {
    return this.gateway.getQuote(organizationId, quoteId)
  }

  getSelmaOrders(organizationId: string, deskcommContactId: string) {
    return this.gateway.getOrders(organizationId, deskcommContactId)
  }

  getSelmaOrderStatus(organizationId: string, orderId: string) {
    return this.gateway.getOrderStatus(organizationId, orderId)
  }
}
