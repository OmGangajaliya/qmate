const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

const app = require('./app')
const { connectDB, pool } = require('./db/connectdb')
const port = Number(process.env.PORT || 5000)

const start = async () => {
	try {
		await connectDB()
		const server = app.listen(port, () => {
			console.log(`QMate API listening on port ${port}; PostgreSQL connected`)
		})

		const shutdown = (signal) => {
			console.log(`${signal} received; closing server`)
			server.close(async () => {
				await pool.end()
				process.exit(0)
			})
		}

		process.once('SIGINT', () => shutdown('SIGINT'))
		process.once('SIGTERM', () => shutdown('SIGTERM'))
	} catch (error) {
		console.error('Unable to connect to PostgreSQL. Check DATABASE_URL and DB_SSL.')
		console.error(error.message)
		await pool.end()
		process.exit(1)
	}
}

start()
