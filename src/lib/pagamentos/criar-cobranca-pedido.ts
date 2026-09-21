import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCustomer, createPixPayment } from "@/lib/asaas/client";

/**
 * Cria a cobrança Pix no Asaas pro pedido e anexa o asaas_payment_id nele.
 * Chamado pelo fluxo de checkout do módulo Pedidos (etapa 6) logo depois
 * que o pedido é inserido (já nasce 'aguardando_pagamento' por causa do
 * trigger). Usa o client admin porque anexar asaas_payment_id é um campo
 * de pagamento — só o service role tem permissão de escrever nele
 * (ver migração 20260921030000_pagamento_asaas.sql).
 *
 * Não devolve o QR code: a página do pedido (`/cliente/pedidos/[id]`) busca
 * ele fresco no Asaas a cada carregamento, então não tem por que duplicar
 * a chamada aqui.
 */
export async function criarCobrancaPixParaPedido(input: {
  orderId: string;
  customerId: string;
  valorReais: number;
  clienteNome: string;
  clienteCpfCnpj: string;
  clienteEmail?: string;
}): Promise<void> {
  const admin = createAdminClient();

  const { data: customer, error: customerFetchError } = await admin
    .from("customers")
    .select("asaas_customer_id")
    .eq("id", input.customerId)
    .single<{ asaas_customer_id: string | null }>();

  if (customerFetchError) throw new Error(customerFetchError.message);

  let asaasCustomerId = customer.asaas_customer_id;

  if (!asaasCustomerId) {
    const asaasCustomer = await createCustomer({
      name: input.clienteNome,
      cpfCnpj: input.clienteCpfCnpj,
      email: input.clienteEmail,
    });
    asaasCustomerId = asaasCustomer.id;

    const { error: saveCustomerError } = await admin
      .from("customers")
      .update({ asaas_customer_id: asaasCustomerId })
      .eq("id", input.customerId);
    if (saveCustomerError) throw new Error(saveCustomerError.message);
  }

  const dueDate = new Date().toISOString().slice(0, 10);
  const payment = await createPixPayment({
    customer: asaasCustomerId,
    value: input.valorReais,
    dueDate,
    description: `Pedido ${input.orderId}`,
    externalReference: input.orderId,
  });

  const { error: attachError } = await admin
    .from("orders")
    .update({ asaas_payment_id: payment.id })
    .eq("id", input.orderId);
  if (attachError) throw new Error(attachError.message);
}
