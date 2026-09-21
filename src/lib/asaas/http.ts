// Sem "server-only" aqui de propósito: essa é a lógica pura de chamada da
// API do Asaas, testável fora do Next.js. O boundary de "só roda no
// servidor" fica em client.ts, que é o que o resto do app importa.

const BASE_URL =
  process.env.ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada");

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...init?.headers,
    },
  });

  const body = await res.json();

  if (!res.ok) {
    const message = body?.errors?.[0]?.description ?? `Erro Asaas (${res.status})`;
    throw new Error(message);
  }

  return body as T;
}

export type AsaasCustomer = {
  id: string;
  name: string;
  email?: string;
  cpfCnpj: string;
};

export function createCustomer(input: {
  name: string;
  cpfCnpj: string;
  email?: string;
}): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type AsaasPayment = {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  externalReference?: string;
};

export function createPixPayment(input: {
  customer: string;
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
}): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify({ ...input, billingType: "PIX" }),
  });
}

export type AsaasPixQrCode = {
  encodedImage: string;
  payload: string;
  expirationDate: string;
};

export function getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasFetch<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`);
}
