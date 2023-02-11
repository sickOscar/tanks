import {TanksHex} from "../../server/app/board";
import {
    GameGraphics,
    GameState,
    HEX_HEIGHT,
    HEX_SIDE,
    HEX_TOP_TRIANGLE_HEIGHT,
    HEX_WIDTH,
    pictures,
    X_OFFSET,
    Y_OFFSET
} from "../consts";
import p5 from "p5";
import {Point} from "honeycomb-grid";
import {Tank} from "../models/Tank";
import {resetFont} from "../utils";

function drawPlayerPicture(tank: Tank, hex:TanksHex, p5: p5) {
    if (!pictures[tank.id]) {
        return
    }

    const [...corners] = hex.corners;

    const origin = corners[4];
    const originOffset = p5.createVector(origin.x + X_OFFSET, origin.y + Y_OFFSET);
    originOffset.y = originOffset.y - HEX_TOP_TRIANGLE_HEIGHT;


    GameGraphics.maskGraphics.fill('rgba(0,0,0,1)');
    GameGraphics.maskGraphics.beginShape();
    corners.forEach(({x, y}) => {
        GameGraphics.maskGraphics.vertex(x + X_OFFSET - originOffset.x, y + Y_OFFSET - originOffset.y);
    })
    GameGraphics.maskGraphics.endShape(p5.CLOSE);


    pictures[tank.id].mask(GameGraphics.maskGraphics);

    p5.image(
        pictures[tank.id],
        corners[0].x - HEX_WIDTH + X_OFFSET,
        corners[0].y - HEX_TOP_TRIANGLE_HEIGHT + Y_OFFSET,
        HEX_WIDTH,
        HEX_HEIGHT
    );


}

function drawSkull(p5: p5, corners: Point[]) {
    p5.textSize(HEX_SIDE * 1.5);
    p5.textAlign(p5.CENTER);
    p5.noStroke()
    p5.fill('white')
    p5.textStyle('bold');

    p5.text(
        '☠',
        corners[0].x - HEX_WIDTH / 2 + X_OFFSET,
        corners[0].y + HEX_HEIGHT / 2 + Y_OFFSET
    )

    resetFont(p5);
}

export function drawPlayer(p5: p5, hex: TanksHex) {

    if (!GameGraphics.maskGraphics) {
        return;
    }

    const tank = hex.tank;
    if (!tank) {
        return;
    }

    drawPlayerPicture(tank, hex, p5);

    const [...corners] = hex.corners;

    if (tank.life === 0) {
        drawSkull(p5, corners);
    }

    // p5.stroke('black');
    // p5.noFill();
    // p5.beginShape();
    // corners.forEach(({x, y}) => {
    //     p5.vertex(x + X_OFFSET, y + Y_OFFSET);
    // });
    // p5.endShape(p5.CLOSE);

    if (GameState.localGrid!.pointToHex({x: p5.mouseX - X_OFFSET, y: p5.mouseY - Y_OFFSET}).equals({
        q: hex.q,
        r: hex.r
    })) {
        GameState.activePlayerHover = hex;
    }

}