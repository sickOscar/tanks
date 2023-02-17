import {BOARD_HEIGHT, BOARD_WIDTH, GameState, HEX_SIDE, OFFSET, SCROLL_AREA_WIDTH, States} from "../../consts";
import p5 from 'p5';


export function drawCursor(p5:p5) {

    p5.cursor('default')

    if (GameState.currentState === States.SHOOT) {
        p5.cursor('pointer');
    }

    if (GameState.currentState === States.MOVE) {
        p5.cursor('pointer');
    }

    if (GameState.currentState === States.GIVE_ACTION) {
        p5.cursor('pointer');
    }

    if (GameState.currentState === States.HEAL) {
        p5.cursor('pointer');
    }
}

export function handleViewport(p5:p5) {

    if (p5.mouseY < SCROLL_AREA_WIDTH) {
        OFFSET.Y = Math.min(50, OFFSET.Y + 10)
    }
    if (p5.mouseY > p5.height - SCROLL_AREA_WIDTH) {
        const m = window.innerHeight - BOARD_HEIGHT - HEX_SIDE * 2;
        OFFSET.Y = Math.max(m, OFFSET.Y - 10)
    }
    if (p5.mouseX < SCROLL_AREA_WIDTH) {
        OFFSET.X = Math.min(50, OFFSET.X + 10)
    }
    if (p5.mouseX > p5.width - SCROLL_AREA_WIDTH) {
        const m = window.innerWidth - 500 - BOARD_WIDTH - HEX_SIDE * 2;
        OFFSET.X = Math.max(m, OFFSET.X - 10)
    }

}