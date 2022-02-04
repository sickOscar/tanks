import * as assert from "assert";

require('dotenv').config()

import cors from 'cors';
import express from 'express';
import {Server} from "socket.io";
import * as http from "http";
import * as path from "path";
import {Tank} from "./app/Tank";
import {MessageTypes} from "./app/messageTypes";
import {authIoMiddleware, unauthorizeEndMiddleware} from "./auth";
import {apis} from "./apis";
import {Player} from "./app/player";
import {Game} from "./app/game";
import db, {prepareDb} from "./db";


async function init() {

    const game = new Game();
    await game.loadActive();

    setInterval(async () => {
        await game.distributeActions();
        io.sockets.emit(MessageTypes.BOARD, game.board.serialize());
    }, 30000)

    setInterval(async () => {
        await game.dropHeart();
        io.sockets.emit(MessageTypes.BOARD, game.board.serialize());
    }, 5000)

    const app = express()
    const server = http.createServer(app)
    const io = new Server(server, {
        cors: {
            origin: '*'
        }
    });
    app.use(cors())
    app.use(express.static(path.join(__dirname, '../client')));
    app.use('/', apis)


    io.use(authIoMiddleware())

    io.on('connection', async socket => {

        const userId = socket.decodedToken.sub;
        console.log(`new Connection ${userId} - ${socket.user.email}`);

        const registeredPlayer = await Player.get(userId, game.id)

        if (registeredPlayer) {
            const player = new Player({
                id: userId,
                name: socket.user.name,
                picture: socket.user.picture
            });
            game.addActivePlayer(player);

            let tank:Tank;

            if (game.isAlive(player)) {
                tank = game.getPlayerTank(player) as Tank;
                socket.emit(MessageTypes.PLAYER, tank.id)
                socket.on(MessageTypes.PLAYER_EVENT, async (action, cell, callback) => {
                    const hasBeenApplied = await tank.applyAction(action, cell);
                    console.log(`${tank.id} | ${action} | ${JSON.stringify(cell)} | ${hasBeenApplied}`)
                    callback(hasBeenApplied);
                    if (hasBeenApplied) {
                        await db.query(`
                            UPDATE games SET board = '${game.board.serialize()}' WHERE active = true
                        `)
                        socket.emit(MessageTypes.BOARD, game.board.serialize());
                        socket.broadcast.emit(MessageTypes.BOARD, game.board.serialize());
                    }
                })
            } else if (game.isInJury(player)) {


            } else {
                console.log(`CREATE TANK FOR ${userId}`)
                const tank = await Tank.create(game, userId, socket.user.name, socket.user.picture);
                socket.emit(MessageTypes.PLAYER, tank.id)
            }

            socket.on('disconnect', () => {
                game.removeActivePlayer(player);
            })

        }


        socket.emit(MessageTypes.MESSAGE, `Welcome ${socket.user.name}!`);
        socket.emit(MessageTypes.BOARD, game.board.serialize());
        socket.emit(MessageTypes.PLAYERSLIST, JSON.stringify(game.activePlayers))

        socket.broadcast.emit(MessageTypes.MESSAGE, `${socket.user.name} joined!`)
        socket.broadcast.emit(MessageTypes.BOARD, game.board.serialize());
        socket.broadcast.emit(MessageTypes.PLAYERSLIST, JSON.stringify(game.activePlayers))



    })

// @ts-ignore
    app.use(unauthorizeEndMiddleware());

    const port = process.env.PORT || 3000;
    server.listen(port, () => {
        console.log(`App listening on port ${port}`);
    })

}

db.connect()
    .then(prepareDb())
    .then(init)
    .catch((err:Error) => {
        console.error(err)
    })

