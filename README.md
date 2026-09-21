# Fichas & Pedidos

App multi-merchant com dois módulos independentes:

- **Fichas**: saldo pré-carregado para consumo no balcão (churrasquinho/cerveja). Débito feito pelo staff via código temporário.
- **Pedidos**: encomendas (ex: picanha) pagas antecipadamente via Pix/cartão. Pedido só é liberado após confirmação de pagamento; retirada validada por código temporário.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth)
- Asaas (Pix/cartão) — integração de pagamento

## Setup local

```bash
cp .env.example .env.local
# preencha NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

## Roadmap

1. ✅ Setup do projeto Next.js + Supabase
2. Schema completo do banco (merchants, staff, customers, wallets, wallet_transactions, order_items_catalog, orders, order_lines)
3. Autenticação: cliente, staff, admin
4. Módulo Fichas: saldo, código temporário de débito, tela do staff (crédito manual de saldo, sem Pix)
5. Integração de pagamento real (Asaas/Pix)
6. Módulo Pedidos: catálogo, montagem de pedido, pagamento obrigatório, código de retirada, painel do staff
7. Teste end-to-end dos dois módulos juntos
8. Multi-merchant real, PWA instalável
