import {
    Buffs,
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
import {root} from "postcss";
import {AxialCoordinates} from "honeycomb-grid";

const POPUP_DELAY = 10;

function drawHealthPopupContent(p5: p5, rectSourceX: number, rectSourceY: number, size: number[], popupXOffset: number) {
    p5.fill('black');
    p5.stroke('white');
    p5.rect(rectSourceX, rectSourceY, size[0], size[1]);

    popupTitleFont(p5);
    p5.text('Pozione di salute', rectSourceX + popupXOffset, rectSourceY + 20);

    popupTextFont(p5);
    p5.text('Muoviti qui per ottenere 1 💓', rectSourceX + popupXOffset, rectSourceY + 40);
}

function drawActionPopupContent(p5: p5, rectSourceX: number, rectSourceY: number, size: number[], popupXOffset: number) {
    p5.fill('black');
    p5.stroke('white');
    p5.rect(rectSourceX, rectSourceY, size[0], size[1]);

    popupTitleFont(p5);
    p5.text('Pozione di forza', rectSourceX + popupXOffset, rectSourceY + 20);

    popupTextFont(p5);
    p5.text('Muoviti qui per ottenere 1 👊', rectSourceX + popupXOffset, rectSourceY + 40);
}

function drawBuildingPopupContent(p5: p5, rectSourceX: number, rectSourceY: number, size: number[], building: { type: string; position: AxialCoordinates }, popupXOffset: number) {
    p5.fill('black');
    p5.stroke('white');
    p5.rect(rectSourceX, rectSourceY, size[0], size[1]);

    popupTitleFont(p5);
    p5.text(BUILDINGS[building.type].name, rectSourceX + popupXOffset, rectSourceY + 20);

    popupTextFont(p5);
    p5.text(BUILDINGS[building.type].description, rectSourceX + popupXOffset, rectSourceY + 40);
}

function drawTilePopupContet(p5: p5, rectSourceX: number, rectSourceY: number, size: number[], hex: any, popupXOffset: number) {
    p5.fill('black');
    p5.stroke('white');
    p5.rect(rectSourceX, rectSourceY, size[0], size[1]);

    popupTitleFont(p5);
    p5.text(TILES[hex.tile].name, rectSourceX + popupXOffset, rectSourceY + 20);

    popupTextFont(p5);
    p5.text(TILES[hex.tile].description, rectSourceX + popupXOffset, rectSourceY + 40);
}

function drawPlayerPopupContent(hex: any, p5: p5, rectSourceX: number, popupXOffset: number, rectSourceY: number, size:number[]) {
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
    // p5.text(`on ${TILES[hex.tile].name}`, rectSourceX + popupXOffset, rectSourceY + 115);

    // buffs
    popupTitleFont(p5);
    if (hex.tank.buffs.has(Buffs.ICE_ARMOR)) {
        p5.text(
            '🧊',
            rectSourceX + 150,
            rectSourceY + 90
        )
    }

    resetFont(p5);
}

function adjustPopupDirection(p5: p5, rectSourceX: number, hex: any, size: number[]) {
    if (p5.mouseX > GameState.WIDTH / 2) {
        rectSourceX = hex.corners[0].x + X_OFFSET - HEX_WIDTH - 10 - size[0];
    }
    return rectSourceX;
}

export function drawPopup(p5: p5) {

    const hex = GameState.localGrid!.pointToHex(
        {x: p5.mouseX - X_OFFSET, y: p5.mouseY - Y_OFFSET},
        {allowOutside: false}
    );

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
    const mediumSize = [200, 100];
    const largeSize = [300, 150];


    if (hover.for < POPUP_DELAY) {
        return;
    }


    let rectSourceX = hex.corners[0].x + X_OFFSET + 10;
    let rectSourceY = hex.corners[0].y + Y_OFFSET - HEX_TOP_TRIANGLE_HEIGHT;

    let size = smallSize;

    let popupXOffset = 15;
    let popupMargin = 5;

    if (GameState.heartsLocations.find(([q, r]) => q === hex.q && r === hex.r)) {

        size = smallSize;

        rectSourceX = adjustPopupDirection(p5, rectSourceX, hex, size);

        drawHealthPopupContent(p5, rectSourceX, rectSourceY, size, popupXOffset);

        size = smallSize;
        drawTilePopupContet(p5, rectSourceX, rectSourceY + smallSize[1] + popupMargin, size, hex, popupXOffset)


    } else if (GameState.actionsLocations.find(([q, r]) => q === hex.q && r === hex.r)) {
        size = smallSize;

        rectSourceX = adjustPopupDirection(p5, rectSourceX, hex, size);

        drawActionPopupContent(p5, rectSourceX, rectSourceY, size, popupXOffset);

        size = smallSize;
        drawTilePopupContet(p5, rectSourceX, rectSourceY + smallSize[1] + popupMargin, size, hex, popupXOffset)


    } else if (GameState.buildings.find(({position}) => position.q === hex.q && position.r === hex.r)) {

        const building = GameState.buildings.find(({position}) => position.q === hex.q && position.r === hex.r);
        if (!building) {
            return
        }
        size = largeSize;

        rectSourceX = adjustPopupDirection(p5, rectSourceX, hex, size);

        drawBuildingPopupContent(p5, rectSourceX, rectSourceY, size, building, popupXOffset);

        size = smallSize;
        drawTilePopupContet(p5, rectSourceX, rectSourceY + largeSize[1] + popupMargin, size, hex, popupXOffset)


    } else if (!hex.tank) {

        // empty

        size = smallSize;

        rectSourceX = adjustPopupDirection(p5, rectSourceX, hex, size);
        drawTilePopupContet(p5, rectSourceX, rectSourceY, size, hex, popupXOffset);



    } else if (hex.tank) {

        size = mediumSize;

        rectSourceX = adjustPopupDirection(p5, rectSourceX, hex, size);
        drawPlayerPopupContent(hex, p5, rectSourceX, popupXOffset, rectSourceY, size);

        size = smallSize;
        drawTilePopupContet(p5, rectSourceX, rectSourceY + mediumSize[1] + popupMargin, size, hex, popupXOffset)

    }

}
