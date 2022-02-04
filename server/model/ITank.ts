import {BoardPosition} from "../app/boardPosition";
import {IGame} from "./IGame";

export interface TankParams {
    id: string,
    position: BoardPosition,
    life: 0 | 1 | 2 | 3,
    actions: number,
    range: 2 | 3,
    name: string;
    picture: string;
}

export interface ITank {
    game: IGame;
    id: string;
    actions: number;
    position: BoardPosition;
    life: number;
    range: number;
    name: string;
    picture: string;
}