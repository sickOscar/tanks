import cors from 'cors';
import express, {NextFunction, Response} from 'express';
import {Server} from "socket.io";
import * as http from "http";
import * as path from "path";
import {auth} from 'express-oauth2-jwt-bearer';
import {authorize} from '@thream/socketio-jwt';
import jwksClient from 'jwks-rsa'
import {ManagementClient} from 'auth0';

require('dotenv').config()

const authConfig = require('./auth_config.json');

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

// create the JWT middleware
const checkJwt = auth({
    audience: authConfig.audience,
    issuerBaseURL: `https://${authConfig.domain}`
});


const ROWS = 5;
const COLS = 5;


enum MessageTypes {
    MESSAGE = 'message',
    BOARD = 'board',
    PLAYER = 'player',
    PLAYER_EVENT = 'playerevent'
}

enum PlayerActions {
    MOVE = 'move',
    SHOOT = 'shoot',
    GIVE_ACTION = 'give-action',
    UPGRADE = 'upgrade'
}

class BoardPosition {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    static isOccupied(x: number, y: number): boolean {
        return board[y][x] !== null
    }

    static isValid(x: number, y: number): boolean {
        return board[y] !== undefined && board[y][x] !== undefined;
    }

    static getRandom(): BoardPosition {
        const tankX = Math.floor(Math.random() * ROWS);
        const tankY = Math.floor(Math.random() * COLS);
        if (BoardPosition.isOccupied(tankX, tankY)) {
            return BoardPosition.getRandom();
        }
        return new BoardPosition(tankX, tankY);
    }

    isInRange(cell: BoardPosition, range: number) {
        return (
            cell.x >= this.x - range
            && cell.x <= this.x + range
            && cell.y >= this.y - range
            && cell.y <= this.y + range
        )
    }
}

interface TankParams {
    id: string,
    position: BoardPosition,
    life: 0 | 1 | 2 | 3,
    actions: number,
    range: 2 | 3,
    name:string;
    picture:string;
}

const DEFAULT_TANK_PARAMS: TankParams = {
    id: Math.random().toString(36).substring(2),
    actions: 1,
    position: new BoardPosition(0, 0),
    life: 3,
    range: 2,
    name: '',
    picture: ''
}

class Tank {
    id: string;
    actions: number;
    position: BoardPosition;
    life: number;
    range: number;
    name:string;
    picture:string;

    constructor(params: Partial<TankParams>) {
        const opts: TankParams = Object.assign(DEFAULT_TANK_PARAMS, params)
        this.id = opts.id;
        this.position = opts.position;
        this.actions = opts.actions;
        this.life = opts.life;
        this.range = opts.range;
        this.name = opts.name;
        this.picture = opts.picture;
    }

    static create(userId:string, name:string, picture:string):Tank {
        let tank:Tank;
        for (let i = 0; i < ROWS; i++) {
            for (let j = 0; j < COLS; j++) {
                if (board[i][j] && board[i][j].id === userId) {
                    tank = board[i][j];
                    // console.log(`tank`, tank)
                }
            }
        }

        // @ts-ignore
        if (!tank) {
            const tankPosition = BoardPosition.getRandom();
            tank = new Tank({
                id: userId,
                position: tankPosition,
                name, picture
            });
            board[tankPosition.y][tankPosition.x] = tank;
        }

        return tank;
    }

    delete(): void {
        board[this.position.y][this.position.x] = null;
    }

    die(): void {
        this.delete();
    }

    move(x: number, y: number): void {
        board[y][x] = this;
        board[this.position.y][this.position.x] = null;
        this.position.x = x;
        this.position.y = y;
        this.useAction();
    }

    shoot(x: number, y: number): void {
        const enemy: Tank = board[y][x];
        enemy.life -= 1;
        if (enemy.life === 0) {
            enemy.die();
        }
        this.useAction();
    }

    giveAction(x: number, y: number): void {
        const enemy: Tank = board[y][x];
        enemy.actions += 1;
        this.useAction();
    }

    upgrade() {
        this.range = Math.min(this.range + 1, 3);
        this.useAction();
    }

    useAction() {
        // this.actions -= 1;
    }

    applyAction(action: PlayerActions, cell: { x: number, y: number }): boolean {

        if (this.actions === 0) {
            return false;
        }

        if (action === PlayerActions.UPGRADE) {
            if (this.range < 3) {
                this.upgrade()
            }
            return true;
        }

        const x = Math.min(COLS - 1, Math.max(cell.x, 0));
        const y = Math.min(ROWS - 1, Math.max(cell.y, 0));

        const boardCell = new BoardPosition(x, y);

        if (action === PlayerActions.MOVE) {
            if (BoardPosition.isOccupied(x, y) || !BoardPosition.isValid(x, y)) {
                return false;
            }
            if (this.position.isInRange(boardCell, 1)) {
                this.move(x, y);
                return true;
            }
        }

        if (action === PlayerActions.SHOOT) {
            if (!BoardPosition.isOccupied(x, y) || !BoardPosition.isValid(x, y)) {
                return false;
            }
            // friendly fire
            if (this.position.x === x && this.position.y === y) {
                return false;
            }
            if (this.position.isInRange(boardCell, this.range)) {
                this.shoot(x, y);
                return true;
            }
        }

        if (action === PlayerActions.GIVE_ACTION) {
            if (!BoardPosition.isOccupied(x, y) || !BoardPosition.isValid(x, y)) {
                return false;
            }
            if (this.position.x === x && this.position.y === y) {
                return false;
            }
            if (this.position.isInRange(boardCell, this.range)) {
                this.giveAction(x, y);
                return true;
            }
        }

        return false;
    }
}


const board = new Array(ROWS);
for (let i = 0; i < board.length; i++) {
    board[i] = new Array(COLS).fill(null);
}

app.use(cors())
app.use(express.static(path.join(__dirname, '../client')));

const client = jwksClient({
    jwksUri: 'https://codeinthedarkve.eu.auth0.com/.well-known/jwks.json'
})

io.use(
    authorize({
        secret: async (decodedToken) => {
            const key = await client.getSigningKey(decodedToken.header.kid)
            return key.getPublicKey()
        },
        algorithms: ['RS256'],
        onAuthentication: async decodedToken => {

            // fetch user from aut0
            const management = new ManagementClient({
                domain: 'codeinthedarkve.eu.auth0.com',
                clientId: '4dCf4ApFWyusJBIylSltVO4ECa33BlEg',
                clientSecret: process.env.AUTH0_MANAGEMENT_SECRET,
                scope: 'read:users',
            });
            return await management.getUser({
                id: decodedToken.sub
            })
        }
    })
)

io.on('connection', socket => {

    // console.log(socket.decodedToken);
    // console.log(socket.user);

    const userId = socket.decodedToken.sub;
    console.log(`new Connection ${userId}`);

    const tank = Tank.create(userId, socket.user.name, socket.user.picture);



    socket.emit(MessageTypes.MESSAGE, `Welcome ${userId}!`);
    socket.emit(MessageTypes.PLAYER, tank.id)
    socket.emit(MessageTypes.BOARD, JSON.stringify(board));

    socket.broadcast.emit(MessageTypes.MESSAGE, `${userId} joined!`)
    socket.broadcast.emit(MessageTypes.BOARD, JSON.stringify(board));

    socket.on(MessageTypes.PLAYER_EVENT, (action, cell, callback) => {
        const hasBeenApplied = tank.applyAction(action, cell);
        console.log(`${tank.id} | ${action} | ${JSON.stringify(cell)} | ${hasBeenApplied}`)
        callback(hasBeenApplied);
        if (hasBeenApplied) {
            socket.emit(MessageTypes.BOARD, JSON.stringify(board));
            socket.broadcast.emit(MessageTypes.BOARD, JSON.stringify(board));
        }
    })

    socket.on('disconnect', () => {
        // tank.delete();
    })
})

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'))
})

app.get('/config', checkJwt, (req, res) => {
    res.json({
        rows: ROWS,
        cols: COLS
    })
})

// Endpoint to serve the configuration file
app.get("/auth_config.json", (req, res) => {
    res.sendFile(path.join(__dirname, "auth_config.json"));
});

// @ts-ignore
app.use(function (err: any, req: Request, res: Response, next: NextFunction) {
    if (err.name === "UnauthorizedError") {
        return res.status(401).send({msg: "Invalid token"});
    }
    // @ts-ignore
    next(err, req, res);
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`App listening on port ${port}`);
})