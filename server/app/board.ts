import {COLS, ROWS} from "../const";
import {Tank} from "./Tank";
import {BoardPosition} from "./boardPosition";
import {IGame} from "../model/IGame";
import {ITank} from "../model/ITank";
import db from "../db";

export class Board {

    private game:IGame
    private board:any[][];

    constructor(game:IGame) {
        this.game = game;
        this.board = new Array(ROWS);
        for (let i = 0; i < this.board.length; i++) {
            this.board[i] = new Array(COLS).fill(null);
        }
    }

    getAt(x:number, y:number):Tank|undefined {
        if (!this.board[y]) {
            return undefined
        }
        return this.board[y][x];
    }

    load(dbBoard:any[][]) {
        for (let i = 0; i < ROWS; i++) {
            for (let j = 0; j < COLS; j++) {
                
                if (!this.board[i]) {
                    this.board[i] = new Array(COLS);
                }
                if (dbBoard[i][j] === null) {
                    this.board[i][j] = null;
                } else {
                    this.board[i][j] = new Tank(this.game, {...dbBoard[i][j]})
                }
            }
        }
    }

    isPositionOccupied(x: number, y: number): boolean {
        if (!this.board[y]) {
            return true; // ?? invalid position
        }
        return this.board[y][x] !== null
    }

    isPositionValid(x: number, y: number): boolean {
        return x >= 0 && y >= 0 && this.board[y] !== undefined && this.board[y][x] !== undefined;
    }

    getRandom(): BoardPosition {
        const tankX = Math.floor(Math.random() * COLS);
        const tankY = Math.floor(Math.random() * ROWS);
        if (this.isPositionOccupied(tankX, tankY)) {
            return this.getRandom();
        }
        return new BoardPosition(tankX, tankY);
    }

    isInRange(cell1:BoardPosition, cell2: BoardPosition, range: number) {
        return (
            cell1.x >= cell2.x - range
            && cell1.x <= cell2.x + range
            && cell1.y >= cell2.y - range
            && cell1.y <= cell2.y + range
        )
    }

    moveTankFromTo(start:BoardPosition, dest:BoardPosition):void {
        const tank = this.getAt(start.x, start.y) as Tank;
        if (!tank) {
            throw new Error('MOVE: Empty starting postion')
        }
        this.board[dest.y][dest.x] = tank;
        this.board[start.y][start.x] = null;
    }

    clearCell(x:number, y:number):void {
        this.board[y][x] = null;
    }

    addTank(tank:ITank) {
        this.board[tank.position.y][tank.position.x] = tank;
    }

    serialize():string {
        const clone = new Array(ROWS);
        for (let i = 0; i < clone.length; i++) {
            clone[i] = new Array(COLS).fill(null);
        }

        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const cellContent = this.board[y][x];
                if (cellContent !== null) {
                    const tankClone = Object.assign({}, cellContent)
                    delete tankClone.game;
                    clone[y][x] = tankClone
                }

            }
        }
        return JSON.stringify({
            features: {
                heartLocation: [this.game.heartLocation.x, this.game.heartLocation.y]
            },
            board: clone
        });
    }

    async updateOnDb():Promise<void> {
        await db.query(`
            UPDATE games SET board = $1 WHERE active = true AND id = $2
        `, [this.serialize(), this.game.id])
    }

    getPlayers():Tank[] {
        const players:Tank[] = [];
        for(let i = 0; i < ROWS; i++) {
            for (let j = 0; j < COLS; j++) {
                if (this.getAt(j, i) !== null) {
                    players.push(this.getAt(j ,i) as Tank)
                }
            }
        }
        return players;
    }

}

