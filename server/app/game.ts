import {Player} from "./player";
import db from "../db";
import {Board} from "./board";
import {GameState, IGame} from "../model/IGame";
import {COLS, ROWS} from "../const";
import {ITank} from "../model/ITank";
import {BoardPosition} from "./boardPosition";
import {Tank} from "./Tank";

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

