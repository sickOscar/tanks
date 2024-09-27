
export class DialogueOption {
    text: string;
    nextNode: number;
    conditions: any;

    constructor(text: string, nextNode: number) {
        this.text = text;
        this.nextNode = nextNode;
    }
}
