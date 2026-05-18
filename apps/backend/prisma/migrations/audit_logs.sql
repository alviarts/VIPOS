-- Audit Log Table
-- Stores all critical actions for security and compliance

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    -- Action info
    action TEXT NOT NULL,
    
    -- User info
    user_id TEXT NOT NULL,
    
    -- Resource info
    resource_type TEXT,
    resource_id TEXT,
    
    -- Change tracking
    details TEXT, -- JSON
    before TEXT, -- JSON (state before change)
    after TEXT, -- JSON (state after change)
    
    -- Request info
    ip_address TEXT,
    user_agent TEXT,
    
    -- Timestamp
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for fast queries
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Prevent deletion of audit logs (tamper-proof)
CREATE TRIGGER IF NOT EXISTS prevent_audit_log_delete
BEFORE DELETE ON audit_logs
BEGIN
    SELECT RAISE(ABORT, 'Audit logs cannot be deleted');
END;

-- Prevent update of audit logs (tamper-proof)
CREATE TRIGGER IF NOT EXISTS prevent_audit_log_update
BEFORE UPDATE ON audit_logs
BEGIN
    SELECT RAISE(ABORT, 'Audit logs cannot be modified');
END;
