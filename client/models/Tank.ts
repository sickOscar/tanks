import {AxialCoordinates} from "honeycomb-grid";

export interface Tank {
    id: string;
    actions: number;
    position: AxialCoordinates;
    life: number;
    range: number;
    name: string;
    picture: string;
}