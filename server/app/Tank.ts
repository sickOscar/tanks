import {COLS, ROWS} from "../const";
import {PlayerActions} from "./playerActions";
import db from "../db";
import {AxialCoordinates} from "honeycomb-grid";
import {Game} from "./game";
import {Action} from "./player";



interface TankParams {
    id: string;
    actions: number;
    position: AxialCoordinates;
    life: number;
    range: number;
    name: string;
    picture: string;
}

const DEFAULT_TANK_PARAMS: TankParams = {
    id: Math.random().toString(36).substring(2),
    actions: 0,
    position: {q: 0, r: 0},
    life: 3,
    range: 2,
    name: '',
    picture: ''
}

export class Tank {
    game: Game;
    id: string;
    actions: number;
    position: AxialCoordinates;
    life: number;
    range: number;
    name: string;
    picture: string;

    constructor(game: Game, params: Partial<TankParams>) {
        this.game = game;
        const opts: TankParams = Object.assign({}, DEFAULT_TANK_PARAMS, params)
        this.id = opts.id;
        this.position = opts.position;
        this.actions = opts.actions;
        this.life = opts.life;
        this.range = opts.range;
        this.name = opts.name;
        this.picture = opts.picture;
    }

    static async create(game: Game, userId: string, name: string, picture: string): Promise<Tank> {

        const tankPosition = game.board.getEmptyRandom();
        console.log(`new tankPosition`, tankPosition);
        const tank = new Tank(game, {
            id: userId,
            position: tankPosition,
            name, picture
        });

        game.board.addTank(tank);

        await db.query(`
            UPDATE games
            SET board = $1
            WHERE active = true
        `, [game.board.serialize()])

        // @ts-ignore
        return tank;
    }

    delete(): void {
        this.game.board.clearCell(this.position.q, this.position.r);
    }

    async die(): Promise<void> {
        // this.delete();
        this.actions = 0;
    }

    async move(q: number, r: number): Promise<void> {
        this.game.board.moveTankFromTo(this.position, {q, r});

        if (this.game.hasHeartOn(q, r)) {
            this.life += 1;
            this.game.clearHeart(q, r)
        }

        if (this.game.hasActionOn(q, r)) {
            this.actions += 1;
            this.game.clearAction(q, r)
        }

        this.position.q = q;
        this.position.r = r;

        await this.game.addAction(this, 'move', {q, r})

        this.useAction();
    }

    async shoot(q: number, r: number): Promise<void> {
        const enemy: Tank = this.game.board.getAt(q, r) as Tank;
        enemy.life = Math.max(0, enemy.life - 1);
        if (enemy.life === 0) {
            console.log(`${enemy.id} was killed by ${this.id}`);
            this.actions += enemy.actions;
            await enemy.die();
            this.game.sendMessageToChat(`
⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫

*${enemy.name.toUpperCase()}* WAS KILLED BY *${this.name.toUpperCase()}* (${new Date().toLocaleString()})

⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫
            `, 'shoot')
        }

        await this.game.addAction(this, 'shoot', {q, r}, enemy)
        this.useAction();
    }

    async giveAction(q: number, r: number): Promise<void> {
        const enemy: Tank = this.game.board.getAt(q, r) as Tank;
        enemy.actions += 1;
        await this.game.addAction(this, 'give-action', {q, r}, enemy)
        this.useAction();
    }

    async upgrade():Promise<void> {
        this.range += 1;
        await this.game.addAction(this, 'upgrade')
        this.useAction(3);
    }

    async heal(q: number, r: number):Promise<void> {
        if (this.position.q === q && this.position.r === r) {
            this.life += 1;
            await this.game.addAction(this, 'heal')
        } else {
            const enemy: Tank = this.game.board.getAt(q, r) as Tank;
            enemy.life += 1;
            await this.game.addAction(this, 'heal', {q, r}, enemy)
        }

        this.useAction(3);
    }

    async vote(enemy:Tank):Promise<void> {

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

    async applyAction(action: Action): Promise<false|Action> {

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

        const dest = action.destination as AxialCoordinates;
        const q = dest.q;
        const r = dest.r;

        const boardCell = {q, r};

        if (action.action === PlayerActions.MOVE) {
            if (!this.game.board.isPositionWalkable(q, r)) {
                console.log(`not walkable`)
                return false
            }
            if (!this.game.board.isPositionValid(q, r)) {
                console.log(`not valid`)
                return false
            }
            if (this.game.board.isPositionOccupied(q, r)) {
                console.log(`occupied`)
                return false;
            }
            if (this.game.board.isInRange(this.position, boardCell, 1)) {
                await this.move(q, r);
                return action;
            } else {
                console.log('not in range')
            }
        }

        if (action.action === PlayerActions.SHOOT) {
            if (!this.game.board.isPositionOccupied(q, r) || !this.game.board.isPositionValid(q, r)) {
                return false;
            }
            // friendly fire
            if (this.position.q === q && this.position.r === r) {
                return false;
            }
            if (this.game.board.isInRange(this.position, boardCell, this.range)) {
                const enemy = this.game.board.getAt(q, r) as Tank;
                if (enemy.life > 0) {
                    await this.shoot(q, r);
                    action.enemy = this.game.board.getAt(q, r);
                    return action;
                }
            }
        }

        if (action.action === PlayerActions.GIVE_ACTION) {
            if (!this.game.board.isPositionOccupied(q, r) || !this.game.board.isPositionValid(q, r)) {
                return false;
            }
            if (this.position.q === q && this.position.r === r) {
                return false;
            }
            if (this.game.board.isInRange(this.position, boardCell, this.range)) {
                action.enemy = this.game.board.getAt(q, r) as Tank;
                if (action.enemy.life > 0) {
                    await this.giveAction(q, r);
                    return action;
                }

            }
        }

        if (action.action === PlayerActions.HEAL) {
            if (!this.game.board.isPositionValid(q, r)) {
                return false
            }
            if (!this.game.board.isPositionOccupied(q, r)) {
                return false;
            }
            if (this.game.board.isInRange(this.position, boardCell, this.range)) {
                if (this.actions >= 3) {
                    await this.heal(q, r);
                    action.enemy = this.game.board.getAt(q, r)
                    return action
                }
            }
        }



        return false;
    }

}