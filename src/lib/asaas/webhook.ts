import crypto from "node:crypto";

// Lógica pura (sem I/O de rede/DB) de como reagir a um evento de webhook do
// Asaas. Fica separada do route handler pra poder testar as regras de
// negócio sem precisar de rede nem de um Supabase real.

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

// Sem 0/O, 1/I/L — evita confusão na hora do cliente ler o código pro staff.
const PICKUP_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generatePickupCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += PICKUP_CODE_ALPHABET[crypto.randomInt(0, PICKUP_CODE_ALPHABET.length)];
  }
  return code;
}

export type OrderPaymentState = {
  status: string;
  payment_status: string;
  paid_at: string | null;
  pickup_code: string | null;
};

/**
 * Decide o novo estado do pedido a partir do evento. Retorna null se não
 * há nada a fazer (evento já processado antes — idempotente, importante
 * porque o Asaas pode reentregar o mesmo webhook mais de uma vez).
 *
 * Ao liberar o pedido (pagamento confirmado + ainda aguardando pagamento),
 * gera o código de retirada. Se o UPDATE falhar por colisão de código
 * (extremamente raro — ver índice único em orders.pickup_code), o handler
 * devolve erro e o próprio Asaas reentrega o webhook depois, gerando um
 * código novo na próxima tentativa.
 */
export function decideOrderUpdate(
  order: OrderPaymentState,
  outcome: PaymentOutcome,
  deps: { now?: () => string; generateCode?: () => string } = {},
): Partial<OrderPaymentState> | null {
  const now = deps.now ?? (() => new Date().toISOString());
  const generateCode = deps.generateCode ?? generatePickupCode;

  if (order.payment_status === outcome.payment_status) return null;

  const libera = outcome.releaseOrder && order.status === "aguardando_pagamento";

  return {
    payment_status: outcome.payment_status,
    paid_at: outcome.releaseOrder ? now() : order.paid_at,
    status: libera ? "recebido" : order.status,
    pickup_code: libera ? (order.pickup_code ?? generateCode()) : order.pickup_code,
  };
}
