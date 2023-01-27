import {ITank} from "./ITank";
import {PlayerActions} from "../app/playerActions";
import {AxialCoordinates} from "honeycomb-grid";

export interface IAction {
    actor:ITank;
    enemy?:ITank | null;
    destination?:AxialCoordinates;
    created_at:Date;
    action:PlayerActions;
}