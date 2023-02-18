import {PlayerActions} from "./playerActions";
import db from "../db";
import {AxialCoordinates} from "honeycomb-grid";
import {Game} from "./game";
import {Action} from "./player";
import {TileType} from "./board";
import {FailReason} from "./fail-reason";
import {ActionResult} from "./action-result";

const ICE_ARMOR_CHANCE = 0.2;

export enum Buffs {
    ICE_ARMOR,
    EXPLORER_BOOTS
}

interface TankParams {
    id: string;
    actions: number;
    position: AxialCoordinates;
    life: number;
    range: number;
    name: string;
    picture: string;
    buffs: Set<Buffs>
}

const DEFAULT_TANK_PARAMS: TankParams = {
    id: Math.random().toString(36).substring(2),
    actions: 0,
    position: {q: 0, r: 0},
    life: 3,
    range: 2,
    name: '',
    picture: '',
    buffs: new Set<Buffs>()
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
    buffs: Set<Buffs>;

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
        this.buffs = new Set(opts.buffs);
    }

    static async create(game: Game, userId: string, name: string, picture: string): Promise<Tank> {

        const tankPosition = game.board.getEmptyRandom([TileType.DESERT, TileType.MOUNTAIN, TileType.ICE]);
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

        let actionsUsed = 1;
        const tile = this.game.board.getTileAt(q, r);
        if (tile === TileType.MOUNTAIN || tile === TileType.ICE) {
            actionsUsed = 2;
        }

        this.useAction(actionsUsed);
    }

    async shoot(q: number, r: number): Promise<void> {
        const enemy: Tank = this.game.board.getAt(q, r) as Tank;
        enemy.life = Math.max(0, enemy.life - 1);
        if (enemy.life === 0) {
            console.log(`${enemy.id} was killed by ${this.id}`);
            this.actions += enemy.actions;

            // ANCHE I BUFFS VANNO PASSATI ???????????

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

    async failShoot(q: number, r: number): Promise<void> {
        const enemy: Tank = this.game.board.getAt(q, r) as Tank;
        await this.game.addAction(this, 'fail-shoot', {q, r}, enemy)
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

        const castleHere = this.game.buildings
            .find(b => b.position.q === q && b.position.r === r && b.type === 'CASTLE')
        let actionsToUse = 3;
        if (castleHere) {
            actionsToUse = 1;
        }

        this.useAction(actionsToUse);
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

    async applyAction(action: Action, dryRun = false): Promise<ActionResult> {

        if (action.action === PlayerActions.VOTE) {
            if (!this.game.isInJury(this.asPlayer())) {
                return {
                    exit: false,
                    failReason: FailReason.NOT_IN_JURY
                }
            }
            if (!action.enemy) {
                return {
                    exit: false,
                    failReason: FailReason.NOT_ENEMY
                }
            }
            if (action.enemy && action.enemy.life <= 0) {
                return {
                    exit: false,
                    failReason: FailReason.INVALID_ENEMY
                }
            }
            if (await this.hasVotedToday()) {
                return {
                    exit: false,
                    failReason: FailReason.ALREADY_VOTED
                }
            }
            await this.vote(action.enemy);
            return {
                exit: true,
                action
            };
        }

        if (this.actions <= 0 || this.life <= 0) {
            return {
                exit: false,
                failReason: FailReason.NOT_ENOUGH_ACTIONS
            }
        }

        if (action.action === PlayerActions.UPGRADE) {
            if (this.actions >= 3) {
                !dryRun && await this.upgrade();
                return {
                    exit: true,
                    action
                }
            }
            return {
                exit: false,
                failReason: FailReason.NOT_ENOUGH_ACTIONS
            };
        }

        const dest = action.destination as AxialCoordinates;
        const q = dest.q;
        const r = dest.r;

        const boardCell = {q, r};

        if (action.action === PlayerActions.MOVE) {
            if (!this.game.board.isPositionWalkable(q, r)) {
                return {
                    exit: false,
                    failReason: FailReason.INVALID_DESTINATION
                }
            }
            if (!this.game.board.isPositionValid(q, r)) {
                return {
                    exit: false,
                    failReason: FailReason.INVALID_DESTINATION
                }
            }
            if (this.game.board.isPositionOccupied(q, r)) {
                return {
                    exit: false,
                    failReason: FailReason.INVALID_DESTINATION
                }
            }

            const tile = this.game.board.getTileAt(q, r);
            if (tile === TileType.MOUNTAIN || tile === TileType.ICE) {
                if (this.actions < 2) {
                    return {
                        exit: false,
                        failReason: FailReason.NOT_ENOUGH_ACTIONS
                    }
                }
            }
            
            if (this.game.board.isInRange(this.position, boardCell, 1)) {
                !dryRun && await this.move(q, r);
                return {
                    exit: true,
                    action
                }
            } else {
                console.log('not in range --')
            }
        }

        if (action.action === PlayerActions.SHOOT) {
            if (!this.game.board.isPositionOccupied(q, r) || !this.game.board.isPositionValid(q, r)) {
                return {
                    exit: false,
                    failReason: FailReason.INVALID_DESTINATION
                }
            }
            // friendly fire
            if (this.position.q === q && this.position.r === r) {
                return {
                    exit: false,
                    failReason: FailReason.INVALID_ENEMY
                }
            }

            if (this.game.board.isInRange(this.position, boardCell, this.range, true)) {
                const enemy = this.game.board.getAt(q, r) as Tank;
                if (enemy.life > 0) {

                    console.log(`enemy.buffs`, enemy.buffs)

                    if (enemy.buffs.has(Buffs.ICE_ARMOR)) {
                        console.log(`ICE`)
                        if (Math.random() <= ICE_ARMOR_CHANCE) {
                            if (dryRun) {
                                return {
                                    exit: true,
                                    action
                                }
                            } else  {
                                await this.failShoot(q, r);
                                return {
                                    exit: false,
                                    failReason: FailReason.ICE_ARMOR
                                }
                            }
                        }
                    }

                    !dryRun && await this.shoot(q, r);
                    action.enemy = this.game.board.getAt(q, r);
                    return {
                        exit: true,
                        action
                    }
                }
            }
        }

        if (action.action === PlayerActions.GIVE_ACTION) {
            if (!this.game.board.isPositionOccupied(q, r) || !this.game.board.isPositionValid(q, r)) {
                return {
                    exit: false,
                    failReason: FailReason.INVALID_DESTINATION
                }
            }
            if (this.position.q === q && this.position.r === r) {
                return {
                    exit: false,
                    failReason: FailReason.INVALID_ENEMY
                }
            }
            if (this.game.board.isInRange(this.position, boardCell, this.range, true)) {
                action.enemy = this.game.board.getAt(q, r) as Tank;
                if (action.enemy.life > 0) {
                    !dryRun && await this.giveAction(q, r);
                    return {
                        exit: true,
                        action
                    }
                }

            }
        }

        if (action.action === PlayerActions.HEAL) {
            if (!this.game.board.isPositionValid(q, r)) {
                return {
                    exit: false,
                    failReason: FailReason.INVALID_DESTINATION
                }
            }
            if (!this.game.board.isPositionOccupied(q, r)) {
                return {
                    exit: false,
                    failReason: FailReason.INVALID_DESTINATION
                }
            }
            if (this.game.board.isInRange(this.position, boardCell, this.range, true)) {


                // check if there is the CASTLE building in this tile
                const castleHere = this.game.buildings
                    .find(b => b.position.q === q && b.position.r === r && b.type === 'CASTLE')

                if (castleHere) {
                    if (this.actions >= 1) {
                        !dryRun && await this.heal(q, r);
                        action.enemy = this.game.board.getAt(q, r)
                        return {
                            exit: true,
                            action
                        }
                    }
                } else if (this.actions >= 3) {
                    !dryRun && await this.heal(q, r);
                    action.enemy = this.game.board.getAt(q, r)
                    return {
                        exit: true,
                        action
                    }
                }
            }
        }

        return {
            exit: false,
            failReason: FailReason.INVALID_ACTION
        }
    }

}