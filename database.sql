-- ====================================================================
-- MAHA LAUNDRY POS - DATABASE INITIALIZATION SCRIPT
-- Kompatibel 100% untuk dieksekusi di MySQL Workbench / phpMyAdmin / CLI
-- ====================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

-- 1. Buat Database jika belum ada
CREATE DATABASE IF NOT EXISTS `laundry_pos`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `laundry_pos`;

-- 2. Tabel Users (Admin & Kasir)
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin','kasir') NOT NULL DEFAULT 'kasir',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel Services (Master Tarif & Layanan)
CREATE TABLE IF NOT EXISTS `services` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `category` ENUM('kiloan','satuan') NOT NULL,
  `unit` ENUM('kg','pcs','pasang','item') NOT NULL,
  `price` DECIMAL(12,2) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_service_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel Customers (Data Pelanggan Laundry)
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(120) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_customer_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabel Orders (Data Transaksi Nota Kasir)
CREATE TABLE IF NOT EXISTS `orders` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `invoice` VARCHAR(40) NOT NULL UNIQUE,
  `customer_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `subtotal` DECIMAL(12,2) NOT NULL,
  `discount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `total` DECIMAL(12,2) NOT NULL,
  `payment_method` ENUM('Tunai','QRIS','Belum Dibayar') NOT NULL DEFAULT 'Belum Dibayar',
  `payment_status` ENUM('Belum Lunas','Lunas') NOT NULL DEFAULT 'Belum Lunas',
  `status` ENUM('Diterima','Diproses','Selesai','Sudah Diambil') NOT NULL DEFAULT 'Diterima',
  `due_date` DATE NULL,
  `notes` TEXT NULL,
  `whatsapp_notified_at` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_order_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_order_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  INDEX `idx_orders_created` (`created_at`),
  INDEX `idx_orders_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabel Order Items (Detail Rincian Cucian per Nota)
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `order_id` BIGINT NOT NULL,
  `service_id` INT NULL,
  `service_name` VARCHAR(100) NOT NULL,
  `category` ENUM('kiloan','satuan') NOT NULL,
  `unit` ENUM('kg','pcs','pasang','item') NOT NULL,
  `quantity` DECIMAL(10,2) NOT NULL,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `line_total` DECIMAL(12,2) NOT NULL,
  CONSTRAINT `fk_item_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_item_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- SEED DATA AWAL: AKUN ADMIN & DAFTAR LAYANAN
-- ====================================================================

-- Akun Administrator Default (Login: admin / Admin123!)
INSERT INTO `users` (`name`, `username`, `password_hash`, `role`, `active`)
VALUES ('Administrator', 'admin', '$2a$10$RstJKU6NuBiWglIYpAiwtuNmr6Jj9AkjN3zE.3RkTOPmsEBEpU4bS', 'admin', 1)
ON DUPLICATE KEY UPDATE 
  `password_hash` = VALUES(`password_hash`),
  `role` = 'admin',
  `active` = 1;

-- Master Layanan Awal
INSERT INTO `services` (`name`, `category`, `unit`, `price`, `active`) VALUES
('Cuci Kering', 'kiloan', 'kg', 7000.00, 1),
('Cuci Setrika', 'kiloan', 'kg', 9000.00, 1),
('Setrika Saja', 'kiloan', 'kg', 6000.00, 1),
('Express Kilat', 'kiloan', 'kg', 15000.00, 1),
('Selimut', 'satuan', 'pcs', 15000.00, 1),
('Bed Cover', 'satuan', 'pcs', 25000.00, 1),
('Sepatu Sneaker', 'satuan', 'pasang', 30000.00, 1)
ON DUPLICATE KEY UPDATE 
  `price` = VALUES(`price`),
  `category` = VALUES(`category`),
  `unit` = VALUES(`unit`),
  `active` = VALUES(`active`);

SET FOREIGN_KEY_CHECKS = 1;
