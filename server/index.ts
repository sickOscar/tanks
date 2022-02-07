import {IAction} from "./model/IAction";

require('dotenv').config()
import cors from 'cors';
import express from 'express';
import {Server} from "socket.io";
import * as http from "http";
import * as path from "path";
import {Tank} from "./app/Tank";
import {MessageTypes} from "./app/messageTypes";
import {authIoMiddleware, checkJwt, unauthorizeEndMiddleware} from "./auth";
import {apis} from "./apis";
import {Player} from "./app/player";
import {Game} from "./app/game";
import db, {prepareDb} from "./db";
import {schedule} from 'node-cron';
import {BoardPosition} from "./app/boardPosition";


async function init() {

    const game = new Game();
    await game.loadActive();

    const actionTimeoutDelay = 3600 * 1000;

    schedule('0 0 11 * * *', async () => {
        setTimeout(async () => {
            try {
                await game.distributeActions();
                await game.dropHeart();
                game.sendMessageToChat(`
💥💥💫💥💥💫💥💥💫💥💥💫💥💥💫💥
        
*IT'S ACTION TIME!!!!*

💥💥💫💥💥💫💥💥💫💥💥💫💥💥💫💥
`, 'action')
                io.sockets.emit(MessageTypes.BOARD, game.board.serialize());
            } catch (err) {
                console.log('Failed to distribute actions')
            }

        }, Math.round(Math.random()* actionTimeoutDelay))

    })

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
                socket.on(MessageTypes.PLAYER_EVENT, async (actionString, cell, callback) => {

                    const action:IAction = {
                        created_at: new Date(),
                        action: actionString,
                        actor: tank,
                        destination: cell ? new BoardPosition(cell.x, cell.y) : undefined
                    }
                    const actionApplied = await tank.applyAction(action);

                    console.log(`${tank.id} | ${action.action} | ${JSON.stringify(cell)} | ${!!actionApplied}`)
                    callback(!!actionApplied);

                    if (actionApplied !== false) {
                        await game.board.updateOnDb();
                        socket.emit(MessageTypes.BOARD, game.board.serialize());
                        socket.broadcast.emit(MessageTypes.BOARD, game.board.serialize());

                        const actionToSend = {
                            created_at: actionApplied.created_at,
                            actor: actionApplied.actor.id,
                            destination: actionApplied.destination ? [actionApplied.destination.x, actionApplied.destination.y] : undefined,
                            action: actionApplied.action,
                            enemy: actionApplied.enemy ? actionApplied.enemy.id : null
                        }

                        socket.emit(MessageTypes.ACTION, actionToSend);
                        socket.broadcast.emit(MessageTypes.ACTION, actionToSend);
                    }
                })
            } else if (game.isInJury(player)) {
                // DO NOTHING REAL TIME

            } else {
                console.log(`CREATE TANK FOR ${userId}`)
                const tank = await Tank.create(game, userId, socket.user.name, socket.user.picture);
                socket.emit(MessageTypes.PLAYER, tank.id)
            }

            socket.on('disconnect', () => {
                game.removeActivePlayer(player);
                socket.broadcast.emit(MessageTypes.PLAYERSLIST, JSON.stringify(game.getPeopleOnline()))
            })

        }


        socket.emit(MessageTypes.MESSAGE, `Welcome ${socket.user.name}!`);
        socket.emit(MessageTypes.BOARD, game.board.serialize());
        socket.emit(MessageTypes.PLAYERSLIST, JSON.stringify(game.getPeopleOnline()))

        socket.broadcast.emit(MessageTypes.MESSAGE, `${socket.user.name} joined!`)
        socket.broadcast.emit(MessageTypes.BOARD, game.board.serialize());
        socket.broadcast.emit(MessageTypes.PLAYERSLIST, JSON.stringify(game.getPeopleOnline()))

    })


    app.get('/events', checkJwt, async (req, res) => {
        res.json(await game.getActions());
    })

    app.get('/players', checkJwt, async (req, res) => {
        res.json(game.getPlayers());
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

