import {AxialCoordinates, Grid} from "honeycomb-grid";
import {Tank} from "./models/Tank";
import {TanksHex} from "../server/app/board";
import {COLS, ROWS} from "../server/const";

export interface IBuilding {
    name: string;
    description: string;
}

interface Player {
    id: string;

    [key: string]: any;
}

export const BUILDINGS: { [key: string]: IBuilding } = {
    OASIS: {
        name: `Oasi`,
        description: `Se ti trovi qui quando le azioni vengono
distribuite, guadagni permanentemente

🥾 STIVALI DELL'ESPLORATORE
Non subisci 💓 da terreno ostile e spendi 
sempre solo 1 👊 per muoverti in qualsiasi
tipo di terreno.
`
    },
    ICE_FORTRESS: {
        name: `Fortezza di ghiaccio`,
        description: `Se ti trovi qui quando le azioni vengono 
distribuite, guadagni permanentemente

🧊 ARMATURA DI GHIACCIO 
Ogni volta che vieni colpito, 20% di possibilità
che il colpo non vada a segno.
`
    },
    CASTLE: {
        name: `Castello`,
        description: `Il castello è il cuore del regno e la 
sede del re. 

❤️‍🩹 CURATORE
Curarti qui costa solo 1 azione. 
Non puoi superare 3 💓 in questo modo.
`
    },
    ORCS_CAMP: {
        name: `Accampamento degli orchi`,
        description: `Se ti trovi qui quando le azioni vengono
distribuite, guadagni permanentemente

👹 PELLE D'ORCO
Ogni volta che vieni colpito, 20% di possibilità
che il colpo non vada a segno.
`
    },
    TELEPORT: {
        name: `Runa del Teletrasporto`,
        description: `Da questa casella, puoi muoverti in ogni
altra Runa di Teletrasporto del regno`
    },
    PIRATES: {
        name: "Covo dei pirati",
        description: `Se ti trovi qui quando le azioni vengono
distribuite, guadagni permanentemente

🏴‍☠️ PIRATA 
Ogni volta che attacchi, 20% di possibilità di
causare -1 👊 al tuo avversario`
    }
}

export const OFFSET = {
    X: 50,
    Y: 100
}

export const HEX = {
    SIDE: 45
}

export const HEX_WIDTH = 2 * (Math.sqrt(3) / 2) * HEX.SIDE;
export const HEX_HEIGHT = HEX.SIDE * Math.sqrt(3);
export const HEX_TOP_TRIANGLE_HEIGHT = (Math.sqrt(3) / 2 * HEX.SIDE) / 2

export const BOARD_HEIGHT = HEX_HEIGHT * COLS - HEX_TOP_TRIANGLE_HEIGHT * COLS;
export const BOARD_WIDTH = HEX_WIDTH * ROWS;

export const TILES = [
    {
        name: "🌿 Pianura",
        description: `Muoversi qui costa 1 👊`
    },
    {name: "🌊 Acqua", description: "Non sai nuotare"},
    {
        name: "🏜️ Deserto",
        description: `Muoverti qui costa 1 👊
Stare qui quando le azioni vengono
distribuite costa 1 💓`
    },
    {
        name: "🌲 Foresta",
        description: `Muoverti qui costa 1 👊
La tua gittata 👁 diminuisce di 1
La gittata 👁 dei nemici verso di te diminuisce 1`
    },
    {
        name: "⛰️ Montagna", description: `Muoverti qui costa 2 👊
Mentre sei qui, la tua gittata 👁 aumenta di 1`
    },
    {
        name: "🐊 Palude",
        description: `Muoverti qui costa 1 👊.
10% di possibilità di avere 1 👊 extra
30% di possibilità di non avere azioni`
    },
    {name: "❄️ Ghiaccio", description: "Muoverti qui costa 2 👊"},
    {
        name: "🌋 La desolazione del drago",
        description: `Muoverti qui costa 1 👊.
Stare qui quando le azioni vengono 
distribuite costa 2 💓`
    }
];

export enum Buffs {
    ICE_ARMOR,
    EXPLORER_BOOTS,
    ORC_SKIN,
    PIRATE,
    TERRIFIED
}

export const BuffsDescriptions = {
    [Buffs.ICE_ARMOR]: {
        name: "Armatura di ghiaccio",
        icon: "🧊",
        description: "Ogni volta che vieni colpito, 20% di possibilità che il colpo non vada a segno."
    },
    [Buffs.EXPLORER_BOOTS]: {
        name: "Stivali dell'esploratore",
        icon: "🥾",
        description: "Non subisci 💓 da terreno ostile e spendi sempre solo 1 👊 per muoverti in qualsiasi tipo di terreno."
    },
    [Buffs.ORC_SKIN]: {
        name: "Pelle d'orco",
        icon: "👹",
        description: "Ogni volta che vieni colpito, 20% di possibilità che il colpo non vada a segno."
    },
    [Buffs.PIRATE]: {
        name: "Pirata",
        icon: "🏴‍☠️",
        description: "Ogni volta che attacchi, 20% di possibilità di causare -1 👊 al tuo avversario"
    },
    [Buffs.TERRIFIED]: {
        name: "Terrorizzato",
        icon: "😱",
        description: "Muoversi e attaccare costa 1 👊 in più"
    }
}

export const walkableTiles = [0, 2, 3, 4, 5, 6];

export const States = {
    IDLE: 'idle',
    MOVE: 'move',
    SHOOT: 'shoot',
    GIVE_ACTION: 'give-action',
    UPGRADE: 'upgrade',
    HEAL: 'heal'
}

export const hover: any = {
    hex: null,
    for: 0
}

export enum HistoryState {
    IDLE,
    RUNNING,
    PAUSED
}

export type Diffing = {
    lostLife: AxialCoordinates[],
    gainedLife: AxialCoordinates[],
    lostAction: AxialCoordinates[],
    gainedAction: AxialCoordinates[]
}

interface IGameState {
    heartsLocations: [q: number, r: number][],
    actionsLocations: [q: number, r: number][],
    buildings: { type: string, position: AxialCoordinates }[],
    dragons: { position: AxialCoordinates, life: number}[],
    loot: { position: AxialCoordinates, type: string }[],
    WIDTH: number,
    HEIGHT: number,
    localGrid: Grid<TanksHex> | null,
    players: Player[],
    playerId: string | null,
    activePlayerHover: null | TanksHex,
    player: Tank | null,
    currentState: string,
    events: any[],
    hasFocus: boolean,
    debug: boolean,
    history: any[],
    historyIndex: number,
    historyState: HistoryState,
    lastMessageFromServer: string | null,
    firstTimeIn: boolean,
    diffing: Diffing | null
}

export const GameState: IGameState = {
    heartsLocations: [],
    actionsLocations: [],
    buildings: [],
    dragons: [],
    loot: [],
    WIDTH: 200,
    HEIGHT: 200,
    localGrid: null,
    players: [],
    playerId: null,
    activePlayerHover: null,
    player: null,
    currentState: States.IDLE,
    events: [],
    hasFocus: true,
    debug: false,
    history: [],
    historyIndex: 0,
    historyState: HistoryState.IDLE,
    lastMessageFromServer: null,
    firstTimeIn: true,
    diffing: null
}

export type Animation = {
    type: string,
    startedAt: number,
    duration: number,
    hex?: AxialCoordinates,
    from?: AxialCoordinates,
    to?: AxialCoordinates,
}

interface IGameGraphics {
    maskGraphics: any,
    tiles: any[],
    oasisImage: any,
    iceFortressImage: any,
    castleImage: any,
    orcsCampImage: any,
    teleportImage: any,
    piratesImage: any,
    dragonImage: any,
    lootImage: any,
    animations: Animation[]
}

export const GameGraphics: IGameGraphics = {
    maskGraphics: null,
    tiles: [],
    oasisImage: null,
    iceFortressImage: null,
    castleImage: null,
    orcsCampImage: null,
    teleportImage: null,
    piratesImage: null,
    dragonImage: null,
    lootImage:null,
    animations: []
}

export const pictures: { [key: string]: any } = {};

export const UI_WIDTH = 400;
export const MAIN_BORDER_HEIGHT = 40;

export const SCROLL_AREA_WIDTH = 100;
