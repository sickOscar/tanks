import {AxialCoordinates, Grid} from "honeycomb-grid";
import {TanksHex} from "../server/app/board";
import {Tank} from "./models/Tank";

export interface IBuilding {
    name: string;
    description: string;
}

interface Player {
    id: string;
    [key: string]: any;
}

export const BUILDINGS:{[key:string]: IBuilding} = {
    OASIS: {
        name:  `Oasis`,
        description: `If you are here when actions gets distributed,\n `
    },
    ICE_FORTRESS: {
        name: `Ice Fortress`,
        description: `If you are here when actions gets distributed,\n `
    },
}
export const X_OFFSET = 50;
export const Y_OFFSET = 50;

export const HEX_SIDE = 40;
export const HEX_WIDTH = 2 * (Math.sqrt(3)/2) * HEX_SIDE;
export const HEX_HEIGHT = HEX_SIDE * Math.sqrt(3);
export const HEX_TOP_TRIANGLE_HEIGHT = (Math.sqrt(3) / 2 * HEX_SIDE) / 2

export const TILES = [
    {name: "🌿 Plains", description: "Moving here will cost you 1 👊"},
    {name: "🌊 Water", description: "You cannot move here"},
    {name: "🏜️ Desert", description: "Moving here will cost you 1 👊\nBeing here when action gets distributed\nwill cost you 1 💓"},
    {name: "🌲 Forest", description: "Moving here will cost you 1 👊\nYour range will be decreased by 1\nYour enemies' range to you is decreased by 1"},
    {name: "⛰️ Mountain", description: "Moving here will cost you 2 👊\nYour range will be increased by 1"},
    {name: "🐊 Swamp", description: "Moving here will cost you 1 👊\nWhen here you can Hunt 🏹🐊"},
    {name: "❄️ Ice", description: "Moving here will cost you 2 👊"},
];

export const walkableTiles = [0, 2, 3, 4, 5, 6];

export const States = {
    IDLE: 'idle',
    MOVE: 'move',
    SHOOT: 'shoot',
    GIVE_ACTION: 'give-action',
    UPGRADE: 'upgrade',
    HEAL: 'heal'
}

export const hover:any = {
    hex: null,
    for: 0
}

interface IGameState {
    heartsLocations:[q:number, r:number][],
    actionsLocations:[q:number, r:number][],
    buildings:{type:string, position:AxialCoordinates}[],
    WIDTH: number,
    HEIGHT: number,
    localGrid: Grid<TanksHex> | null,
    players: Player[],
    playerId: string | null,
    activePlayerHover: null | TanksHex,
    player:Tank|null,
    currentState: string,
}
export const GameState:IGameState = {
    heartsLocations: [],
    actionsLocations: [],
    buildings: [],
    WIDTH: 200,
    HEIGHT: 200,
    localGrid: null,
    players: [],
    playerId: null,
    activePlayerHover: null,
    player: null,
    currentState: States.IDLE,
}

interface IGameGraphics {
    maskGraphics: any,
    tiles: any[],
    oasisImage: any,
    iceFortressImage: any,
}

export const GameGraphics:IGameGraphics = {
    maskGraphics: null,
    tiles: [],
    oasisImage: null,
    iceFortressImage: null,
}

// export let heartsLocations:[q:number, r:number][] = [];
// export let actionsLocations:[q:number, r:number][] = [];
// export let buildings:{type:string, position:AxialCoordinates}[] = [];


export const pictures:{[key:string]: any} = {};
