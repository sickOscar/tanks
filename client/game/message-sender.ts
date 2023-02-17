import {TanksHex} from "../../server/app/board";
import {GameState, States} from "../consts";
import {ActionResult} from "../../server/app/action-result";

export function validateAction(sio: any, hex: TanksHex):Promise<boolean> {

    return new Promise((resolve, reject) => {
        sio.emit('playerevent', GameState.currentState, {q: hex.q, r: hex.r}, 'VALIDATE', (actionResult: ActionResult) => {
            if (actionResult.exit) {
                resolve(true);
            } else {
                reject(false);
                console.log(actionResult.failReason)
            }
        });

    })


}

export function execAction(sio:any, hex:any|null, forcedState?:string):Promise<ActionResult> {
    return new Promise((resolve, reject) => {
        sio.emit('playerevent', forcedState || GameState.currentState, hex, 'EXECUTE', (actionResult: ActionResult) => {
            resolve(actionResult)
        });
    })
}