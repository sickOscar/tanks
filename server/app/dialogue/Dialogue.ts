import {DialogueNode} from './DialogueNode';
import {FailReason} from '../fail-reason';

export class Dialogue {

    static dialogues: any = {
        "MERCHANT": {
            "1": {
                text: "Ciao",
                options: [{
                    text: "Si",
                    node: "2"
                }, {
                    text: "No",
                    node: "3"
                }]
            },
            "2": {
                text: "OK",
                options: {
                    text: "Bye",
                }
            },
            "3": {
                text: "FOOOOOO",
                options: {
                    text: "Bye",
                }
            },
        }
        
    };

    id:string;

    constructor(id:string) {
        this.id = id;
    }

    getNode(dialogue:Dialogue, choice:string):DialogueNode|null {
        const d = Dialogue.dialogues[dialogue.id];
        if (!d) {
            return null;
        }
        if (!d[choice]) {
            return null;
        }
        return d[choice];
    }

    static for(dialogue: Dialogue|null, choice:string):Promise<any> {

        if (!dialogue) {
            return Promise.resolve({
                exit: false,
                failReason: FailReason.INVALID_DIALOGUE
            })
        }

        const node:DialogueNode|null = dialogue.getNode(dialogue, choice);

        if (!node) {
            return Promise.resolve({
                exit: false,
                failReason: FailReason.INVALID_DIALOGUE
            })
        }


        return Promise.resolve({
            exit: true,
            dialogue: {
                id: dialogue.id,
                text: node.text,
                options: node.options            
            }
        });
    }

    static setupDialogues():Promise<boolean> {

        return Promise.resolve(true); 

    }
}
