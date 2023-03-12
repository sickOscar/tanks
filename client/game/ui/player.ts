import {TanksHex} from "../../../server/app/board";
import {
    GameGraphics,
    GameState,
    HEX_HEIGHT,
    HEX,
    HEX_TOP_TRIANGLE_HEIGHT,
    HEX_WIDTH,
    pictures,
    OFFSET
} from "../../consts";
import p5 from "p5";
import {Point} from "honeycomb-grid";
import {Tank} from "../../models/Tank";
import {resetFont} from "../../utils";

function drawPlayerPicture(tank: Tank, hex: TanksHex, p5: p5, hasBuilding: boolean) {
    if (!pictures[tank.id]) {
        return
    }

    const [...corners] = hex.corners;

    const origin = corners[4];
    const originOffset = p5.createVector(origin.x + OFFSET.X, origin.y + OFFSET.Y);
    originOffset.y = originOffset.y - HEX_TOP_TRIANGLE_HEIGHT;

    if (!hasBuilding) {
        GameGraphics.maskGraphics.fill('rgba(0,0,0,1)');
        GameGraphics.maskGraphics.beginShape();
        corners.forEach(({x, y}) => {
            GameGraphics.maskGraphics.vertex(
                x + OFFSET.X - originOffset.x,
                y + OFFSET.Y - originOffset.y
            );
        })
    } else {
        // do a circular mask
        GameGraphics.maskGraphics.fill('rgba(0,0,0,1)');
        GameGraphics.maskGraphics.beginShape();
        GameGraphics.maskGraphics.ellipse(
            originOffset.x - HEX_WIDTH / 2,
            originOffset.y + HEX_HEIGHT / 2,
            HEX_WIDTH,
            HEX_HEIGHT
        );
    }
    GameGraphics.maskGraphics.endShape(p5.CLOSE);


    pictures[tank.id].mask(GameGraphics.maskGraphics);

    const imageWidth = hasBuilding ? HEX_WIDTH / 2 : HEX_WIDTH;
    const imageHeight = hasBuilding ? HEX_HEIGHT / 2 : HEX_HEIGHT;
    const dx = hasBuilding ?
        corners[0].x - HEX_WIDTH / 2 + OFFSET.X - imageWidth / 2
        : corners[0].x - HEX_WIDTH + OFFSET.X;
    const dy = hasBuilding ?
        corners[0].y + HEX_TOP_TRIANGLE_HEIGHT * 2 + OFFSET.Y - imageHeight / 2
        : corners[0].y - HEX_TOP_TRIANGLE_HEIGHT + OFFSET.Y;

    p5.image(
        pictures[tank.id],
        dx,
        dy,
        imageWidth,
        imageHeight
    );

    if (tank.life <= 0) {
        // draw black hexagon
        p5.fill('rgba(0,0,0,0.5)');
        p5.beginShape();
        corners.forEach(({x, y}) => {
            p5.vertex(x + OFFSET.X, y + OFFSET.Y);
        })
        p5.endShape(p5.CLOSE);
    }


}

function drawSkull(p5: p5, corners: Point[]) {
    p5.textSize(HEX.SIDE * 1.4);
    p5.textAlign(p5.CENTER);
    p5.noStroke()
    p5.fill('white')
    // p5.textStyle('bold');
    p5.textStyle('normal')
    p5.text(
        '☠',
        corners[0].x - HEX_WIDTH / 2 + OFFSET.X,
        corners[0].y + HEX_TOP_TRIANGLE_HEIGHT / 2 + HEX_HEIGHT / 2 + OFFSET.Y
    )

    resetFont(p5);
}

export function drawPlayer(p5: p5, hex: TanksHex, hasBuilding: boolean) {
    if (!GameGraphics.maskGraphics) {
        return;
    }

    const tank = hex.tank;
    if (!tank) {
        return;
    }

    drawPlayerPicture(tank, hex, p5, hasBuilding);

    const [...corners] = hex.corners;

    if (tank.life === 0) {
        drawSkull(p5, corners);
    }

    if (GameState.localGrid!.pointToHex({x: p5.mouseX - OFFSET.X, y: p5.mouseY - OFFSET.Y}).equals({
        q: hex.q,
        r: hex.r
    })) {
        GameState.activePlayerHover = hex;
    }

}