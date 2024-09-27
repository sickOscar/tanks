import {AxialCoordinates} from "honeycomb-grid";
import {Game} from "./game";

export class NPC {

    id: string;
    position: AxialCoordinates;
    life: number;
    actions: number;
    dialogue: string;

    constructor(
        public game: Game,
        npcData: {position: AxialCoordinates, life: number, actions: number, dialogue:string}
    ) {
        this.id = Math.random().toString(36).substring(2);
        this.position = npcData.position;
        this.life = npcData.life;
        this.actions = npcData.actions !== undefined  ? npcData.actions : 5;
        this.dialogue = npcData.dialogue;
    }

    static async create(game: Game, position:AxialCoordinates, dialogue:string) {
        let npcPosition = game.board.getEmptyRandom();
        if (position) {
            npcPosition = position;
        }
        return new NPC(game, {
            position: npcPosition,
            life: 4,
            actions: 5,
            dialogue: dialogue
        });
    }

    serialize() {
        return {
            id: this.id,
            position: this.position,
            life: this.life,
            actions: this.actions,
            dialogue: this.dialogue
        }
    }

}
