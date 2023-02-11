import {AxialCoordinates} from "honeycomb-grid";
import {GameState, walkableTiles} from "./consts";
import {TanksHex} from "../server/app/board";
import p5 from "p5";

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

export function resetFont(p5:p5) {
    p5.textSize(12);
    p5.textLeading(16);
    p5.fill('white');
    p5.noStroke();
    p5.textAlign(p5.LEFT);
    p5.textStyle(p5.NORMAL);
}

export function popupTextFont(p5:p5) {
    resetFont(p5);
    p5.textStyle(p5.BOLD);
}

export function popupTitleFont(p5:p5) {
    resetFont(p5);
    p5.textLeading(20);
    p5.textSize(18);
    p5.textStyle(p5.BOLD);
}