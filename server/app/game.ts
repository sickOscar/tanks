import {Player} from "./player";
import db from "../db";
import {Board, TanksHex, TileType} from "./board";
import {Buffs, Tank} from "./Tank";
import axios from "axios";
import {AxialCoordinates} from "honeycomb-grid";
import {GAME_MAP} from "../const";
import {Dragon} from "./Dragon";
import {Loot} from "./loot";
import {LootType} from "./lootType";

interface Building {
    type: string;
    position: AxialCoordinates;
}

interface GameState {
    board: Board;
    heartsLocations: AxialCoordinates[];
    actionsLocations: AxialCoordinates[];
    buildings: Building[];
    dragons: Dragon[];
    loot: Loot[];
}

const DEFAULT_BUILDINGS: Building[] = [
    {
        type: 'OASIS',
        position: {q: -1, r: 15}
    },
    {
        type: 'ICE_FORTRESS',
        position: {q: 3, r: 0}
    },
    {
        type: 'CASTLE',
        position: {q: 8, r: 4}
    },
    {
        type: 'ORCS_CAMP',
        position: {q: 7, r: 14}
    },
    {
        type: 'TELEPORT',
        position: {q: 0, r: 5}
    },
    {
        type: 'TELEPORT',
        position: {q: 15, r: 3}
    },
    {
        type: 'TELEPORT',
        position: {q: 4, r: 10}
    },
    {
        type: 'TELEPORT',
        position: {q: -4, r: 14}
    },
    {
        type: 'TELEPORT',
        position: {q: 10, r: 13}
    },
    {
        type: 'TELEPORT',
        position: {q: 10, r: 1}
    },
    {
        type: 'PIRATES',
        position: {q: 13, r: 8}
    }
]

export class Game {

    id: number = 0;
    activePlayers: Player[] = [];
    private state: GameState = {
        board: new Board(this),
        heartsLocations: [],
        actionsLocations: [],
        buildings: DEFAULT_BUILDINGS,
        dragons: [],
        loot: []
    };

    addActivePlayer(player: Player) {
        if (!this.activePlayers.find(p => p.id === player.id)) {
            this.activePlayers.push(player)
        }
    }

    removeActivePlayer(player: Player) {
        this.activePlayers = this.activePlayers.filter(p => p.id !== player.id);
    }

    * moveDragons() {
        // add actions to dragons
        for (let dragon of this.state.dragons) {
            dragon.actions = 10;
        }

        const doMovement = (dragon: Dragon) => {
            const {q, r} = dragon.position;
            const randomAdj = this.board.getRandomAdjacent(q, r);
            if (randomAdj) {
                dragon.position = randomAdj;
                dragon.actions = dragon.actions - 1
            }
        }

        if (this.state.dragons.length > 0) {

            while (this.state.dragons[0].actions > 0) {
                for (let dragon of this.state.dragons) {
                    doMovement(dragon);
                }
                yield;
            }
        }

    }

    async addBurnedHexesAroundDragons() {
        for (let i = 0; i < this.state.dragons.length; i++) {
            const dragon = this.state.dragons[i];

            const randomAdjacent1 = this.board.getRandomAdjacent(dragon.position.q, dragon.position.r);
            await this.board.burnAt(randomAdjacent1.q, randomAdjacent1.r)
                .catch(err => console.log(err))

            const randomAdjacent2 = this.board.getRandomAdjacent(dragon.position.q, dragon.position.r);
            await this.board.burnAt(randomAdjacent2.q, randomAdjacent2.r)
                .catch(err => console.log(err))
        }
        await this.board.updateOnDb();
    }

    async loadActive() {
        console.log(`Loading game from database...`)
        let res = await db.query(`SELECT * from games WHERE active = true`);

        let firstTime = false;
        let currentMap = GAME_MAP;

        // if it's the firt time, create a new game
        if (res.rows.length === 0) {
            console.log(`No active game found, creating a new one...`)
            const emptyBoard = new Board(this).serialize();
            await db.query(`INSERT INTO games (active, board) VALUES (true, $1)`, [emptyBoard])
            res = await db.query(`SELECT * from games WHERE active = true`)
            // insert map into db (take GAME MAP)
            await db.query(`INSERT INTO maps (map, game) VALUES ($1, $2)`, [{
                map: currentMap
            }, res.rows[0].id]);
            // so che ha zero senso andarsela a riprendere ma dovevo vedere che funzionasse
            let currentMapRes = await db.query(`SELECT * from maps WHERE game = $1`, [res.rows[0].id]);
            currentMap = currentMapRes.rows[0].map.map;
            firstTime = true;
        } else {
            // try to load the existing game and the existing map
            console.log(`Active game found, loading map...`)

            const currentMapRes = await db.query(`SELECT * from maps WHERE game = $1`, [res.rows[0].id]);

            if (currentMapRes.rows.length === 0) {
                // create the map
                console.log(`No map found, creating a new one...`);
                await db.query(`INSERT INTO maps (map, game) VALUES ($1, $2)`, [
                    JSON.stringify({
                        map: currentMap
                    }),
                    res.rows[0].id || 1
                ]);
            } else {
                // load the map
                console.log(`Map found, loading...`);
                currentMap = currentMapRes.rows[0].map.map;
            }
        }

        const dbBoard = res.rows[0].board;
        this.state.board.load(dbBoard.grid, currentMap);

        if (dbBoard.features.heartsLocations) {
            this.state.heartsLocations = dbBoard.features.heartsLocations
                .map((heartPosition: number[]) => ({q: heartPosition[0], r: heartPosition[1]}))
        }

        if (dbBoard.features.actionsLocations) {
            this.state.actionsLocations = dbBoard.features.actionsLocations
                .map((actionPosition: number[]) => ({q: actionPosition[0], r: actionPosition[1]}))
        }

        if (dbBoard.features.buildings) {

            // SYNC BUILDINGS

            const dbBuildingsRes = await db.query(`SELECT * from buildings WHERE game = $1`, [res.rows[0].id]);

            // first time, create row equals to DEFAULT_BUILDINGS
            if (dbBuildingsRes.rows.length === 0) {
                console.log(`No buildings found, creating new ones...`)
                await db.query(`INSERT INTO buildings (game, buildings) VALUES ($1, $2)`, [
                    res.rows[0].id,
                    JSON.stringify({
                        buildings: DEFAULT_BUILDINGS
                    })
                ]);
                this.state.buildings = JSON.parse(JSON.stringify(DEFAULT_BUILDINGS));
            } else {
                // load buildings from database
                console.log(`Buildings found, loading...`)
                this.state.buildings = dbBuildingsRes.rows[0].buildings.buildings;
            }

            console.log(`this.state.buildings`, this.state.buildings)

        }

        if (dbBoard.features.dragons && dbBoard.features.dragons.length > 0) {
            // load dragons from database
            console.log(`Dragons found, loading...`)
            this.state.dragons = dbBoard.features.dragons.map((dragon: any) => {
                return new Dragon(this, dragon);
            })
            firstTime = true;
        } else {
            // create dragons
            console.log(`No dragons found, creating new ones...`)
            const dragons = [];
            const dragonCoords = [
                {q: -1, r: 3},
                {q: 13, r: 11},
                {q: 2, r: 18},
            ]
            for (let i = 0; i < 3; i++) {
                dragons.push(await Dragon.create(this, dragonCoords[i]));
            }
            this.state.dragons = dragons;
            firstTime = true;
        }

        if (dbBoard.features.loot) {

            if (dbBoard.features.loot.length === 0) {
                console.log('No loot found, creating new ones...');
                dbBoard.features.loot = [
                    Loot.create(this, {q: 0, r: 0}, LootType.RING, false, false),
                    Loot.create(this, {q: 0, r: 0}, LootType.BRACELET, false, false),
                    Loot.create(this, {q: 0, r: 0}, LootType.CROWN, false, false),
                ];
                firstTime = true;
            }
            // load loot from database
            console.log(`Loot found, loading...`)
            const loots = dbBoard.features.loot.map((loot: any) => {
                return Loot.create(this, loot.position, loot.type, loot.isActive, loot.given);
            })
            this.state.loot = loots;
        }

        this.id = res.rows[0].id;

        if (firstTime) {
            //  to save the first board state
            await this.board.updateOnDb();
        }
    }

    isInJury(player: Player): boolean {
        let inJury = false;
        this.board.forEach((hex: TanksHex) => {
            if (hex?.tank?.id === player.id && hex.tank.life <= 0) {
                inJury = true;
            }
        })
        return inJury;
    }

    isAlive(player: Player): boolean {
        let isAlive = false;
        this.board.forEach((hex: TanksHex) => {
            const tank = hex?.tank;
            if (tank && tank.id === player.id && tank.life >= 0) {
                isAlive = true
            }
        })
        return isAlive;
    }

    getPlayerTank(player: Player): Tank | undefined {
        let tank: Tank | undefined;
        this.board.forEach((hex: TanksHex) => {
            if (hex?.tank?.id === player.id) {
                tank = hex.tank;
            }
        });
        return tank;
    }

    async distributeActions(): Promise<void> {
        this.board.forEach((hex: TanksHex) => {
            const tank = hex.tank;

            if (!tank) {
                return;
            }

            let actionsToGive = 1;

            const hasBoots = tank.buffs && tank.buffs.has(Buffs.EXPLORER_BOOTS);

            // if tank tile is desert, remove 1 life
            if (hex.tile === TileType.DESERT && !hasBoots) {
                // if tank is in oasis, don't remove life
                const oasis = this.state.buildings.find(building => building.type === 'OASIS' && building.position.q === hex.q && building.position.r === hex.r);
                if (!oasis && tank.life > 0) {
                    tank.life -= 1;
                }
            }

            // if tank is in LAVA, remove 2 life points
            if (hex.tile === TileType.LAVA && !hasBoots) {
                if (tank.life > 0) {
                    tank.life = Math.max(0, tank.life - 2);
                }
            }

            if (hex.tile === TileType.SWAMP) {
                const randomChance = Math.random();
                if (randomChance < 0.3) {
                    actionsToGive -= 1;
                }
                if (randomChance >= 0.3 && randomChance <= 0.4) {
                    actionsToGive += 1;
                }
            }

            // check if tank is in ice fortress
            const iceFortress = this.state.buildings.find(building => building.type === 'ICE_FORTRESS' && building.position.q === hex.q && building.position.r === hex.r);
            if (iceFortress && tank.life > 0) {
                if (!tank.buffs || tank.buffs.constructor.name !== 'Set') {
                    tank.buffs = new Set();
                }
                tank.buffs.add(Buffs.ICE_ARMOR);
            }

            // check if tank is in oasis
            const oasis = this.state.buildings.find(building => building.type === 'OASIS' && building.position.q === hex.q && building.position.r === hex.r);
            if (oasis && tank.life > 0) {
                if (!tank.buffs || tank.buffs.constructor.name !== 'Set') {
                    tank.buffs = new Set();
                }
                tank.buffs.add(Buffs.EXPLORER_BOOTS);
            }

            const orcCamp = this.state.buildings.find(building => building.type === 'ORCS_CAMP' && building.position.q === hex.q && building.position.r === hex.r);
            if (orcCamp && tank.life > 0) {
                if (!tank.buffs || tank.buffs.constructor.name !== 'Set') {
                    tank.buffs = new Set();
                }
                tank.buffs.add(Buffs.ORC_SKIN);
            }

            const pirates = this.state.buildings.find(building => building.type === 'PIRATES' && building.position.q === hex.q && building.position.r === hex.r);
            if (pirates && tank.life > 0) {
                if (!tank.buffs || tank.buffs.constructor.name !== 'Set') {
                    tank.buffs = new Set();
                }
                tank.buffs.add(Buffs.PIRATE);
            }

            if (tank.life > 0) {
                tank.actions += actionsToGive;
            }

        })
        await this.board.updateOnDb();
    }

    async dropHeart(): Promise<void> {
        this.state.heartsLocations.push(this.board.getEmptyRandom());
        await this.board.updateOnDb();
    }

    async dropAction(): Promise<void> {
        this.state.actionsLocations.push(this.board.getEmptyRandom());
        await this.board.updateOnDb()
    }

    clearHeart(q: number, r: number): void {
        const heartIndex = this.heartsLocations.findIndex((heartPos: AxialCoordinates) => {
            return heartPos.q === q && heartPos.r === r
        })
        if (heartIndex > -1) {
            this.state.heartsLocations.splice(heartIndex, 1);
        }
    }

    clearAction(q: number, r: number): void {
        const actionIndex = this.actionsLocations.findIndex((actionPos: AxialCoordinates) => {
            return actionPos.q === q && actionPos.r === r
        })
        if (actionIndex > -1) {
            this.state.actionsLocations.splice(actionIndex, 1);
        }
    }

    async addAction(actor: Tank, action: string, dest?: AxialCoordinates, enemy?: Tank | Dragon): Promise<void> {
        const destination = dest ? [dest.q, dest.r] : null;
        if (enemy instanceof Tank) {
            const en = enemy ? enemy.id : null;
            await db.query(`
            INSERT INTO events (game, actor, action, destination, enemy) VALUES ($1, $2, $3, $4, $5)
        `, [this.id, actor.id, action, JSON.stringify(destination), en])
        }
    }

    async getActions(): Promise<any> {
        const res = await db.query(`
            SELECT * FROM events WHERE game = $1 ORDER BY created_at DESC LIMIT 10 
        `, [this.id])
        return res.rows;
    }

    sendMessageToChat(message: string, botSearch?: string): void {

        if (!process.env.GIPHY_API_KEY || !process.env.GOOGLE_CHAT_WEBHOOK) {
            return;
        }

        // NON CAMBIARE IN ASYNC AWAIT che se fallisce è un casino
        axios.post(
            process.env.GOOGLE_CHAT_WEBHOOK as string,
            {text: message},
            {
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                },
            }
        )
            .then(() => {
                if (botSearch) {
                    const apiKey = process.env.GIPHY_API_KEY
                    axios.get(`https://api.giphy.com/v1/gifs/random?api_key=${apiKey}&tag=${botSearch}`)
                        .then(response => {
                            axios.post(
                                process.env.GOOGLE_CHAT_WEBHOOK as string,
                                {
                                    cards: [{
                                        sections: [{
                                            widgets: [{
                                                image: {
                                                    imageUrl: response.data.data.images.downsized.url,
                                                    onClick: {
                                                        openLink: {
                                                            "url": `${process.env.MAIN_DOMAIN}`
                                                        }
                                                    }
                                                }
                                            }]
                                        }]
                                    }]
                                },
                                {
                                    headers: {
                                        'Content-Type': 'application/json; charset=UTF-8',
                                    },
                                }
                            )
                                .then(() => {
                                    console.log(`Sent message: /random ${botSearch}`);
                                })
                                .catch(err => {
                                    console.log(`err`, err)
                                })

                        })
                        .catch(err => {
                            console.log(`err`, err)
                        })
                }
            })
    }

    getPlayers(): any[] {
        return this.board.getPlayers().map(t => {
            return t.asPlayer()
        })
    }

    getPeopleOnline(): any[] {
        return this.activePlayers;
    }

    async getTodaysPollResults(): Promise<{ vote_for: string, count: number, name: string, picture: string }[]> {
        const results = await db.query(`
            SELECT vote_for, COUNT(*) as count FROM votes 
            WHERE voted_at = CURRENT_DATE
            GROUP BY vote_for
            ORDER BY count DESC
            
        `)
        const gamePlayers = this.getPlayers();
        return results.rows.map((res: { vote_for: string, count: string }) => {
            const player = gamePlayers.find(p => p.id === res.vote_for)
            return {
                vote_for: res.vote_for,
                count: +res.count,
                name: player.name,
                picture: player.picture
            }
        })
    }

    hasHeartOn(x: number, y: number): boolean {
        return !!this.heartsLocations.find((heartPos: AxialCoordinates) => {
            return heartPos.q === x && heartPos.r === y;
        })
    }

    hasActionOn(x: number, y: number): boolean {
        return !!this.actionsLocations.find((actionPos: AxialCoordinates) => {
            return actionPos.q === x && actionPos.r === y;
        })
    }

    hasBuildingOn(x: number, y: number): boolean {
        return !!this.buildings.find((building: Building) => {
            return building.position.q === x && building.position.r === y;
        })
    }

    get heartsLocations(): AxialCoordinates[] {
        return this.state.heartsLocations;
    }

    get actionsLocations(): AxialCoordinates[] {
        return this.state.actionsLocations;
    }

    get board(): Board {
        return this.state.board;
    }

    get buildings(): Building[] {
        return this.state.buildings;
    }

    get dragons(): Dragon[] {
        return this.state.dragons;
    }

    set board(board: Board) {
        this.state.board = board;
    }

    get loot(): Loot[] {
        return this.state.loot;
    }

    killDragon(id: string) {
       this.state.dragons = this.state.dragons.filter(d => d.id !== id);
    }

    addLoot(position: AxialCoordinates) {

        for (let i = 0; i < 3; i++) {
            if (!this.loot[i].isActive && !this.loot[i].given) {
                this.loot[i].isActive = true;
                this.loot[i].position = position;
                return;
            }
        }

    }
}

