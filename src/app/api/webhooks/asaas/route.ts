import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapAsaasEventToOutcome, decideOrderUpdate } from "@/lib/asaas/webhook";

export async function POST(request: Request) {
  const token = request.headers.get("asaas-access-token");
  if (!process.env.ASAAS_WEBHOOK_TOKEN || token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const outcome = mapAsaasEventToOutcome(body.event);
  if (!outcome) {
    return NextResponse.json({ ok: true, ignorado: true });
  }

  const paymentId: string | undefined = body.payment?.id;
  if (!paymentId) {
    return NextResponse.json({ error: "payment.id ausente" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: order, error: fetchError } = await admin
    .from("orders")
    .select("id, status, payment_status, paid_at")
    .eq("asaas_payment_id", paymentId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!order) {
    // pode ser corrida (webhook chegou antes de anexarmos o
    // asaas_payment_id) — devolve 404 pra o Asaas reentregar depois.
    return NextResponse.json({ error: "pedido não encontrado" }, { status: 404 });
  }

  const update = decideOrderUpdate(order, outcome);
  if (!update) {
    return NextResponse.json({ ok: true, jaProcessado: true });
  }

  const { error: updateError } = await admin
    .from("orders")
    .update(update)
    .eq("id", order.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
