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
import {Action, Player} from "./app/player";
import {Game} from "./app/game";
import db, {prepareDb} from "./db";
import {schedule} from 'node-cron';
import {PlayerActions} from "./app/playerActions";
const assert = require('assert');


async function init() {

    const game = new Game();
    await game.loadActive();

    assert(process.env.ACTION_CRON_EXPRESSION, 'ENV MISSING: ACTION_CRON_EXPRESSION')
    assert(process.env.ACTION_TIMEOUT_DELAY, `ENV MISSING: ACTION_TIMEOUT_DELAY`)

    const actionTimeoutDelay = parseInt(process.env.ACTION_TIMEOUT_DELAY as string);

    /*
    schedule(process.env.ACTION_CRON_EXPRESSION as string, async () => {
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
     */

    setInterval(async () => {
        try {
            await game.distributeActions();
            await game.dropHeart();
            await game.dropAction();
            io.sockets.emit(MessageTypes.BOARD, game.board.serialize());
        } catch (err) {
            console.log(`err`, err)
            console.log('Failed to distribute actions')
        }
    }, 1000000)


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
                socket.on(MessageTypes.PLAYER_EVENT, async (actionString, payload, callback) => {

                    const action:Action = {
                        created_at: new Date(),
                        action: actionString,
                        actor: tank,
                        destination: undefined
                    }

                    console.log(`${tank.id} | ${action.action} | ${JSON.stringify(payload)}`);

                    const stopGameDate = process.env.STOP_GAME_DATE;
                    if (stopGameDate && new Date(stopGameDate) < new Date()) {
                        callback(false);
                        console.log('OUT OF TIME')
                        return;
                    }

                    if (payload && payload.q !== undefined && payload.r !== undefined) {
                        action.destination = {q: payload.q, r: payload.r}
                    }
                    
                    if (actionString === PlayerActions.VOTE) {
                        action.enemy = game.getPlayerTank({id:payload} as Player)
                    }
                    
                    const actionApplied = await tank.applyAction(action);

                    console.log(`${tank.id} | ${action.action} | ${JSON.stringify(payload)} | ${!!actionApplied}`)
                    callback(!!actionApplied);

                    if (actionApplied !== false) {
                        await game.board.updateOnDb();
                        socket.emit(MessageTypes.BOARD, game.board.serialize());
                        socket.broadcast.emit(MessageTypes.BOARD, game.board.serialize());

                        const event = {
                            created_at: actionApplied.created_at,
                            actor: actionApplied.actor.id,
                            destination: actionApplied.destination ? [actionApplied.destination.q, actionApplied.destination.r] : undefined,
                            action: actionApplied.action,
                            enemy: actionApplied.enemy ? actionApplied.enemy.id : null
                        }

                        socket.emit(MessageTypes.ACTION, event);
                        socket.broadcast.emit(MessageTypes.ACTION, event);
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

    app.get('/poll', checkJwt, async (req, res) => {
        res.json(await game.getTodaysPollResults())
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

