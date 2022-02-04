const { Client } = require('pg')

let dbUrl = process.env.DATABASE_URL;
let connectionParams:any = dbUrl;

if (process.env.NODE_ENV === 'production') {
    dbUrl += '?sslmode=require';
    connectionParams = {
        connectionString: dbUrl,
        rejectUnauthorized: false
    }
}

const db = new Client(connectionParams)

export async function prepareDb() {

    try {
        await db.query('SELECT * FROM games')
    } catch (err) {
        db.query(`
            CREATE TABLE games (
                id SERIAL PRIMARY KEY,
                board JSONB NOT NULL,
                active
            )
        `)
    }

    try {
        await db.query('SELECT * FROM players')
    } catch (err) {
        db.query(`
            CREATE TABLE players (
                sub VARCHAR,
                game INTEGER,
                CONSTRAINT fk_game
                    FOREIGN KEY (game)
                        REFERENCES games(id)
            )
        `)
    }

}


export default db;