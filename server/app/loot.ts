import {AxialCoordinates} from "honeycomb-grid";
import {Game} from "./game";

export enum LootType {
    RING = 'RING',
}

export class Loot {

    type: LootType;
    position: AxialCoordinates;

    private constructor(game:Game, position:AxialCoordinates) {
        this.type = LootType.RING;
        this.position = position;
    }

    static create(game: Game, position:AxialCoordinates) {
        return new Loot(game, position);
    }

    serialize() {
        return {
            type: this.type,
            position: this.position
        }
    }
}