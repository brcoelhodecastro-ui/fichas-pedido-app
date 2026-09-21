"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { criarCobrancaPixParaPedido } from "@/lib/pagamentos/criar-cobranca-pedido";

type CatalogItem = { id: string; nome: string; preco_reais: number };

export async function criarPedido(formData: FormData) {
  const actor = await requireRole("customer");

  const merchantId = String(formData.get("merchant_id") ?? "");
  const cpfCnpj = String(formData.get("cpf_cnpj") ?? "").replace(/\D/g, "");

  if (!merchantId) {
    redirect("/cliente/pedidos/novo?erro=Estabelecimento inválido");
  }
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
    redirect(`/cliente/pedidos/novo?merchant=${merchantId}&erro=CPF/CNPJ inválido`);
  }

  const supabase = await createClient();

  const { data: catalogo } = await supabase
    .from("order_items_catalog")
    .select("id, nome, preco_reais")
    .eq("merchant_id", merchantId)
    .returns<CatalogItem[]>();

  if (!catalogo || catalogo.length === 0) {
    redirect(`/cliente/pedidos/novo?merchant=${merchantId}&erro=Catálogo vazio`);
  }

  const linhas = catalogo
    .map((item) => ({
      item,
      quantidade: Number(formData.get(`qty_${item.id}`) ?? 0),
    }))
    .filter((linha) => Number.isFinite(linha.quantidade) && linha.quantidade > 0);

  if (linhas.length === 0) {
    redirect(`/cliente/pedidos/novo?merchant=${merchantId}&erro=Escolha ao menos um item`);
  }

  const totalReais = linhas.reduce(
    (soma, linha) => soma + linha.quantidade * Number(linha.item.preco_reais),
    0,
  );

  const { data: customer } = await supabase
    .from("customers")
    .select("login, cpf_cnpj")
    .eq("id", actor.customerId)
    .single<{ login: string | null; cpf_cnpj: string | null }>();

  if (customer && customer.cpf_cnpj !== cpfCnpj) {
    await supabase.from("customers").update({ cpf_cnpj: cpfCnpj }).eq("id", actor.customerId);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({ merchant_id: merchantId, customer_id: actor.customerId, total_reais: totalReais })
    .select("id")
    .single<{ id: string }>();

  if (orderError || !order) {
    redirect(`/cliente/pedidos/novo?merchant=${merchantId}&erro=Não foi possível criar o pedido`);
  }

  const { error: linesError } = await supabase.from("order_lines").insert(
    linhas.map((linha) => ({
      order_id: order.id,
      catalog_item_id: linha.item.id,
      quantidade: linha.quantidade,
      preco_unitario: linha.item.preco_reais,
    })),
  );

  if (linesError) {
    redirect(`/cliente/pedidos/${order.id}?erro=${encodeURIComponent(linesError.message)}`);
  }

  try {
    await criarCobrancaPixParaPedido({
      orderId: order.id,
      customerId: actor.customerId,
      valorReais: totalReais,
      clienteNome: customer?.login ?? "Cliente",
      clienteCpfCnpj: cpfCnpj,
    });
  } catch (e) {
    redirect(`/cliente/pedidos/${order.id}?erro=${encodeURIComponent((e as Error).message)}`);
  }

  redirect(`/cliente/pedidos/${order.id}`);
}
