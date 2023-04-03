import {GAME_MAP} from "./const";

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

    console.log('Connected to database!')

    try {
        await db.query('SELECT * FROM games')
    } catch (err) {
        console.log('Creating games table');
        await db.query(`
            CREATE TABLE games (
                id SERIAL PRIMARY KEY,
                board JSONB NOT NULL,
                active BOOLEAN DEFAULT TRUE NOT NULL
            )
        `)
    }

    console.log('WAITING 1s')
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
        await db.query('SELECT * FROM players')
    } catch (err) {
        console.log('Creating players table');
        await db.query(`
            CREATE TABLE players (
                sub VARCHAR,
                game INTEGER,
                email VARCHAR,
                FOREIGN KEY (game) REFERENCES games(id)
            )
        `)
    }

    try {
        await db.query('SELECT * FROM events')
    } catch (err) {
        console.log('Creating events table');
        await db.query(`
            CREATE TABLE events (
                id SERIAL PRIMARY KEY,
                game INTEGER,
                actor VARCHAR,
                action VARCHAR,
                destination JSONB,
                enemy VARCHAR,
                created_at timestamptz DEFAULT NOW(),
                CONSTRAINT fk_game FOREIGN KEY (game) REFERENCES games(id)
            )
        `)
    }

    try {
        await db.query(`SELECT * FROM votes`)
    } catch (err) {
        console.log('Creating votes table');
        db.query(`
            CREATE TABLE votes (
                voted_at DATE DEFAULT CURRENT_DATE,
                game INTEGER,
                voter VARCHAR NOT NULL,
                vote_for VARCHAR NOT NULL,
                CONSTRAINT fk_game FOREIGN KEY (game) REFERENCES games(id)
            )
        `)
    }

    try {
        await db.query(`SELECT * FROM history`)
    } catch (err) {
        console.log('Creating history table');
        await db.query(`
            CREATE TABLE history (
                game INTEGER,
                board JSONB NOT NULL,
                created_at timestamptz DEFAULT NOW(),
                CONSTRAINT fk_game FOREIGN KEY (game) REFERENCES games(id)
            )
        `)
    }

    try {
        await db.query(`SELECT * FROM maps`)
    } catch (err) {
        console.log('Creating maps table');
        await db.query(`
            CREATE TABLE maps (
                id SERIAL PRIMARY KEY,
                game INTEGER,
                map JSONB NOT NULL,
                CONSTRAINT fk_game FOREIGN KEY (game) REFERENCES games(id)
            )
        `)
        // await db.query(`
        //     INSERT INTO maps (
        //         game,
        //         map
        //     ) VALUES (
        //         1,
        //         $1
        //     )
        // `, [JSON.stringify({map: GAME_MAP})]);
    }

    try {
        await db.query(`SELECT * FROM buildings`);
    } catch (err) {
        console.log('Creating buildings table');

        await db.query(`
            CREATE TABLE buildings (
                id SERIAL PRIMARY KEY,
                game INTEGER,
                buildings JSONB NOT NULL,
                CONSTRAINT fk_game FOREIGN KEY (game) REFERENCES games(id)
            )
        `)
    }

}


export default db;
