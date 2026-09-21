// Lógica pura (sem I/O) de como reagir a um evento de webhook do Asaas.
// Fica separada do route handler pra poder testar as regras de negócio
// sem precisar de rede nem de um Supabase real.

export type PaymentOutcome = {
  payment_status: "pago" | "estornado";
  releaseOrder: boolean;
};

export function mapAsaasEventToOutcome(event: string): PaymentOutcome | null {
  switch (event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      return { payment_status: "pago", releaseOrder: true };
    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED":
      return { payment_status: "estornado", releaseOrder: false };
    default:
      return null;
  }
}

export type OrderPaymentState = {
  status: string;
  payment_status: string;
  paid_at: string | null;
};

/**
 * Decide o novo estado do pedido a partir do evento. Retorna null se não
 * há nada a fazer (evento já processado antes — idempotente, importante
 * porque o Asaas pode reentregar o mesmo webhook mais de uma vez).
 */
export function decideOrderUpdate(
  order: OrderPaymentState,
  outcome: PaymentOutcome,
  now: () => string = () => new Date().toISOString(),
): OrderPaymentState | null {
  if (order.payment_status === outcome.payment_status) return null;

  return {
    payment_status: outcome.payment_status,
    paid_at: outcome.releaseOrder ? now() : order.paid_at,
    status:
      outcome.releaseOrder && order.status === "aguardando_pagamento"
        ? "recebido"
        : order.status,
  };
}
