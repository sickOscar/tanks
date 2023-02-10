import {AxialCoordinates} from "honeycomb-grid";
import {GameState, walkableTiles} from "./consts";
import {TanksHex} from "../server/app/board";

export function isInRange(destinationCell:AxialCoordinates, startingCell:AxialCoordinates, range:number, shooting  = false) {
    let finalRange = range;
    if (shooting) {
        const startingTile = GameState.localGrid?.getHex({q: startingCell.q, r: startingCell.r})?.tile;
        const destinationTile = GameState.localGrid?.getHex({q: destinationCell.q, r: destinationCell.r})?.tile;
        if (startingTile === 4) {
            finalRange = range + 1;
        }
        if (startingTile === 3 || destinationTile === 3) {
            finalRange = range - 1;
        }
    }
    return GameState.localGrid!.distance(destinationCell, startingCell) <= finalRange
}

export function isWalkable(hex:TanksHex) {
    return walkableTiles.includes(hex.tile);
}