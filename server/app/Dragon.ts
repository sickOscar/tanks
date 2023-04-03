import {AxialCoordinates} from "honeycomb-grid";
import {Game} from "./game";

export class Dragon {

    id: string;
    position: AxialCoordinates;
    life: number;
    actions: number;

    constructor(
        public game: Game,
        dragonData: {position: AxialCoordinates, life: number, actions: number}
    ) {
        this.id = Math.random().toString(36).substring(2);
        this.position = dragonData.position;
        this.life = dragonData.life;
        this.actions = dragonData.actions !== undefined  ? dragonData.actions : 5;
    }

    static async create(game: Game, position?:AxialCoordinates) {
        let dragonPosition = game.board.getEmptyRandom();
        if (position) {
            dragonPosition = position;
        }
        return new Dragon(game, {
            position: dragonPosition,
            life: 3,
            actions: 5
        });
    }

    serialize() {
        return {
            id: this.id,
            position: this.position,
            life: this.life,
            actions: this.actions
        }
    }

}
