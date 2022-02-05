import {ITank} from "./ITank";
import {BoardPosition} from "../app/boardPosition";
import {PlayerActions} from "../app/playerActions";

export interface IAction {
    actor:ITank;
    enemy?:ITank;
    destination?:BoardPosition;
    created_at:Date;
    action:PlayerActions;
}