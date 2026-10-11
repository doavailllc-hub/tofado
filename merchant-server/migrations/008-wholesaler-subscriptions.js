export async function up(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS merchant_subscriptions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    wholesaler_id BIGINT UNSIGNED NOT NULL,
    plan_code ENUM('starter','growth','scale') NOT NULL DEFAULT 'starter',
    status ENUM('trialing','active','past_due','cancelled','expired') NOT NULL DEFAULT 'trialing',
    trial_ends_at DATETIME NULL,
    current_period_starts_at DATETIME NULL,
    current_period_ends_at DATETIME NULL,
    grace_period_ends_at DATETIME NULL,
    cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
    failed_payment_count INT UNSIGNED NOT NULL DEFAULT 0,
    provider_customer_id VARCHAR(160) NULL,
    provider_subscription_id VARCHAR(160) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_subscription_wholesaler (wholesaler_id),
    CONSTRAINT fk_subscription_wholesaler FOREIGN KEY (wholesaler_id) REFERENCES users(id)
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE IF NOT EXISTS subscription_payment_attempts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    subscription_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    status ENUM('pending','successful','failed') NOT NULL,
    failure_code VARCHAR(80) NULL,
    failure_message VARCHAR(300) NULL,
    provider_payment_id VARCHAR(160) NULL,
    attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_subscription_attempts (subscription_id, attempted_at),
    CONSTRAINT fk_attempt_subscription FOREIGN KEY (subscription_id) REFERENCES merchant_subscriptions(id)
  ) ENGINE=InnoDB`);
}
