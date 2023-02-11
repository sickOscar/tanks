import {AxialCoordinates} from "honeycomb-grid";
import {Buffs} from "../consts";

export interface Tank {
    id: string;
    actions: number;
    position: AxialCoordinates;
    life: number;
    range: number;
    name: string;
    picture: string;
    buffs:Set<Buffs>
}