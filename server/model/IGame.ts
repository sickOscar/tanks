import {Player} from "../app/player";
import {Board} from "../app/board";

export interface GameState {
    board: Board,
    jury:Player[]
}

export interface IGame {
    id:number;
    board:Board;
    activePlayers:Player[];
    addActivePlayer(p:Player):void
    removeActivePlayer(p:Player):void;
    loadActive(dbBoard:any[][]):void
}