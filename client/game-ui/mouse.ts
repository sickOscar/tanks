import {GameState, States} from "../consts";
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