import {Player} from "./player";
import db from "../db";
import {Board, TanksHex, TileType} from "./board";
import {Buffs, Tank} from "./Tank";
import axios from "axios";
import {AxialCoordinates} from "honeycomb-grid";

interface Building {
    type: string;
    position: AxialCoordinates;
}

interface GameState {
    board: Board;
    heartsLocations: AxialCoordinates[];
    actionsLocations: AxialCoordinates[];
    buildings: Building[];
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
        position: {q: 8, r:4}
    },
    {
        type: 'ORCS_CAMP',
        position: {q: 7, r: 14}
    }
]

export class Game {

    id: number = 0;
    activePlayers: Player[] = [];
    private state: GameState = {
        board: new Board(this),
        heartsLocations: [],
        actionsLocations: [],
        buildings: DEFAULT_BUILDINGS
    };

    addActivePlayer(player: Player) {
        if (!this.activePlayers.find(p => p.id === player.id)) {
            this.activePlayers.push(player)
        }
    }

    removeActivePlayer(player: Player) {
        this.activePlayers = this.activePlayers.filter(p => p.id !== player.id);
    }

    async loadActive() {
        console.log(`Loading game from database...`)
        let res = await db.query(`SELECT * from games WHERE active = true`)

        if (res.rows.length === 0) {
            console.log(`No active game found, creating a new one...`)
            const emptyBoard = new Board(this).serialize();
            await db.query(`INSERT INTO games (active, board) VALUES (true, $1)`, [emptyBoard])
            res = await db.query(`SELECT * from games WHERE active = true`)
        } else {
            console.log(`Active game found, loading...`)
        }

        const dbBoard = res.rows[0].board;
        this.state.board.load(dbBoard.grid);

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

            console.log(`dbBoard.features.buildings`, dbBoard.features.buildings);
            // controlla che i building siano uguali a quelli di default

            if (dbBoard.features.buildings.length !== DEFAULT_BUILDINGS.length) {

                const removedBuildings = dbBoard.features.buildings
                    .filter((building:Building) => {
                        return !DEFAULT_BUILDINGS.find(dbBuilding => dbBuilding.type === building.type)
                    });

                const addedBuildings = DEFAULT_BUILDINGS
                    .filter(building => {
                        return !dbBoard.features.buildings.find((dbBuilding:Building) => dbBuilding.type === building.type)
                    });

                console.log(`newBuildings`, addedBuildings)
                console.log(`removedBuildings`, removedBuildings)

                if (removedBuildings.length > 0) {
                    this.state.buildings = dbBoard.features.buildings
                        .filter((building:Building) => {
                            return !removedBuildings.find((dbBuilding:Building) => dbBuilding.type === building.type)
                        });
                }

                if (addedBuildings.length > 0) {
                    this.state.buildings = [...dbBoard.features.buildings, ...addedBuildings];
                }

            } else {

                this.state.buildings = dbBoard.features.buildings;
            }

            console.log(`this.state.buildings`, this.state.buildings)
            
        }

        this.id = res.rows[0].id;
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

            if (hex.tile === TileType.SWAMP) {
                const randomChance = Math.random();
                if (randomChance < 0.1) {
                    actionsToGive -= 1;
                }
                if (randomChance > 0.1 && randomChance < 0.2) {
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

    async addAction(actor: Tank, action: string, dest?: AxialCoordinates, enemy?: Tank): Promise<void> {
        const destination = dest ? [dest.q, dest.r] : null;
        const en = enemy ? enemy.id : null;
        await db.query(`
            INSERT INTO events (game, actor, action, destination, enemy) VALUES ($1, $2, $3, $4, $5)
        `, [this.id, actor.id, action, JSON.stringify(destination), en])
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
                                                            "url": "https://tanks-office-ruiner.herokuapp.com"
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

    set board(board: Board) {
        this.state.board = board;
    }
}

