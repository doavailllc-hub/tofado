export async function up(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS retailer_inventory (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    retailer_id BIGINT UNSIGNED NOT NULL,
    product_name VARCHAR(180) NOT NULL,
    current_stock DECIMAL(12,3) NOT NULL DEFAULT 0,
    pack_size DECIMAL(12,3) NOT NULL DEFAULT 1,
    lead_days INT UNSIGNED NOT NULL DEFAULT 3,
    safety_days INT UNSIGNED NOT NULL DEFAULT 2,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_retailer_inventory_product (retailer_id, product_name),
    CONSTRAINT fk_inventory_retailer FOREIGN KEY (retailer_id) REFERENCES users(id)
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE IF NOT EXISTS quote_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    retailer_id BIGINT UNSIGNED NOT NULL,
    product_name VARCHAR(180) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    unit VARCHAR(30) NOT NULL DEFAULT 'unit',
    delivery_pincode VARCHAR(6) NULL,
    required_date DATE NULL,
    status ENUM('open','awarded','closed','cancelled') NOT NULL DEFAULT 'open',
    awarded_offer_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_quote_requests_retailer (retailer_id, status),
    CONSTRAINT fk_quote_request_retailer FOREIGN KEY (retailer_id) REFERENCES users(id)
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE IF NOT EXISTS quote_offers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    quote_request_id BIGINT UNSIGNED NOT NULL,
    wholesaler_id BIGINT UNSIGNED NOT NULL,
    unit_price DECIMAL(14,2) NOT NULL,
    gst_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    delivery_fee DECIMAL(14,2) NOT NULL DEFAULT 0,
    delivery_days INT UNSIGNED NOT NULL DEFAULT 0,
    credit_days INT UNSIGNED NOT NULL DEFAULT 0,
    notes VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_quote_offer_supplier (quote_request_id, wholesaler_id),
    CONSTRAINT fk_quote_offer_request FOREIGN KEY (quote_request_id) REFERENCES quote_requests(id),
    CONSTRAINT fk_quote_offer_wholesaler FOREIGN KEY (wholesaler_id) REFERENCES users(id)
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE IF NOT EXISTS credit_consents (
    retailer_id BIGINT UNSIGNED PRIMARY KEY,
    granted TINYINT(1) NOT NULL DEFAULT 0,
    consent_version VARCHAR(30) NOT NULL,
    granted_at TIMESTAMP NULL,
    revoked_at TIMESTAMP NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_credit_consent_retailer FOREIGN KEY (retailer_id) REFERENCES users(id)
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE IF NOT EXISTS group_buys (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    wholesaler_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NULL,
    title VARCHAR(180) NOT NULL,
    target_quantity DECIMAL(12,3) NOT NULL,
    base_price DECIMAL(14,2) NOT NULL,
    group_price DECIMAL(14,2) NOT NULL,
    closes_at DATETIME NOT NULL,
    status ENUM('open','unlocked','closed','cancelled') NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_group_buys_status (status, closes_at),
    CONSTRAINT fk_group_buy_wholesaler FOREIGN KEY (wholesaler_id) REFERENCES users(id),
    CONSTRAINT fk_group_buy_product FOREIGN KEY (product_id) REFERENCES wholesale_products(id)
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE IF NOT EXISTS group_buy_commitments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    group_buy_id BIGINT UNSIGNED NOT NULL,
    retailer_id BIGINT UNSIGNED NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    status ENUM('committed','cancelled','fulfilled') NOT NULL DEFAULT 'committed',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_group_buy_retailer (group_buy_id, retailer_id),
    CONSTRAINT fk_group_commitment_buy FOREIGN KEY (group_buy_id) REFERENCES group_buys(id),
    CONSTRAINT fk_group_commitment_retailer FOREIGN KEY (retailer_id) REFERENCES users(id)
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE IF NOT EXISTS inventory_batches (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    wholesaler_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    batch_no VARCHAR(80) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    cost_price DECIMAL(14,2) NOT NULL DEFAULT 0,
    manufactured_at DATE NULL,
    expiry_date DATE NOT NULL,
    status ENUM('active','discounted','transferred','quarantined','depleted') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_inventory_batch (wholesaler_id, product_id, batch_no),
    INDEX idx_inventory_expiry (wholesaler_id, status, expiry_date),
    CONSTRAINT fk_batch_wholesaler FOREIGN KEY (wholesaler_id) REFERENCES users(id),
    CONSTRAINT fk_batch_product FOREIGN KEY (product_id) REFERENCES wholesale_products(id)
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE IF NOT EXISTS conversational_order_drafts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    retailer_id BIGINT UNSIGNED NOT NULL,
    channel ENUM('app','voice','whatsapp') NOT NULL DEFAULT 'app',
    language VARCHAR(12) NOT NULL DEFAULT 'en-IN',
    source_text TEXT NOT NULL,
    parsed_items JSON NOT NULL,
    status ENUM('draft','confirmed','discarded') NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_conversation_retailer FOREIGN KEY (retailer_id) REFERENCES users(id)
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE IF NOT EXISTS supplier_reviews (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    retailer_id BIGINT UNSIGNED NOT NULL,
    wholesaler_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    quality_rating TINYINT UNSIGNED NOT NULL,
    delivery_rating TINYINT UNSIGNED NOT NULL,
    comment VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_supplier_review_order (retailer_id, order_id),
    CONSTRAINT fk_review_retailer FOREIGN KEY (retailer_id) REFERENCES users(id),
    CONSTRAINT fk_review_wholesaler FOREIGN KEY (wholesaler_id) REFERENCES users(id),
    CONSTRAINT fk_review_order FOREIGN KEY (order_id) REFERENCES purchase_orders(id)
  ) ENGINE=InnoDB`);
}
