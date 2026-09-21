const LABELS: Record<string, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  recebido: "Recebido pela cozinha",
  preparando: "Preparando",
  pronto: "Pronto pra retirada",
  retirado: "Retirado",
  cancelado: "Cancelado",
};

export function statusLabel(status: string): string {
  return LABELS[status] ?? status;
}
