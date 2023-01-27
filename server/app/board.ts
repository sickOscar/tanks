import {COLS, ROWS} from "../const";
import {Tank} from "./Tank";
import {IGame} from "../model/IGame";
import {ITank} from "../model/ITank";
import db from "../db";

import {AxialCoordinates, defineHex, Grid, rectangle} from "honeycomb-grid";

export class TanksHex extends defineHex() {
    tank: ITank | null = null;
}

export class Board {

    private game:IGame
    private board:Grid<TanksHex>;

    constructor(game:IGame) {
        this.game = game;
        this.board = new Grid(TanksHex, rectangle({width: COLS, height: ROWS}));
    }

    getAt(q:number, r:number):ITank|undefined|null {
        return this.board.getHex({q, r})?.tank;
    }

    forEach(cb:(hex:TanksHex) => void) {
        this.board.forEach(cb);
    }

    load(dbBoard:any) {
        this.board = Grid.fromJSON(dbBoard) as unknown as Grid<TanksHex>;
    }

    isPositionOccupied(q: number,r: number): boolean {
        return !!this.board.getHex({q, r})?.tank;
    }

    isPositionValid(q: number, r: number): boolean {
        return !!this.board.getHex({q, r});
    }

    getEmptyRandom(): AxialCoordinates {
        const tankQ = Math.floor(Math.random() * COLS);
        const tankR = Math.floor(Math.random() * ROWS);
        if (this.isPositionOccupied(tankQ, tankR)) {
            return this.getEmptyRandom();
        }
        if (this.game.hasHeartOn(tankQ, tankR)) {
            return this.getEmptyRandom()
        }
        return {q: tankQ, r: tankR};
    }

    isInRange(cell1:AxialCoordinates, cell2: AxialCoordinates, range: number) {
        return this.board.distance(cell1, cell2) <= range;
    }

    moveTankFromTo(start:AxialCoordinates, dest:AxialCoordinates):void {

        const startingHex = this.board.getHex(start);
        const destinationHex = this.board.getHex(dest);

        if (!startingHex) {
            throw new Error('MOVE: Invalid starting position')
        }

        const tank = this.getAt(start.q, start.r);
        if (!tank) {
            throw new Error('MOVE: Empty starting postion')
        }

        if (!destinationHex) {
            throw new Error('MOVE: Invalid destination')
        }

        destinationHex.tank = tank;
        startingHex.tank = null;

    }

    clearCell(q:number, r:number):void {
        this.board.getHex({q, r})!.tank = null;
    }

    addTank(tank:ITank):void {
        this.board.getHex(tank.position)!.tank = tank;
    }

    serialize():string {
        const clone = this.board.toJSON();
        return JSON.stringify({
            features: {
                heartsLocations: this.game.heartsLocations.map((heartPos) => {
                    return [heartPos.q, heartPos.r]
                })
            },
            grid: {
                ...clone,
                coordinates: clone.coordinates.map((coord:AxialCoordinates & {tank?:Tank}) => {
                    if (coord.tank) {
                        const tank:any = Object.assign({}, coord.tank);
                        delete tank.game;
                        return {
                            ...coord,
                            tank
                        }
                    }
                    return coord;
                })
            }
        });
    }

    async updateOnDb():Promise<void> {
        await db.query(`
            UPDATE games SET board = $1 WHERE active = true AND id = $2
        `, [this.serialize(), this.game.id])
    }

    getPlayers():Tank[] {
        const players:Tank[] = [];

        this.board.forEach((hex) => {
            if (hex.tank) {
                players.push(hex.tank as Tank)
            }
        });

        return players;
    }

}

