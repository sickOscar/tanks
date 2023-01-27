import {Player} from "../app/player";
import {Board} from "../app/board";
import {Tank} from "../app/Tank";
import {ITank} from "./ITank";
import {AxialCoordinates} from "honeycomb-grid";

export interface GameState {
    board: Board;
    heartsLocations:AxialCoordinates[];
}

export interface IGame {
    id:number;
    board:Board;
    heartsLocations:AxialCoordinates[];
    activePlayers:Player[];
    getTodaysPollResults():Promise<{vote_for:string, count:number, name:string, picture:string}[]>
    addActivePlayer(p:Player):void
    removeActivePlayer(p:Player):void;
    loadActive(dbBoard:any[][]):void;
    clearHeart(x:number, y:number):void;
    sendMessageToChat(message:string, botSearch?:string):void;
    addAction(actor:Tank, action:string, destination?:AxialCoordinates, enemy?:ITank):Promise<void>;
    hasHeartOn(x:number, y:number):boolean;
    isInJury(player:Player):boolean;
    getPlayerTank(player:Player):ITank|undefined;
}