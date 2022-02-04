import {Player} from "../app/player";
import {Board} from "../app/board";
import {BoardPosition} from "../app/boardPosition";

export interface GameState {
    board: Board;
    jury:Player[];
    heartLocation:BoardPosition;
}

export interface IGame {
    id:number;
    board:Board;
    heartLocation:BoardPosition;
    activePlayers:Player[];
    addActivePlayer(p:Player):void
    removeActivePlayer(p:Player):void;
    loadActive(dbBoard:any[][]):void;
    clearHeart():Promise<void>
}