import {IGame} from "./IGame";
import {AxialCoordinates} from "honeycomb-grid";

export interface TankParams {
    id: string,
    position: AxialCoordinates,
    life: number,
    actions: number,
    range: number,
    name: string;
    picture: string;
}

export interface ITank {
    game: IGame;
    id: string;
    actions: number;
    position: AxialCoordinates;
    life: number;
    range: number;
    name: string;
    picture: string;
}