import express from "express";
import path from "path";
import {checkJwt} from "./auth";
import {COLS, ROWS} from "./const";

export const apis = express.Router();

apis.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'))
})

apis.get('/config', checkJwt, (req, res) => {
    res.json({
        rows: ROWS,
        cols: COLS
    })
})

// Endpoint to serve the configuration file
apis.get("/auth_config.json", (req, res) => {
    res.sendFile(path.join(__dirname, "auth_config.json"));
});

