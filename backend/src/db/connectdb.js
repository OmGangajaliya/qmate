const { Pool } = require('pg')

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is required to connect to PostgreSQL')
}

const useSsl = process.env.DB_SSL === 'true'
	|| (process.env.DB_SSL !== 'false' && process.env.NODE_ENV === 'production')

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: useSsl ? { rejectUnauthorized: false } : undefined,
	max: Number(process.env.DB_POOL_MAX || 10),
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 10000,
})

pool.on('error', () => {
	console.error('Unexpected error on an idle PostgreSQL connection')
})

const connectDB = async () => {
	await pool.query('SELECT 1')
}

module.exports = { connectDB, pool }