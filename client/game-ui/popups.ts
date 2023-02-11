import {TanksHex} from "../../server/app/board";
import {
    BUILDINGS,
    GameState,
    HEX_TOP_TRIANGLE_HEIGHT,
    HEX_WIDTH,
    hover,
    pictures,
    TILES,
    X_OFFSET,
    Y_OFFSET
} from "../consts";
import p5 from "p5";
import {popupTextFont, popupTitleFont, resetFont} from "../utils";

const POPUP_DELAY = 10;

export function drawPopup(p5: p5) {

    const hex = GameState.localGrid!.pointToHex(
        {x: p5.mouseX - X_OFFSET, y: p5.mouseY - Y_OFFSET},
        {allowOutside: false}
    ) as TanksHex;

    if (!hex) {
        return;
    }


    if (hover.hex && hover.hex.equals({q: hex.q, r: hex.r})) {
        hover.for += 1;
    } else {
        hover.hex = hex;
        hover.for = 0;
    }

    const smallSize = [280, 80];
    const mediumSize = [200, 120];
    const largeSize = [300, 150];


    if (hover.for < POPUP_DELAY) {
        return;
    }


    let rectSourceX = hex.corners[0].x + X_OFFSET + 10;
    let rectSourceY = hex.corners[0].y + Y_OFFSET - HEX_TOP_TRIANGLE_HEIGHT;

    let size = smallSize;

    let popupXOffset = 15;

    if (GameState.heartsLocations.find(([q, r]) => q === hex.q && r === hex.r)) {
        size = smallSize;

        if (p5.mouseX > GameState.WIDTH / 2) {
            rectSourceX = hex.corners[0].x + X_OFFSET - HEX_WIDTH - 10 - size[0];
        }

        p5.fill('black');
        p5.stroke('white');
        p5.rect(rectSourceX, rectSourceY, size[0], size[1]);

        popupTitleFont(p5);
        p5.text('Health potion', rectSourceX + popupXOffset, rectSourceY + 20);

        popupTextFont(p5);
        p5.text('Move here to get one 💓', rectSourceX + popupXOffset, rectSourceY + 40);

    } else if (GameState.actionsLocations.find(([q, r]) => q === hex.q && r === hex.r)) {
        size = smallSize;

        if (p5.mouseX > GameState.WIDTH / 2) {
            rectSourceX = hex.corners[0].x + X_OFFSET - HEX_WIDTH - 10 - size[0];
        }

        p5.fill('black');
        p5.stroke('white');
        p5.rect(rectSourceX, rectSourceY, size[0], size[1]);

        popupTitleFont(p5);
        p5.text('Action potion', rectSourceX + popupXOffset, rectSourceY + 20);

        popupTextFont(p5);
        p5.text('Move here to get one 👊', rectSourceX + popupXOffset, rectSourceY + 40);

    } else if (GameState.buildings.find(({position}) => position.q === hex.q && position.r === hex.r)) {

        const building = GameState.buildings.find(({position}) => position.q === hex.q && position.r === hex.r);
        if (!building) {
            return
        }
        size = largeSize;

        if (p5.mouseX > GameState.WIDTH / 2) {
            rectSourceX = hex.corners[0].x + X_OFFSET - HEX_WIDTH - 10 - size[0];
        }

        p5.fill('black');
        p5.stroke('white');
        p5.rect(rectSourceX, rectSourceY, size[0], size[1]);

        popupTitleFont(p5);
        p5.text(BUILDINGS[building.type].name, rectSourceX + popupXOffset, rectSourceY + 20);

        popupTextFont(p5);
        p5.text(BUILDINGS[building.type].description, rectSourceX + popupXOffset, rectSourceY + 40);

    } else if (!hex.tank) {

        // empty

        size = smallSize;

        if (p5.mouseX > GameState.WIDTH / 2) {
            rectSourceX = hex.corners[0].x + X_OFFSET - HEX_WIDTH - 10 - size[0];
        }

        p5.fill('black');
        p5.stroke('white');
        p5.rect(rectSourceX, rectSourceY, size[0], size[1]);

        popupTitleFont(p5);
        p5.text(TILES[hex.tile].name, rectSourceX + popupXOffset, rectSourceY + 20);

        popupTextFont(p5);
        p5.text(TILES[hex.tile].description, rectSourceX + popupXOffset, rectSourceY + 40);

    } else if (hex.tank) {

        size = mediumSize;

        if (p5.mouseX > GameState.WIDTH / 2) {
            rectSourceX = hex.corners[0].x + X_OFFSET - HEX_WIDTH - 10 - size[0];
        }

        p5.fill('black');
        p5.stroke('white');
        p5.rect(rectSourceX, rectSourceY, size[0], size[1]);

        if (pictures[hex.tank.id]) {
            p5.image(
                pictures[hex.tank.id],
                rectSourceX + popupXOffset,
                rectSourceY + popupXOffset - 5,
                30,
                30
            );
        }

        popupTitleFont(p5);
        p5.text(
            hex.tank.name.split(' ').join("\n"),
            rectSourceX + popupXOffset + 30 + 5,
            rectSourceY + 20
        );

        popupTextFont(p5);

        if (hex.tank.life < 1) {
            p5.text(
                '☠',
                rectSourceX + popupXOffset,
                rectSourceY + 60
            )
        } else {
            p5.text(
                `💓 x ${hex.tank.life}`,
                rectSourceX + popupXOffset,
                rectSourceY + 60
            )

            // actions
            p5.text(
                `👊 x ${hex.tank.actions}`,
                rectSourceX + popupXOffset,
                rectSourceY + 75
            );

            // range

            let rangeModifier = '';
            let tile = GameState.localGrid!.getHex({q: hex.q, r: hex.r})!.tile;
            if (tile === 4) {
                rangeModifier = ' (+1 ⛰️)';
            }

            if (tile === 3) {
                rangeModifier = ' (-1 🌲)';
            }

            p5.text(
                `👁 x ${hex.tank.range} ${rangeModifier}`,
                rectSourceX + popupXOffset,
                rectSourceY + 90
            );
        }


        // terrain
        p5.text(`on ${TILES[hex.tile].name}`, rectSourceX + popupXOffset, rectSourceY + 115);

        resetFont(p5);

    }


}