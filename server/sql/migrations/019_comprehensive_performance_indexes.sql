-- Migration 019: Comprehensive performance indexes
-- Adds indexes for common query patterns across all tables
-- Focus: Foreign keys, filtering columns, temporal queries, and sorting

-- Users table
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users (email);

-- News table - filtering and sorting
CREATE INDEX IF NOT EXISTS idx_news_status
  ON news (status);

CREATE INDEX IF NOT EXISTS idx_news_published_at_desc
  ON news (published_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_status_published_at
  ON news (status, published_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_news_created_at_desc
  ON news (created_at DESC);

-- News media assets table - foreign keys and soft delete
CREATE INDEX IF NOT EXISTS idx_news_media_assets_created_by
  ON news_media_assets (created_by);

CREATE INDEX IF NOT EXISTS idx_news_media_assets_deleted_at
  ON news_media_assets (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- News media links table - foreign key optimization
CREATE INDEX IF NOT EXISTS idx_news_media_links_asset_id
  ON news_media_links (asset_id);

CREATE INDEX IF NOT EXISTS idx_news_media_links_news_id
  ON news_media_links (news_id);

-- Volunteers table - county filtering and CRM priority
CREATE INDEX IF NOT EXISTS idx_volunteers_county_id
  ON volunteers (county_id);

CREATE INDEX IF NOT EXISTS idx_volunteers_email
  ON volunteers (email);

CREATE INDEX IF NOT EXISTS idx_volunteers_crm_priority
  ON volunteers (crm_priority);

CREATE INDEX IF NOT EXISTS idx_volunteers_workflow_status
  ON volunteers (workflow_status);

-- Volunteers temporal indexes for follow-up/reminder workflows
CREATE INDEX IF NOT EXISTS idx_volunteers_follow_up_at
  ON volunteers (follow_up_at)
  WHERE follow_up_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_volunteers_status_updated_by
  ON volunteers (status_updated_by);

CREATE INDEX IF NOT EXISTS idx_volunteers_owner_user_id
  ON volunteers (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_volunteers_last_contact_at
  ON volunteers (last_contact_at)
  WHERE last_contact_at IS NOT NULL;

-- Rate limit table - temporal window queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_entries_window_start
  ON rate_limit_entries (window_start);

-- Auth revoked tokens - cleanup queries
CREATE INDEX IF NOT EXISTS idx_auth_revoked_tokens_expires_at
  ON auth_revoked_tokens (expires_at);

-- Auth refresh tokens - user lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user_id
  ON auth_refresh_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_expires_at
  ON auth_refresh_tokens (expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_revoked_at
  ON auth_refresh_tokens (revoked_at)
  WHERE revoked_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_rotated_from_id
  ON auth_refresh_tokens (rotated_from_id);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_rotated_to_id
  ON auth_refresh_tokens (rotated_to_id);

-- Admin audit log - filtering and sorting
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_user_id
  ON admin_audit_log (actor_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action
  ON admin_audit_log (action);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_type
  ON admin_audit_log (target_type);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at_desc
  ON admin_audit_log (created_at DESC);

-- Notification email outbox - worker query patterns
CREATE INDEX IF NOT EXISTS idx_notification_email_outbox_status_next_attempt
  ON notification_email_outbox (status, next_attempt_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_notification_email_outbox_locked_at
  ON notification_email_outbox (locked_at)
  WHERE locked_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_email_outbox_created_at_desc
  ON notification_email_outbox (created_at DESC);

-- Admin audit outbox - worker query patterns
CREATE INDEX IF NOT EXISTS idx_admin_audit_outbox_status_next_attempt
  ON admin_audit_outbox (status, next_attempt_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_admin_audit_outbox_locked_at
  ON admin_audit_outbox (locked_at)
  WHERE locked_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_audit_outbox_created_at_desc
  ON admin_audit_outbox (created_at DESC);
