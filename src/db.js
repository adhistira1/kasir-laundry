const mysql = require("mysql2/promise");
require("dotenv").config();

const dbHost = process.env.DB_HOST || "localhost";
const dbPort = Number(process.env.DB_PORT || 3306);
const dbUser = process.env.DB_USER || "root";
const dbPassword = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : "";
const dbName = process.env.DB_NAME || "laundry_pos";

// Aktifkan SSL jika DB_SSL="true", atau jika host adalah server cloud (bukan localhost)
const isLocal = dbHost === "localhost" || dbHost === "127.0.0.1" || dbHost === "::1";
const useSSL = process.env.DB_SSL === "true" || (!isLocal && process.env.DB_SSL !== "false");

const poolConfig = {
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
};

if (useSSL) {
  poolConfig.ssl = {
    minVersion: "TLSv1.2",
    rejectUnauthorized: false,
  };
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;
