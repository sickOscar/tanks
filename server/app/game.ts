import {Player} from "./player";
import db from "../db";
import {Board} from "./board";
import {GameState, IGame} from "../model/IGame";
import {COLS, ROWS} from "../const";
import {ITank} from "../model/ITank";
import {BoardPosition} from "./boardPosition";
import {Tank} from "./Tank";
import axios from "axios";

export class Game implements IGame {

    id:number = 0;
    activePlayers:Player[] = [];
    private state:GameState = {
        board: new Board(this),
        heartLocation: new BoardPosition(-1, -1),
        jury: []
    };

    constructor() {
    }

    addActivePlayer(player:Player) {
        if (!this.activePlayers.find(p => p.id === player.id)) {
            this.activePlayers.push(player)
        }

    }

    removeActivePlayer(player:Player) {
        this.activePlayers = this.activePlayers.filter(p => p.id !== player.id);
    }

    async loadActive() {
        const res = await db.query(`
            SELECT * from games WHERE active = true
        `)
        
        if (res.rows.length === 0) {
            throw new Error('NO ACTIVE GAME')
        }

        const dbBoard = res.rows[0].board;
        this.state.board.load(dbBoard.board);

        if (dbBoard.features.heartLocation) {
            this.state.heartLocation = new BoardPosition(
                dbBoard.features.heartLocation.x,
                dbBoard.features.heartLocation.y
            )
        }

        for (let i = 0; i < ROWS; i++) {
            for (let j = 0; j < COLS; j++) {
                const el = this.board.getAt(j, i);
                if (el && el.life === 0) {
                    this.state.jury.push(el);
                }
            }
        }

        this.id = res.rows[0].id;
    }

    isInJury(player:Player):boolean {
        return !!this.state.jury.find(p => p.id === player.id);
    }

    isAlive(player:Player):boolean {
        for (let i = 0; i < ROWS; i++) {
            for (let j = 0; j < COLS; j++) {
                const cellContent = this.state.board.getAt(j, i);
                if (cellContent && cellContent.id === player.id && cellContent.life >= 0) {
                    return true;
                }
            }
        }
        return false;
    }

    getPlayerTank(player:Player):ITank|undefined {
        for (let i = 0; i < ROWS; i++) {
            for (let j = 0; j < COLS; j++) {
                const cellContent = this.state.board.getAt(j, i);
                if (cellContent && cellContent.id === player.id) {
                    return cellContent;
                }
            }
        }
    }

    async distributeActions():Promise<void> {
        for (let i = 0; i < ROWS; i++) {
            for (let j = 0; j < COLS; j++) {
                const cellContent = this.state.board.getAt(j, i);
                if (cellContent && cellContent.life > 0) {
                    cellContent.actions += 1;
                }
            }
        }
        await this.board.updateOnDb();
    }

    async dropHeart():Promise<void> {
        this.state.heartLocation = this.board.getRandom();
        await this.board.updateOnDb();
    }

    clearHeart():void {
        this.state.heartLocation = new BoardPosition(-1, -1);
    }

    async addAction(actor:Tank, action:string, dest?:BoardPosition, enemy?:Tank):Promise<void> {
        const destination = dest ? [dest.x, dest.y] : null;
        const en = enemy ? enemy.id : null;
        await db.query(`
            INSERT INTO events (game, actor, action, destination, enemy) VALUES ($1, $2, $3, $4, $5)
        `, [this.id, actor.id, action, JSON.stringify(destination), en])
    }

    async getActions():Promise<any> {
        const res = await db.query(`
            SELECT * FROM events ORDER BY created_at DESC LIMIT 10 
        `)
        return res.rows;
    }

    sendMessageToChat(message: string, botSearch?: string): void {

        if (!process.env.GIPHY_API_KEY || !process.env.GOOGLE_CHAT_WEBHOOK) {
            return;
        }

        // NON CAMBIARE IN ASYNC AWAIT che se fallisce è un casino
        axios.post(
            process.env.GOOGLE_CHAT_WEBHOOK as string,
            {text: message},
            {
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                },
            }
        )
            .then(() => {
                if (botSearch) {
                    const apiKey = process.env.GIPHY_API_KEY
                    axios.get(`https://api.giphy.com/v1/gifs/random?api_key=${apiKey}&tag=${botSearch}`)
                        .then(response => {
                            axios.post(
                                process.env.GOOGLE_CHAT_WEBHOOK as string,
                                {
                                    cards: [{
                                        sections: [{
                                            widgets: [{
                                                image: {
                                                    imageUrl: response.data.data.images.downsized.url,
                                                    onClick: {
                                                        openLink: {
                                                            "url": "https://tanks-office-ruiner.herokuapp.com"
                                                        }
                                                    }
                                                }
                                            }]
                                        }]
                                    }]
                                },
                                {
                                    headers: {
                                        'Content-Type': 'application/json; charset=UTF-8',
                                    },
                                }
                            )
                                .then(() => {
                                    console.log(`Sent message: /random ${botSearch}`);
                                })
                                .catch(err => {
                                    console.log(`err`, err)
                                })

                        })
                        .catch(err => {
                            console.log(`err`, err)
                        })
                }
            })
    }

    getPlayers():any[] {
        return this.board.getPlayers().map(t => t.asPlayer())
    }

    getPeopleOnline():any[] {
        return this.activePlayers;
    }

    get heartLocation() {
        return this.state.heartLocation;
    }

    get board() {
        return this.state.board;
    }

    set board (board:Board) {
        this.state.board = board;
    }
}

