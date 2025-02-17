import {DialogueNode} from './DialogueNode';
import {FailReason} from '../fail-reason';
import fs from 'node:fs';
import yaml from 'yaml';

export class Dialogue {

    static dialogues: any = {
        "MERCHANT": {
            "0": {
                text: "Ciao",
                options: [{
                    text: "Si",
                    next: "3"
                }, {
                    text: "No",
                    next: "2"
                }]
            },
            "1": {
                text: "OK",
                options: [{
                    text: "Bye",
                }]
            },
            "2": {
                text: "FOOOOOO",
                options: [{
                    text: "Bye",
                }]
            },
            "3": {
                text: "BAR",
                outcome: "OUTCOME",
                options: [{
                    text: "END",
                    next: "exit"
                }]
            }
        }
        
    };

    id:string;

    constructor(id:string) {
        this.id = id;
    }

    getNode(dialogue:Dialogue, choice:string|undefined):DialogueNode|null {
        const d = Dialogue.dialogues[dialogue.id];
        if (!d) {
            return null;
        }
        // se non viene passata una scelta, torna root node
        if (!choice) {
            return d["start"]; 
        }
        if (!d[choice]) {
            return null;
        }

        return d[choice];
    }

    static for(dialogue: Dialogue|null, choice:string|undefined):Promise<any> {

        console.log("dialogue", dialogue)
        console.log("choice", choice)

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
                outcome: node.outcome,
                options: node.options
            }
        });
    }

    static setupDialogues():Promise<boolean> {

        console.log("setupDialogues")

        fs.readdirSync('dialogues').forEach(file => {

            const dialogueName = file.split('.')[0];

            const content = fs.readFileSync(`dialogues/${file}`, 'utf8');
            const parsedContent = yaml.parse(content);

            Dialogue.dialogues[dialogueName] = parsedContent;

        });


        return Promise.resolve(true); 
        

    }
}
