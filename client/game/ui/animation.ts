import {GameGraphics, GameState, Animation, OFFSET, HEX_WIDTH, HEX_HEIGHT} from "../../consts";
import p5 from "p5";
import {AnimationType} from "./diffing";

export function clearAnimations() {
    // clean ended animations
    GameGraphics.animations = GameGraphics.animations.filter(animation => {
        return Date.now() - animation.startedAt < animation.duration;
    });
}

export function drawAnimations(p5:p5) {


    // console.log('animations', GameGraphics.animations);
    // draw animations
    for (const animation of GameGraphics.animations) {
        if (animation.type === AnimationType.UP_ACTION) {
            drawMovingText(p5, animation, `+1 👊`, '#00ff00');
        }
        if (animation.type === AnimationType.DOWN_ACTION) {
            drawMovingText(p5, animation, `-1 👊`, '#ff0000');
        }
        if (animation.type === AnimationType.UP_LIFE) {
            drawMovingText(p5, animation, `+1 ❤️`, '#00ff00');
        }
        if (animation.type === AnimationType.DOWN_LIFE) {
            drawMovingText(p5, animation, `-1 ❤️`, '#ff0000');
        }
        if (animation.type === AnimationType.MOVEMENT) {
            drawArrow(p5, animation, '#ffffff');
        }
    }
    clearAnimations();

}

function drawMovingText(p5: p5, animation: Animation, text: string, color: string) {
    const progress = (Date.now() - animation.startedAt) / animation.duration;
    const hex = GameState.localGrid?.getHex(animation.hex!)!;
    const circlePostionX = hex.corners[0].x + OFFSET.X - HEX_WIDTH / 2;
    const circlePostionY = hex.corners[0].y + OFFSET.Y;
    p5.fill(color);
    p5.noStroke();
    p5.textStyle("bold")
    p5.textSize(30);
    p5.textAlign("center");
    p5.text(text, circlePostionX, circlePostionY - progress * 10);
}

function drawArrow(p5: p5, animation: Animation, color: string) {
    const progress = (Date.now() - animation.startedAt) / animation.duration;
    if (!!animation.from && !!animation.to) {
        const startingHex = GameState.localGrid?.getHex(animation.from)!;
        const endingHex = GameState.localGrid?.getHex(animation.to!)!;
        const circlePositionX = startingHex.corners[0].x + OFFSET.X - HEX_WIDTH / 2;
        const circlePositionY = startingHex.corners[5].y + OFFSET.Y + HEX_HEIGHT / 2 + 5;

        const circlePositionX2 = endingHex.corners[0].x + OFFSET.X - HEX_WIDTH / 2;
        const circlePositionY2 = endingHex.corners[5].y + OFFSET.Y + HEX_HEIGHT / 2 + 5;

        p5.stroke(color);
        p5.strokeWeight(7);
        p5.line(
            circlePositionX,
            circlePositionY,
            circlePositionX + (circlePositionX2 - circlePositionX) * progress,
            circlePositionY + (circlePositionY2 - circlePositionY) * progress
        );
    }


}