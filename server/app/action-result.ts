import {Action} from "./player";
import {FailReason} from "./fail-reason";

export interface ActionResult {
    exit: boolean;
    action?: Action;
    failReason?: FailReason;
}

export function serializeActionResult(actionResult: ActionResult): ActionResult {

    const serialized = {
        exit: actionResult.exit,
        action: actionResult.action,
        failReason: actionResult.failReason
    }

    if (serialized.action?.actor) {
        serialized.action.actor = {
            ...serialized.action.actor
        }
        delete serialized.action.actor.game;
    }

    if (serialized.action?.enemy) {
        serialized.action.enemy = {
            ...serialized.action.enemy
        }
        delete serialized.action.enemy.game;
    }

    return serialized
}