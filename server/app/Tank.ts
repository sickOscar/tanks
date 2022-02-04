import {BoardPosition} from "./boardPosition";
import {COLS, ROWS} from "../const";
import {PlayerActions} from "./playerActions";
import db from "../db";
import {ITank, TankParams} from "../model/ITank";
import {IGame} from "../model/IGame";



const DEFAULT_TANK_PARAMS: TankParams = {
    id: Math.random().toString(36).substring(2),
    actions: 1,
    position: new BoardPosition(0, 0),
    life: 3,
    range: 2,
    name: '',
    picture: ''
}

export class Tank implements ITank {
    game:IGame;
    id: string;
    actions: number;
    position: BoardPosition;
    life: number;
    range: number;
    name:string;
    picture:string;

    constructor(game:IGame, params: Partial<TankParams>) {
        this.game = game;
        const opts: TankParams = Object.assign({}, DEFAULT_TANK_PARAMS, params)
        this.id = opts.id;
        this.position = new BoardPosition(opts.position.x, opts.position.y);
        this.actions = opts.actions;
        this.life = opts.life;
        this.range = opts.range;
        this.name = opts.name;
        this.picture = opts.picture;
    }

    static async create(game:IGame, userId:string, name:string, picture:string):Promise<Tank> {

        const tankPosition = game.board.getRandom();
        const tank = new Tank(game, {
            id: userId,
            position: tankPosition,
            name, picture
        });

        game.board.addTank(tank);

        await db.query(`
            UPDATE games SET board = '${game.board.serialize()}' WHERE active = true
        `)

        // @ts-ignore
        return tank;
    }

    delete(): void {
        this.game.board.clearCell(this.position.x, this.position.y);
    }

    async die(): Promise<void> {
        // this.delete();
        this.actions = 0;
    }

    move(x: number, y: number): void {
        this.game.board.moveTankFromTo(this.position, new BoardPosition(x, y));
        this.position.x = x;
        this.position.y = y;
        this.useAction();
    }

    async shoot(x: number, y: number): Promise<void> {
        const enemy: Tank = this.game.board.getAt(x, y);
        enemy.life -= 1;
        if (enemy.life === 0) {
            console.log(`${enemy.id} was killed by ${this.id}`);
            await enemy.die();
        }
        this.useAction();
    }

    giveAction(x: number, y: number): void {
        const enemy: Tank = this.game.board.getAt(x, y);
        enemy.actions += 1;
        this.useAction();
    }

    upgrade() {
        this.range += 1;
        this.useAction(3);
    }

    heal(x:number, y:number) {
        if (this.position.x === x && this.position.y === y) {
            this.life += 1;
        } else {
            const enemy:Tank = this.game.board.getAt(x, y);
            enemy.life += 1;
        }
        this.useAction(3);
    }


    useAction(howMany = 1) {
        this.actions -= howMany;
    }

    async applyAction(action: PlayerActions, cell: { x: number, y: number }): Promise<boolean> {

        if (this.actions <= 0 || this.life <= 0) {
            return false;
        }

        if (action === PlayerActions.UPGRADE) {
            if (this.actions >= 3) {
                this.upgrade()
                return true;
            }
            return false;
        }


        const x = Math.min(COLS - 1, Math.max(cell.x, 0));
        const y = Math.min(ROWS - 1, Math.max(cell.y, 0));

        const boardCell = new BoardPosition(x, y);

        if (action === PlayerActions.MOVE) {
            if (!this.game.board.isPositionValid(x, y)) {
                return false
            }
            if (this.game.board.isPositionOccupied(x, y)) {
                return false;
            }
            if (this.game.board.isInRange(this.position, boardCell, 1)) {
                this.move(x, y);
                return true;
            }
        }

        if (action === PlayerActions.SHOOT) {
            if (!this.game.board.isPositionOccupied(x, y) || !this.game.board.isPositionValid(x, y)) {
                return false;
            }
            // friendly fire
            if (this.position.x === x && this.position.y === y) {
                return false;
            }
            if (this.game.board.isInRange(this.position, boardCell, this.range)) {
                const enemy = this.game.board.getAt(x, y);
                if (enemy.life >= 0) {
                    await this.shoot(x, y);
                    return true;
                }
            }
        }

        if (action === PlayerActions.GIVE_ACTION) {
            if (!this.game.board.isPositionOccupied(x, y) || !this.game.board.isPositionValid(x, y)) {
                return false;
            }
            if (this.position.x === x && this.position.y === y) {
                return false;
            }
            if (this.game.board.isInRange(this.position, boardCell, this.range)) {
                this.giveAction(x, y);
                return true;
            }
        }

        if (action === PlayerActions.HEAL) {

            if (!this.game.board.isPositionValid(x, y)) {
                return false
            }

            if (!this.game.board.isPositionOccupied(x, y)) {
                return false;
            }

            if (this.game.board.isInRange(this.position, boardCell, this.range)) {
                if (this.actions >= 3) {
                    this.heal(x, y);
                    return true
                }
            }

        }



        return false;
    }
}