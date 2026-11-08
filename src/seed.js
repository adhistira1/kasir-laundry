require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const dbHost = process.env.DB_HOST || "localhost";
const dbPort = Number(process.env.DB_PORT || 3306);
const dbUser = process.env.DB_USER || "root";
const dbPassword = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : "";
const dbName = process.env.DB_NAME || "laundry_pos";

const isLocal = dbHost === "localhost" || dbHost === "127.0.0.1" || dbHost === "::1";
const useSSL = process.env.DB_SSL === "true" || (!isLocal && process.env.DB_SSL !== "false");

const baseConfig = {
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  waitForConnections: true,
  connectionLimit: 5,
};

if (useSSL) {
  baseConfig.ssl = { minVersion: "TLSv1.2", rejectUnauthorized: false };
}

(async () => {
  let rootConn = null;
  let pool = null;

  try {
    console.log("=========================================");
    console.log("  MAHA LAUNDRY POS - DATABASE INITIALIZER");
    console.log("=========================================");
    console.log(`Menghubungkan ke MySQL di ${dbHost}:${dbPort} sebagai '${dbUser}'...`);

    // 1. Hubungkan ke MySQL server untuk memastikan database ada
    rootConn = await mysql.createConnection(baseConfig);
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.log(`[✓] Database '${dbName}' siap.`);
    await rootConn.end();
    rootConn = null;

    // 2. Hubungkan ke database laundry_pos
    pool = mysql.createPool({ ...baseConfig, database: dbName });

    // 3. Buat tabel users jika belum ada
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin','kasir') NOT NULL DEFAULT 'kasir',
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Buat tabel services
    await pool.query(`
      CREATE TABLE IF NOT EXISTS services (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        category ENUM('kiloan','satuan') NOT NULL,
        unit ENUM('kg','pcs','pasang','item') NOT NULL,
        price DECIMAL(12,2) NOT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Buat tabel customers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_customer_phone (phone)
      );
    `);

    // 6. Buat tabel orders
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        invoice VARCHAR(40) NOT NULL UNIQUE,
        customer_id INT NOT NULL,
        user_id INT NOT NULL,
        subtotal DECIMAL(12,2) NOT NULL,
        discount DECIMAL(12,2) NOT NULL DEFAULT 0,
        total DECIMAL(12,2) NOT NULL,
        payment_method ENUM('Tunai','QRIS','Belum Dibayar') NOT NULL DEFAULT 'Belum Dibayar',
        payment_status ENUM('Belum Lunas','Lunas') NOT NULL DEFAULT 'Belum Lunas',
        status ENUM('Diterima','Diproses','Selesai','Sudah Diambil') NOT NULL DEFAULT 'Diterima',
        due_date DATE NULL,
        notes TEXT NULL,
        whatsapp_notified_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_orders_created (created_at),
        INDEX idx_orders_status (status)
      );
    `);

    // 7. Buat tabel order_items
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        order_id BIGINT NOT NULL,
        service_id INT NULL,
        service_name VARCHAR(100) NOT NULL,
        category ENUM('kiloan','satuan') NOT NULL,
        unit ENUM('kg','pcs','pasang','item') NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        unit_price DECIMAL(12,2) NOT NULL,
        line_total DECIMAL(12,2) NOT NULL,
        CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );
    `);
    console.log("[✓] Seluruh tabel database berhasil diperiksa/dibuat.");

    // 8. Masukkan master layanan awal jika kosong
    const [[serviceCount]] = await pool.query("SELECT COUNT(*) AS total FROM services");
    if (Number(serviceCount.total) === 0) {
      await pool.query(`
        INSERT INTO services (name, category, unit, price, active) VALUES
        ('Cuci Kering', 'kiloan', 'kg', 7000, 1),
        ('Cuci Setrika', 'kiloan', 'kg', 9000, 1),
        ('Setrika Saja', 'kiloan', 'kg', 6000, 1),
        ('Express Kilat', 'kiloan', 'kg', 15000, 1),
        ('Selimut', 'satuan', 'pcs', 15000, 1),
        ('Bed Cover', 'satuan', 'pcs', 25000, 1),
        ('Sepatu Sneaker', 'satuan', 'pasang', 30000, 1);
      `);
      console.log("[✓] Layanan default berhasil diisi.");
    }

    // 9. Buat atau perbarui akun admin dan kasir default
    const defaultUsers = [
      { name: "Administrator", username: "admin", password: "Admin123!", role: "admin" },
      { name: "Kasir Toko", username: "kasir", password: "Kasir123!", role: "kasir" },
    ];

    for (const u of defaultUsers) {
      const hash = await bcrypt.hash(u.password, 10);
      const [[existing]] = await pool.query("SELECT id FROM users WHERE username=?", [u.username]);
      if (existing) {
        await pool.query("UPDATE users SET password_hash=?, active=1, role=? WHERE id=?", [hash, u.role, existing.id]);
        console.log(`[✓] Akun ${u.role} (${u.username}) diperbarui dan password direset ke default.`);
      } else {
        await pool.query(
          "INSERT INTO users (name, username, password_hash, role, active) VALUES (?, ?, ?, ?, 1)",
          [u.name, u.username, hash, u.role]
        );
        console.log(`[✓] Akun ${u.role} baru (${u.username}) berhasil dibuat.`);
      }
    }

    console.log("-----------------------------------------");
    console.log("  KREDENSIAL LOGIN ANDA:");
    console.log("  1. Admin  -> Username: admin | Password: Admin123!");
    console.log("  2. Kasir  -> Username: kasir | Password: Kasir123!");
    console.log("-----------------------------------------");
    console.log("SIAP DIGUNAKAN! Silakan jalankan: npm.cmd start atau npm.cmd run dev");
  } catch (err) {
    console.error("\n[X] TERJADI KESALAHAN SAAT SEED DATABASE:");
    if (err.code === "ECONNREFUSED") {
      console.error(`Tidak dapat terhubung ke MySQL di ${dbHost}:${dbPort}.`);
      console.error("Pastikan MySQL Server (XAMPP / Laragon / MySQL Service) sudah dijalankan (START).");
    } else if (err.code === "ER_ACCESS_DENIED_ERROR") {
      console.error(`Akses ditolak untuk user '${dbUser}'. Periksa password di file .env.`);
    } else {
      console.error(err.message || err);
    }
    process.exitCode = 1;
  } finally {
    if (rootConn) await rootConn.end().catch(() => {});
    if (pool) await pool.end().catch(() => {});
  }
})();
