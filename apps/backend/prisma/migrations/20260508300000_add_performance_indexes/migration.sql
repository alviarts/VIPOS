-- Performance indexes for frequently queried columns (P4 optimization)
-- These indexes improve query performance for transaction history, online orders,
-- and dashboard queries.

-- Transactions table indexes
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier_shift_id ON transactions(cashier_shift_id);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_number ON transactions(invoice_number);

-- Online orders table indexes
CREATE INDEX IF NOT EXISTS idx_online_orders_created_at ON online_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_online_orders_status ON online_orders(status);
CREATE INDEX IF NOT EXISTS idx_online_orders_channel ON online_orders(channel);
CREATE INDEX IF NOT EXISTS idx_online_orders_ref_no ON online_orders(ref_no);

-- Products table indexes (for search and filtering)
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- Customers table indexes
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- Cashier shifts table indexes
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_user_id ON cashier_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_status ON cashier_shifts(status);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_opened_at ON cashier_shifts(opened_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_created ON transactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_status ON transactions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_online_orders_tenant_created ON online_orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_online_orders_tenant_status ON online_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_products_tenant_active ON products(tenant_id, is_active);
