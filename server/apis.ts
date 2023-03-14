import express from "express";
import path from "path";
import {checkJwt} from "./auth";
import {COLS, ROWS} from "./const";
import db from "./db";

export const apis = express.Router();

apis.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'))
})

apis.get('/config', checkJwt, async (req, res) => {

    const grid = await db.query(`SELECT * FROM games WHERE active = true`);

    res.json({
        rows: ROWS,
        cols: COLS,
        ...grid.rows[0].board
    })
})

// Endpoint to serve the configuration file
apis.get("/auth_config.json", (req, res) => {
    res.sendFile(path.join(__dirname, "auth_config.json"));
});

apis.get("/history", checkJwt, async (req, res) => {
    const {rows} = await db.query(`
        SELECT * FROM history
        ORDER BY created_at ASC
    `);
    res.json(rows);
})

