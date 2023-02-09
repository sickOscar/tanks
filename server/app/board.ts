import {COLS, ROWS} from "../const";
import {Tank} from "./Tank";
import db from "../db";

import {AxialCoordinates, defineHex, Grid, rectangle} from "honeycomb-grid";
import {Game} from "./game";

export class TanksHex extends defineHex() {
    tank: Tank | null = null;
    tile: number = 0;


    constructor(...args: any) {
        super(...args);
        this.tank = args[0].tank;
        this.tile = args[0].tile;
    }
}

export class Board {

    private game:Game
    private board:Grid<TanksHex>;

    constructor(game:Game) {
        this.game = game;
        this.board = new Grid(TanksHex, rectangle({width: COLS, height: ROWS}));

        const map = [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1],
            [1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 3, 3, 0, 1, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 3, 3, 3, 0, 4, 0, 0, 0, 0, 0, 2, 2, 0, 2, 0, 1, 1],
            [1, 0, 0, 3, 3, 3, 0, 4, 0, 0, 0, 0, 2, 2, 2, 2, 2, 0, 0, 1],
            [1, 1, 0, 3, 3, 3, 0, 0, 0, 0, 0, 4, 4, 0, 0, 0, 0, 0, 3, 1],
            [1, 1, 0, 0, 3, 3, 0, 0, 0, 0, 4, 4, 0, 0, 0, 0, 0, 3, 3, 1],
            [1, 0, 0, 0, 3, 0, 0, 0, 0, 4, 4, 0, 0, 0, 1, 1, 0, 1, 3, 1],
            [1, 0, 0, 4, 3, 0, 0, 0, 4, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 4, 3, 3, 0, 4, 4, 0, 0, 0, 2, 0, 0, 2, 2, 1, 1, 1],
            [1, 0, 0, 4, 3, 3, 3, 4, 0, 0, 0, 0, 0, 2, 0, 2, 2, 0, 1, 1],
            [1, 0, 0, 0, 0, 3, 3, 0, 3, 3, 0, 4, 0, 2, 2, 2, 0, 0, 1, 1],
            [1, 1, 0, 0, 4, 3, 4, 3, 3, 0, 0, 0, 0, 0, 2, 2, 4, 0, 0, 1],
            [1, 0, 0, 0, 0, 3, 3, 3, 3, 0, 0, 0, 0, 0, 2, 2, 4, 0, 0, 1],
            [1, 0, 0, 0, 0, 3, 3, 1, 0, 0, 3, 3, 3, 0, 0, 0, 4, 0, 0, 1],
            [1, 0, 0, 1, 1, 3, 3, 1, 1, 0, 0, 3, 1, 1, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ]

        const square = rectangle<TanksHex>({width: COLS, height: ROWS});
        const traversedGrid = this.board.traverse(square, {});

        let x = 0;
        let y = 0;
        traversedGrid.forEach((hex: TanksHex) => {
            hex.tile = map[y][x];
            x++;
            if (x >= COLS) {
                x = 0;
                y++;
            }
        })


    }

    getAt(q:number, r:number):Tank|undefined|null {
        return this.board.getHex({q, r})?.tank;
    }

    forEach(cb:(hex:TanksHex) => void) {
        this.board.forEach(cb);
    }

    load(dbGrid:any) {
        const coords = dbGrid.coordinates.map(({q, r, tank, tile}:any) => {
            return {q, r, tank: tank ? new Tank(this.game, tank) : null, tile}
        })

        this.board = new Grid(TanksHex, coords);
    }

    isPositionOccupied(q: number,r: number): boolean {
        return !!this.board.getHex({q, r})?.tank;
    }

    isPositionValid(q: number, r: number): boolean {
        return !!this.board.getHex({q, r});
    }

    getEmptyRandom(): AxialCoordinates {

        let minQ = 0;
        let minR = 0;
        let maxQ = 0;
        let maxR = 0;

        this.board.forEach((hex: TanksHex) => {
            if (hex.q < minQ) {
                minQ = hex.q;
            }
            if (hex.r < minR) {
                minR = hex.r;
            }
            if (hex.q > maxQ) {
                maxQ = hex.q;
            }
            if (hex.r > maxR) {
                maxR = hex.r;
            }
        });

        const qDiff = maxQ - minQ;
        const rDiff = maxR - minR;

        const tankQ = Math.round(Math.random() * qDiff) + minQ;
        const tankR = Math.round(Math.random() * rDiff) + minR;


        if (!this.isPositionWalkable(tankQ, tankR)) {
            return this.getEmptyRandom();
        }
        if (this.isPositionOccupied(tankQ, tankR)) {
            return this.getEmptyRandom();
        }
        if (this.game.hasHeartOn(tankQ, tankR)) {
            return this.getEmptyRandom()
        }
        if (this.game.hasActionOn(tankQ, tankR)) {
            return this.getEmptyRandom()
        }

        return {q: tankQ, r: tankR};
    }

    isPositionWalkable(q: number, r: number): boolean {
        const hex = this.board.getHex({q, r});
        return hex?.tile !== 1 && hex?.tile !== 4;
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

        console.log(`moving`)

        destinationHex.tank = tank;
        startingHex.tank = null;

    }

    clearCell(q:number, r:number):void {
        this.board.getHex({q, r})!.tank = null;
    }

    addTank(tank:Tank):void {
        console.log(`tank.position`, tank.position)
        console.log(`this.board`, this.board)
        const hex = this.board.getHex(tank.position);
        if (!hex) {
            throw new Error('Invalid tank position')
        }
        hex.tank = tank;
        // this.board.getHex(tank.position)!.tank = tank;
    }

    serialize():string {
        const clone = this.board.toJSON();
        return JSON.stringify({
            features: {
                heartsLocations: this.game.heartsLocations.map((heartPos:AxialCoordinates) => {
                    return [heartPos.q, heartPos.r]
                }),
                actionsLocations: this.game.actionsLocations.map((actionPos:AxialCoordinates) => {
                    return [actionPos.q, actionPos.r]
                })
            },
            grid: {
                ...clone,
                coordinates: clone.coordinates.map((coord:AxialCoordinates & {tank?:Tank, tile?: number}) => {
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
                players.push(hex.tank)
            }
        });
        return players;
    }

}

