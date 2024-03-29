import {PlayerActions} from "./playerActions";
import db from "../db";
import {AxialCoordinates} from "honeycomb-grid";
import {Game} from "./game";
import {Action} from "./player";
import {TileType} from "./board";
import {FailReason} from "./fail-reason";
import {ActionResult, SuccessMessage} from "./action-result";
import {Dragon} from "./Dragon";
import {LootType} from "./lootType";

const ICE_ARMOR_CHANCE = 0.2;
const ORC_SKIN_CHANCE = 0.2;

export enum Buffs {
    ICE_ARMOR,
    EXPLORER_BOOTS,
    ORC_SKIN,
    PIRATE,
    TERRIFIED,
    RING,
    BRACELET,
    CROWN
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

        const tankPosition = game.board.getEmptyRandom([TileType.DESERT, TileType.MOUNTAIN, TileType.ICE, TileType.LAVA]);
        console.log(`new tankPosition`, tankPosition);
        const tank = new Tank(game, {
            id: userId,
            position: tankPosition,
            name,
            picture
        });

        game.board.addTank(tank);

        await db.query(`
            UPDATE games
            SET board = $1
            WHERE active = true
        `, [game.board.serialize()])

        await game.board.updateOnDb();

        // @ts-ignore
        return tank;
    }

    delete(): void {
        this.game.board.clearCell(this.position.q, this.position.r);
    }

    async die(): Promise<void> {
        this.actions = 0;
    }

    forceMove(q: number, r: number): void {
        this.game.board.moveTankFromTo(this.position, {q, r});
        this.position.q = q;
        this.position.r = r;
    }

    async move(q: number, r: number): Promise<void> {
        const originalPosition = {q: this.position.q, r: this.position.r};
        this.game.board.moveTankFromTo(this.position, {q, r});

        if (this.game.hasHeartOn(q, r)) {
            this.life += 1;
            this.game.clearHeart(q, r)
        }

        if (this.game.hasActionOn(q, r)) {
            this.actions += 1;
            this.game.clearAction(q, r)
        }

        // console.log(`this.game.loot`, this.game.loot)
        const lootHere = this.game.loot.find(loot => {
            return loot.position.q === q && loot.position.r === r && loot.isActive
        })
        if (lootHere) {
            console.log('loot here', lootHere);
            if (lootHere.type === LootType.RING) {
                this.buffs.add(Buffs.RING);
            }
            if (lootHere.type === LootType.BRACELET) {
                this.buffs.add(Buffs.BRACELET);
            }
            if (lootHere.type === LootType.CROWN) {
                this.buffs.add(Buffs.CROWN);
            }
            lootHere.isActive = false;
            lootHere.position = {q: -10, r: -10};
            lootHere.given = true;
        }

        this.position.q = q;
        this.position.r = r;

        await this.game.addAction(this, 'move', {q, r})

        let actionsUsed = 1;
        const tile = this.game.board.getTileAt(q, r);
        const hasBoots = this.buffs.has(Buffs.EXPLORER_BOOTS);
        if ((tile === TileType.MOUNTAIN || tile === TileType.ICE) && !hasBoots) {
            actionsUsed = 2;
        }

        const isTerrified = this.game.dragons.some(dragon => {
            return this.game.board.isInRange(dragon.position, originalPosition, 3);
        })
        if (isTerrified) {
            actionsUsed = actionsUsed + 1;
        }

        this.useAction(actionsUsed);
    }

    async shoot(q: number, r: number): Promise<void> {
        let enemy: Tank | Dragon;
        enemy = this.game.board.getAt(q, r) as Tank;

        if (!enemy) {
            // get dragon
            enemy = this.game.board.getDragonAt(q, r) as Dragon;
        }

        const lifeToRemove = this.buffs.has(Buffs.CROWN) ? 2 : 1;
        enemy.life = Math.max(0, enemy.life - lifeToRemove);

        if (enemy.life === 0) {

            if (enemy instanceof Dragon) {
                console.log(`dragon was killed by ${this.id}`);
                // create loot
                this.game.addLoot(enemy.position);
                this.game.sendMessageToChat(`
⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫

*${this.name.toUpperCase()}* HA APPENA UCCISO UN DRAGO!
Un grande TESORO è stato lasciato sul campo di battaglia!

⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫
            `, 'paladin dragon')
                // remove dragon from the game
                this.game.killDragon(enemy.id);
            }

            if (enemy instanceof Tank) {
                console.log(`${enemy.id} was killed by ${this.id}`);
                this.actions += enemy.actions;

                // if he was on a building, find an adjacent square and move him there
                const buildingInTheSpot = this.game.buildings.find(b => b.position.q === q && b.position.r === r);

                if (buildingInTheSpot) {
                    // make a spiral traversal from the spot and take the first 6 elements
                    // take a random one of them
                    // keep on doing this until you find one free
                    // mve the dead player there
                    const randomHexToMoveInto = this.game.board.getRandomAdjacent(q, r)
                    console.log(`randomHexToMoveInto`, randomHexToMoveInto)
                    if (randomHexToMoveInto) {
                        console.log(`moving ${enemy.id} to ${randomHexToMoveInto.q}, ${randomHexToMoveInto.r}`)
                        // enemy.position = {q: randomHexToMoveInto.q, r: randomHexToMoveInto.r};
                        enemy.forceMove(randomHexToMoveInto.q, randomHexToMoveInto.r);
                    }
                }
                await enemy.die();
                this.game.sendMessageToChat(`
⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫

*${enemy.name.toUpperCase()}* è stato ucciso da *${this.name.toUpperCase()}* (${new Date().toLocaleString()})

⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫⚔🔫
            `, 'shoot')

            }

        }

        await this.game.addAction(this, 'shoot', {q, r}, enemy)

        let actionsToUse = 1;
        // che if dragon nearby
        const isTerrified = this.game.dragons.some(dragon => {
            return this.game.board.isInRange(dragon.position, this.position, 3);
        })
        if (isTerrified) {
            actionsToUse = 2;
        }
        this.useAction(actionsToUse);
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

    async upgrade(): Promise<void> {
        this.range += 1;
        await this.game.addAction(this, 'upgrade')
        let actionsToUse = 3;
        if (this.buffs.has(Buffs.BRACELET)) {
            actionsToUse = 1;
        }
        this.useAction(actionsToUse);
    }

    async heal(q: number, r: number): Promise<void> {
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
        if (castleHere && this.life < 3) {
            actionsToUse = 1;
        }
        if (this.buffs.has(Buffs.RING)) {
            actionsToUse = 1;
        }

        this.useAction(actionsToUse);
    }

    async vote(enemy: Tank): Promise<void> {

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

        if (parseInt(res.rows[0].count) % 3 === 0) {
            enemy.actions += 1;
            await this.game.addAction({id: 'jury'} as Tank, 'give-action', undefined, enemy)
            this.game.sendMessageToChat(`
💥💥💫💥💥💫💥💥💫💥💥💫💥💥💫💥

*Il piano astrale ha aiutato ${enemy.name.toUpperCase()}*

💥💥💫💥💥💫💥💥💫💥💥💫💥💥💫💥
`, 'help')
        }

        await db.query('COMMIT');
    }

    async hasVotedToday(): Promise<boolean> {
        const res = await db.query(`
            SELECT * FROM votes 
            WHERE game = $1 AND voter = $2 AND voted_at = CURRENT_DATE 
        `, [this.game.id, this.id])
        return res.rows.length >= 1;
    }

    asPlayer(): any {
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
            const hasBracelet = this.buffs.has(Buffs.BRACELET);

            if (this.actions >= 3 || (hasBracelet && this.actions >= 1)) {
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


            // check if a dragon is close
            const isTerrified = this.game.dragons.some(dragon => {
                return this.game.board.isInRange(dragon.position, this.position, 3);
            })

            // MOVEMENT TO MOUNTAIN OR ICE
            const tile = this.game.board.getTileAt(q, r);
            const hasBoots = this.buffs.has(Buffs.EXPLORER_BOOTS);
            if ((tile === TileType.MOUNTAIN || tile === TileType.ICE) && !hasBoots) {
                if (this.actions < 2 || (isTerrified && this.actions < 3)) {
                    return {
                        exit: false,
                        failReason: FailReason.NOT_ENOUGH_ACTIONS
                    }
                }
            }

            // TELEPORTATION
            // check if tank is on a rune of teleportation
            // if it is and the destination is another run, teleport
            const runeHere = this.game.buildings.find(building => building.type === 'TELEPORT' && building.position.q === this.position.q && building.position.r === this.position.r);
            const runeThere = this.game.buildings.find(building => building.type === 'TELEPORT' && building.position.q === q && building.position.r === r);
            if (runeHere && runeThere) {
                if (isTerrified && this.actions < 2) {
                    return {
                        exit: false,
                        failReason: FailReason.NOT_ENOUGH_ACTIONS
                    }
                }
                !dryRun && await this.move(q, r);
                return {
                    exit: true,
                    action
                }
            }

            // NORMAL MOVEMENT
            if (this.game.board.isInRange(this.position, boardCell, 1)) {
                if (isTerrified && this.actions < 2) {
                    return {
                        exit: false,
                        failReason: FailReason.NOT_ENOUGH_ACTIONS
                    }
                }
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
            const hasEnemyPlayerOn = this.game.board.isPositionOccupied(q, r);
            const hasDragonOn = this.game.board.isDragonThere(q, r);

            console.log(`hasEnemyPlayerOn, hasDragonOn`, hasEnemyPlayerOn, hasDragonOn)
            if (!hasEnemyPlayerOn && !hasDragonOn) {
                console.log('invalid destination', q, r)
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

                if (enemy && enemy.life > 0) {

                    let successMessage: SuccessMessage | undefined = undefined;

                    const isTerrified = this.game.dragons.some(dragon => {
                        return this.game.board.isInRange(dragon.position, this.position, 3);
                    })
                    if (isTerrified && this.actions < 2) {
                        return {
                            exit: false,
                            failReason: FailReason.NOT_ENOUGH_ACTIONS
                        }
                    }

                    // PIRATE happens in any case, even with armor
                    if (this.buffs.has(Buffs.PIRATE)) {
                        if (enemy.actions > 0) {
                            if (Math.random() <= 0.2) {
                                !dryRun && (() => enemy.actions -= 1)();
                                successMessage = SuccessMessage.PIRATE;
                            }
                        }
                    }

                    if (enemy.buffs.has(Buffs.ICE_ARMOR)) {
                        console.log(`ICE`)
                        if (Math.random() <= ICE_ARMOR_CHANCE) {
                            if (dryRun) {
                                return {
                                    exit: true,
                                    action
                                }
                            } else {
                                await this.failShoot(q, r);
                                return {
                                    exit: false,
                                    failReason: FailReason.ICE_ARMOR,
                                    successMessage
                                }
                            }
                        }
                    }

                    if (enemy.buffs.has(Buffs.ORC_SKIN)) {
                        console.log(`ORC_SKIN`)
                        if (Math.random() <= ORC_SKIN_CHANCE) {
                            if (dryRun) {
                                return {
                                    exit: true,
                                    action
                                }
                            } else {
                                await this.failShoot(q, r);
                                return {
                                    exit: false,
                                    failReason: FailReason.ORC_SKIN,
                                    successMessage
                                }
                            }
                        }
                    }

                    !dryRun && await this.shoot(q, r);
                    action.enemy = this.game.board.getAt(q, r);
                    return {
                        exit: true,
                        action,
                        successMessage
                    }
                }

                const dragonToShoot = this.game.board.getDragonAt(q, r);
                console.log(`dragonToShoot`, dragonToShoot?.position)

                if (dragonToShoot && dragonToShoot.life > 0) {
                    let actionsNeeded = 1;
                    const hasDragonNearby = this.game.dragons.some(dragon => {
                        return this.game.board.isInRange(dragon.position, this.position, 3);
                    });
                    if (hasDragonNearby) {
                        actionsNeeded = actionsNeeded + 1;
                    }
                    if (this.actions < actionsNeeded) {
                        return {
                            exit: false,
                            failReason: FailReason.NOT_ENOUGH_ACTIONS
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

                const hasRing = this.buffs.has(Buffs.RING);

                if ((castleHere && this.life < 3) || hasRing) {
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