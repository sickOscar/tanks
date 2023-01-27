import {BoardPosition} from "./boardPosition";
import {COLS, ROWS} from "../const";
import {PlayerActions} from "./playerActions";
import db from "../db";
import {ITank, TankParams} from "../model/ITank";
import {IGame} from "../model/IGame";
import {IAction} from "../model/IAction";


const DEFAULT_TANK_PARAMS: TankParams = {
    id: Math.random().toString(36).substring(2),
    actions: 0,
    position: new BoardPosition(0, 0),
    life: 3,
    range: 2,
    name: '',
    picture: ''
}

export class Tank implements ITank {
    game: IGame;
    id: string;
    actions: number;
    position: BoardPosition;
    life: number;
    range: number;
    name: string;
    picture: string;

    constructor(game: IGame, params: Partial<TankParams>) {
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

    static async create(game: IGame, userId: string, name: string, picture: string): Promise<Tank> {

        const tankPosition = game.board.getEmptyRandom();
        const tank = new Tank(game, {
            id: userId,
            position: tankPosition,
            name, picture
        });

        game.board.addTank(tank);

        await db.query(`
            UPDATE games
            SET board = '${game.board.serialize()}'
            WHERE active = true
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

    async move(x: number, y: number): Promise<void> {
        this.game.board.moveTankFromTo(this.position, new BoardPosition(x, y));

        if (this.game.hasHeartOn(x, y)) {
            this.life += 1;
            this.game.clearHeart(x, y)
        }

        this.position.x = x;
        this.position.y = y;

        await this.game.addAction(this, 'move', new BoardPosition(x, y))

        this.useAction();
    }

    async shoot(x: number, y: number): Promise<void> {
        const enemy: Tank = this.game.board.getAt(x, y) as Tank;
        enemy.life = Math.max(0, enemy.life - 1);
        if (enemy.life === 0) {
            console.log(`${enemy.id} was killed by ${this.id}`);
            this.actions += enemy.actions;
            await enemy.die();
            this.game.sendMessageToChat(`
⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫

*${enemy.name.toUpperCase()}* WAS KILLED BY *${this.name.toUpperCase()}* (${new Date().toLocaleString()})

⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫
            `, 'shoot');

            await this.game.addAction(this, 'kill', new BoardPosition(x, y), enemy)
        }

        await this.game.addAction(this, 'shoot', new BoardPosition(x, y), enemy)
        this.useAction();
    }

    async giveAction(x: number, y: number): Promise<void> {
        const enemy: Tank = this.game.board.getAt(x, y) as Tank;
        enemy.actions += 1;
        await this.game.addAction(this, 'give-action', new BoardPosition(x, y), enemy)
        this.useAction();
    }

    async upgrade():Promise<void> {
        this.range += 1;
        await this.game.addAction(this, 'upgrade')
        this.useAction(3);
    }

    async heal(x: number, y: number):Promise<void> {
        if (this.position.x === x && this.position.y === y) {
            this.life += 1;
            await this.game.addAction(this, 'heal')
        } else {
            const enemy: Tank = this.game.board.getAt(x, y) as Tank;
            enemy.life += 1;
            await this.game.addAction(this, 'heal', new BoardPosition(x, y), enemy)
        }

        this.useAction(3);
    }

    async vote(enemy:ITank):Promise<void> {

        await db.query('BEGIN');
        await db.query(`
            INSERT INTO votes (game, voter, vote_for)
            VALUES ($1, $2, $3)
        `, [this.game.id, this.id, enemy.id])

        const res = await db.query(`
            SELECT vote_for, COUNT(*) FROM votes
            WHERE game = $1 AND vote_for = $2 AND voted_at = CURRENT_DATE
            GROUP BY vote_for
        `, [this.game.id, enemy.id])

        if (parseInt(res.rows[0].count)%3 === 0) {
            enemy.actions += 1;

            await this.game.addAction({id:'jury'} as Tank, 'give-action', undefined, enemy)
        }

        await db.query('COMMIT');

    }

    async hasVotedToday():Promise<boolean> {
        const res = await db.query(`
            SELECT * FROM votes 
            WHERE game = $1 AND voter = $2 AND voted_at = CURRENT_DATE 
        `, [this.game.id, this.id])
        return res.rows.length >= 1;
    }

    asPlayer():any {
        return {
            id: this.id,
            picture: this.picture,
            name: this.name
        }
    }

    useAction(howMany = 1) {
        this.actions -= howMany;
    }

    async applyAction(action: IAction): Promise<false|IAction> {

        if (action.action === PlayerActions.VOTE) {
            if (!this.game.isInJury(this.asPlayer())) {
                console.log(`not in jury`)
                return false
            }
            if (!action.enemy) {
                console.log('not enemy')
                return false;
            }
            if (action.enemy && action.enemy.life <= 0) {
                console.log('invalid enemy')
                return false;
            }
            if (await this.hasVotedToday()) {
                console.log('has voted today')
                return false;
            }
            await this.vote(action.enemy);
            return action;
        }

        if (this.actions <= 0 || this.life <= 0) {
            return false;
        }

        if (action.action === PlayerActions.UPGRADE) {
            if (this.actions >= 3) {
                await this.upgrade()
                return action;
            }
            return false;
        }

        const dest = action.destination as BoardPosition;
        const x = Math.min(COLS - 1, Math.max(dest.x, 0));
        const y = Math.min(ROWS - 1, Math.max(dest.y, 0));

        const boardCell = new BoardPosition(x, y);

        if (action.action === PlayerActions.MOVE) {
            if (!this.game.board.isPositionValid(x, y)) {
                return false
            }
            if (this.game.board.isPositionOccupied(x, y)) {
                return false;
            }
            if (this.game.board.isInRange(this.position, boardCell, 1)) {
                await this.move(x, y);
                return action;
            }
        }

        if (action.action === PlayerActions.SHOOT) {
            if (!this.game.board.isPositionOccupied(x, y) || !this.game.board.isPositionValid(x, y)) {
                return false;
            }
            // friendly fire
            if (this.position.x === x && this.position.y === y) {
                return false;
            }
            if (this.game.board.isInRange(this.position, boardCell, this.range)) {
                const enemy = this.game.board.getAt(x, y) as Tank;
                if (enemy.life > 0) {
                    await this.shoot(x, y);
                    action.enemy = this.game.board.getAt(x, y);
                    return action;
                }
            }
        }

        if (action.action === PlayerActions.GIVE_ACTION) {
            if (!this.game.board.isPositionOccupied(x, y) || !this.game.board.isPositionValid(x, y)) {
                return false;
            }
            if (this.position.x === x && this.position.y === y) {
                return false;
            }
            if (this.game.board.isInRange(this.position, boardCell, this.range)) {
                action.enemy = this.game.board.getAt(x, y) as Tank;
                if (action.enemy.life > 0) {
                    await this.giveAction(x, y);
                    return action;
                }

            }
        }

        if (action.action === PlayerActions.HEAL) {
            if (!this.game.board.isPositionValid(x, y)) {
                return false
            }
            if (!this.game.board.isPositionOccupied(x, y)) {
                return false;
            }
            if (this.game.board.isInRange(this.position, boardCell, this.range)) {
                if (this.actions >= 3) {
                    await this.heal(x, y);
                    action.enemy = this.game.board.getAt(x, y)
                    return action
                }
            }
        }



        return false;
    }

}
