import {DialogueOption} from './DialogueOption';

export class DialogueNode {
    id: number;
    text: string;
    outcome?: number;
    options: DialogueOption[];
    isExit:boolean;
   
    constructor(id: number, text: string, options: DialogueOption[], isExit:boolean, outcome?: number) {
        this.id = id;
        this.text = text;
        this.options = options;
        this.isExit = isExit;
        this.outcome = outcome;
    }
}
