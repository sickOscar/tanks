import {GameGraphics, GameState, Animation, OFFSET, HEX_WIDTH} from "../../consts";
import p5 from "p5";

export function drawAnimations(p5:p5) {


    // console.log('animations', GameGraphics.animations);
    // draw animations
    for (const animation of GameGraphics.animations) {
        if (animation.type === `UP_ACTION`) {
            drawUpAction(p5, animation);
        }
        if (animation.type === `DOWN_ACTION`) {
            drawDownAction(p5, animation);
        }
        if (animation.type === `UP_LIFE`) {
            drawUpLife(p5, animation);
        }
        if (animation.type === `DOWN_LIFE`) {
            drawDownLife(p5, animation);
        }
    }

    // clean ended animations
    GameGraphics.animations = GameGraphics.animations.filter(animation => {
        return Date.now() - animation.startedAt < animation.duration;
    });

}

function drawUpAction(p5: p5, animation: Animation) {
    const progress = (Date.now() - animation.startedAt) / animation.duration;
    const hex = GameState.localGrid?.getHex(animation.hex)!;
    const circlePostionX = hex.corners[0].x + OFFSET.X - HEX_WIDTH / 2;
    const circlePostionY = hex.corners[0].y + OFFSET.Y;
    p5.fill('#00ff00');
    p5.noStroke();
    p5.textStyle("bold")
    p5.textSize(40);
    p5.textAlign("center");
    p5.text(`+1 👊`, circlePostionX, circlePostionY - progress * 10);
}
function drawDownAction(p5: p5, animation: Animation) {
    const progress = (Date.now() - animation.startedAt) / animation.duration;
    const hex = GameState.localGrid?.getHex(animation.hex)!;
    const circlePostionX = hex.corners[0].x + OFFSET.X - HEX_WIDTH / 2;
    const circlePostionY = hex.corners[0].y + OFFSET.Y;
    p5.fill('#ff0000');
    p5.noStroke();
    p5.textStyle("bold")
    p5.textSize(40);
    p5.textAlign("center");
    p5.text(`-1 👊`, circlePostionX, circlePostionY - progress * 10);
}
function drawUpLife(p5: p5, animation: Animation) {
    const progress = (Date.now() - animation.startedAt) / animation.duration;
    const hex = GameState.localGrid?.getHex(animation.hex)!;
    const circlePostionX = hex.corners[0].x + OFFSET.X - HEX_WIDTH / 2;
    const circlePostionY = hex.corners[0].y + OFFSET.Y;
    p5.fill('#00ff00');
    p5.noStroke();
    p5.textStyle("bold")
    p5.textSize(40);
    p5.textAlign("center");
    p5.text(`+1 ❤️`, circlePostionX, circlePostionY - progress * 10);
}
function drawDownLife(p5: p5, animation: Animation) {
    const progress = (Date.now() - animation.startedAt) / animation.duration;
    const hex = GameState.localGrid?.getHex(animation.hex)!;
    const circlePostionX = hex.corners[0].x + OFFSET.X - HEX_WIDTH / 2;
    const circlePostionY = hex.corners[0].y + OFFSET.Y;
    p5.fill('#ff0000');
    p5.noStroke();
    p5.textStyle("bold")
    p5.textSize(40);
    p5.textAlign("center");
    p5.text(`-1 ❤️`, circlePostionX, circlePostionY - progress * 10);
}