CREATE DATABASE IF NOT EXISTS tofado_merchant CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tofado_merchant;

CREATE TABLE users (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 role ENUM('admin','retailer','wholesaler') NOT NULL,
 name VARCHAR(120) NOT NULL,
 business_name VARCHAR(180) NOT NULL,
 email VARCHAR(190) NOT NULL UNIQUE,
 phone VARCHAR(30) NOT NULL,
 location VARCHAR(150) NOT NULL,
 address TEXT,
 tax_number VARCHAR(80),
 license_number VARCHAR(100),
 password_hash VARCHAR(255) NOT NULL,
 status ENUM('active','suspended') DEFAULT 'active',
 verified_at DATETIME,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_users_role_status(role,status)
);

CREATE TABLE merchant_applications (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 role ENUM('retailer','wholesaler') NOT NULL,
 name VARCHAR(120) NOT NULL,
 business_name VARCHAR(180) NOT NULL,
 email VARCHAR(190) NOT NULL,
 phone VARCHAR(30) NOT NULL,
 location VARCHAR(150) NOT NULL,
 address TEXT NOT NULL,
 tax_number VARCHAR(80),
 license_number VARCHAR(100),
 password_hash VARCHAR(255) NOT NULL,
 status ENUM('pending','approved','rejected') DEFAULT 'pending',
 reviewed_by BIGINT UNSIGNED,
 reviewed_at DATETIME,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
 INDEX idx_application_status(status)
);

CREATE TABLE purchase_orders (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 order_no VARCHAR(30) NOT NULL UNIQUE,
 retailer_id BIGINT UNSIGNED NOT NULL,
 wholesaler_id BIGINT UNSIGNED NOT NULL,
 delivery_address TEXT NOT NULL,
 required_date DATE,
 notes TEXT,
 status ENUM('pending','confirmed','packed','dispatched','delivered','cancelled') DEFAULT 'pending',
 subtotal DECIMAL(12,2) DEFAULT 0,
 tax_amount DECIMAL(12,2) DEFAULT 0,
 total_amount DECIMAL(12,2) DEFAULT 0,
 delivered_at DATETIME,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(retailer_id) REFERENCES users(id),
 FOREIGN KEY(wholesaler_id) REFERENCES users(id),
 INDEX idx_orders_retailer(retailer_id), INDEX idx_orders_wholesaler(wholesaler_id), INDEX idx_orders_status(status)
);

CREATE TABLE purchase_order_items (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 order_id BIGINT UNSIGNED NOT NULL,
 product_name VARCHAR(200) NOT NULL,
 quantity DECIMAL(10,2) NOT NULL,
 unit VARCHAR(30) NOT NULL,
 unit_price DECIMAL(12,2),
 notes VARCHAR(255),
 FOREIGN KEY(order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
);

CREATE TABLE invoices (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 invoice_no VARCHAR(40) NOT NULL UNIQUE,
 order_id BIGINT UNSIGNED NOT NULL UNIQUE,
 retailer_id BIGINT UNSIGNED NOT NULL,
 wholesaler_id BIGINT UNSIGNED NOT NULL,
 subtotal DECIMAL(12,2) NOT NULL,
 tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
 total_amount DECIMAL(12,2) NOT NULL,
 paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
 due_date DATE,
 status ENUM('unpaid','partial','paid','cancelled') DEFAULT 'unpaid',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(order_id) REFERENCES purchase_orders(id),
 FOREIGN KEY(retailer_id) REFERENCES users(id),
 FOREIGN KEY(wholesaler_id) REFERENCES users(id),
 INDEX idx_invoice_status(status)
);

CREATE TABLE payments (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 payment_no VARCHAR(40) NOT NULL UNIQUE,
 invoice_id BIGINT UNSIGNED NOT NULL,
 retailer_id BIGINT UNSIGNED NOT NULL,
 wholesaler_id BIGINT UNSIGNED NOT NULL,
 amount DECIMAL(12,2) NOT NULL,
 method ENUM('cash','bank_transfer','card','credit') NOT NULL,
 reference_no VARCHAR(120),
 status ENUM('pending','paid','failed') DEFAULT 'paid',
 paid_at DATETIME,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(invoice_id) REFERENCES invoices(id),
 FOREIGN KEY(retailer_id) REFERENCES users(id),
 FOREIGN KEY(wholesaler_id) REFERENCES users(id)
);

INSERT INTO users(role,name,business_name,email,phone,location,address,tax_number,license_number,password_hash,status,verified_at) VALUES
('admin','Tofado Admin','Tofado','admin@tofado.com','0500000000','Riyadh','Tofado Head Office',NULL,NULL,'df48e43cb6a09f84c8100299d2e8227c:148b80f1b41f2e04b5f1b2cfb127911778f030595b3fd7e91876f4403abd6e5797fd736f704631232a6ed54815149e83a9a74a260191b94929ed9273ab1ac0f8','active',NOW()),
('retailer','Ahmed Saleh','Fresh Basket Grocery','retailer@tofado.com','0551001001','Dammam','King Fahd Road, Dammam','310000001','CR-RET-1001','1a8aa8dc590b4f34970d0db866e49c9e:95f6e84f011026fa80a0a1f49a765ddcef732c3e4f9b3fbe09cff162e8ab3641b8268e50a8bd44d1054aa0d7631aadfc53eabba05f5e00bce7987323f8c4ad63','active',NOW()),
('wholesaler','Mohammed Khan','Eastern Food Wholesale','wholesaler@tofado.com','0552002002','Al Khobar','Industrial Area, Al Khobar','310000002','CR-WHO-2002','09d7bfdb71b580a3b113374a4855e541:8ef43ae7bc02c511f71a1fdc0211f90068ad3abd274573fbe30fbd264c24a22e4117d892c2241a2e228dd06e7150c6de361c69cc20ca6f88adae9586ff83f31b','active',NOW());

INSERT INTO purchase_orders(order_no,retailer_id,wholesaler_id,delivery_address,required_date,notes,status,subtotal,tax_amount,total_amount,delivered_at) VALUES
('PO-10001',2,3,'Fresh Basket Grocery, King Fahd Road, Dammam',DATE_ADD(CURDATE(),INTERVAL 2 DAY),'Morning delivery preferred','pending',0,0,0,NULL),
('PO-10002',2,3,'Fresh Basket Grocery, King Fahd Road, Dammam',CURDATE(),'Call before delivery','delivered',1280,192,1472,NOW());
INSERT INTO purchase_order_items(order_id,product_name,quantity,unit,unit_price,notes) VALUES
(1,'Basmati Rice 5kg',20,'bag',NULL,'Any premium brand'),(1,'Sunflower Oil 1.5L',12,'carton',NULL,'6 bottles per carton'),(1,'White Sugar 2kg',15,'carton',NULL,NULL),
(2,'All-purpose Flour 10kg',10,'bag',65,NULL),(2,'Tea Powder 1kg',8,'box',78,NULL);
INSERT INTO invoices(invoice_no,order_id,retailer_id,wholesaler_id,subtotal,tax_amount,total_amount,paid_amount,due_date,status) VALUES
('INV-10002',2,2,3,1280,192,1472,700,DATE_ADD(CURDATE(),INTERVAL 7 DAY),'partial');
INSERT INTO payments(payment_no,invoice_id,retailer_id,wholesaler_id,amount,method,reference_no,status,paid_at) VALUES
('PAY-10001',1,2,3,700,'bank_transfer','BANK-778812','paid',NOW());
