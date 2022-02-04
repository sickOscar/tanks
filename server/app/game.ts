import {Player} from "./player";
import db from "../db";
import {Board} from "./board";
import {GameState, IGame} from "../model/IGame";
import {COLS, ROWS} from "../const";
import {Tank} from "./Tank";
import {ITank} from "../model/ITank";


export class Game implements IGame {

    id:number = 0;
    activePlayers:Player[] = [];
    private state:GameState = {
        board: new Board(this),
        jury: []
    };

    constructor() {
    }

    addActivePlayer(player:Player) {
        this.activePlayers.push(player)
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
        this.state.board.load(JSON.parse(dbBoard));
        this.id = res.rows[0].id;
    }

    isInJury(player:Player):boolean {
        return !!this.state.jury.find(p => p.id === player.id);
    }

    isAlive(player:Player):boolean {
        for (let i = 0; i < ROWS; i++) {
            for (let j = 0; j < COLS; j++) {
                const cellContent = this.state.board.getAt(j, i);
                if (cellContent && cellContent.id === player.id) {
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

    get board() {
        return this.state.board;
    }

    set board (board:Board) {
        this.state.board = board;
    }
}

