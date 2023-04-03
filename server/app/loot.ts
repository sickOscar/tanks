import {AxialCoordinates} from "honeycomb-grid";
import {Game} from "./game";
import {LootType} from "./lootType";

export class Loot {

    type: LootType;
    position: AxialCoordinates;
    isActive: boolean = false;
    given: boolean = false;

    private constructor(game:Game, position:AxialCoordinates, type:LootType, active:boolean, given:boolean) {
        this.type = type;
        this.position = position
        this.isActive = active;
        this.given = given;
    }

    static create(game: Game, position:AxialCoordinates, type:LootType, isActive:boolean = false, given:boolean = false) {
        return new Loot(game, position, type, isActive, given);
    }

    serialize() {
        return {
            type: this.type,
            position: this.position,
            isActive: this.isActive,
            given: this.given
        }
    }
}