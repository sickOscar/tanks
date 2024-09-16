import {
    GameGraphics,
    GameState,
    HEX_HEIGHT, HEX,
    HEX_TOP_TRIANGLE_HEIGHT,
    HEX_WIDTH,
    States,
    OFFSET
} from "../../consts";
import {TanksHex} from "../../../server/app/board";
import {drawPlayer} from "./player";
import p5 from "p5";
import {isInRange, isWalkable} from "../../utils";

export function drawBoard(p5: p5) {
    p5.noFill();
    p5.stroke('white');
    GameState.localGrid!.forEach((hex: TanksHex) => {
        drawCell(p5, hex);
    });
}

function drawCell(p5: p5, hex: TanksHex) {
    p5.stroke('white')

    drawEmptyCell(p5, hex);

    if (!hex.tank) {

        if (GameState.heartsLocations) {
            const hasHeart = GameState.heartsLocations.find(loc => {
                return loc[0] === hex.q && loc[1] === hex.r
            })
            if (hasHeart) {
                drawHeart(p5, hex);
            }
        }

        if (GameState.actionsLocations) {
            const hasAction = GameState.actionsLocations.find(loc => {
                return loc[0] === hex.q && loc[1] === hex.r
            })
            if (hasAction) {
                drawAction(p5, hex);
            }
        }

        if (GameState.buildings) {
            const hasBuilding = GameState.buildings.find(building => {
                return building.position.q === hex.q && building.position.r === hex.r
            })
            if (hasBuilding) {
                drawBuilding(p5, hex, hasBuilding);
            }
        }

        if (GameState.dragons) {
            const hasDragon = GameState.dragons.find(dragon => {
                return dragon.position.q === hex.q && dragon.position.r === hex.r
            })
            if (hasDragon) {
                drawDragon(p5, hex);
            }
        }


        if (GameState.loot) {
            const hasLoot = GameState.loot.find(loot => {
                return loot.position.q === hex.q && loot.position.r === hex.r && loot.isActive
            })
            if (hasLoot) {
                drawLoot(p5, hex);
            }
        }


    } else {
        let hasBuilding = undefined;
        let hasDragon = undefined;
        if (GameState.buildings) {
            hasBuilding = GameState.buildings.find(building => {
                return building.position.q === hex.q && building.position.r === hex.r
            })
            if (hasBuilding) {
                drawBuilding(p5, hex, hasBuilding);
            }
        }
        if (GameState.dragons) {
            hasDragon = GameState.dragons.find(dragon => {
                return dragon.position.q === hex.q && dragon.position.r === hex.r
            })
            if (hasDragon) {
                drawDragon(p5, hex);
            }
        }
        drawPlayer(p5, hex, !!hasBuilding || !!hasDragon);
    }

    drawCoordinates(p5, hex);


}

function drawEmptyCell(p5: p5, hex: TanksHex) {
    p5.noFill()
    p5.strokeWeight(2);
    p5.stroke('rgba(243,235,173,0.5)');
    // p5.noStroke();

    const [...corners] = hex.corners;

    const tileImage = GameGraphics.tiles[hex.tile]

    const [x, y, imageWidth, imageHeight] = getImageCoordinates(corners, tileImage)

    p5.image(
        GameGraphics.tiles[hex.tile],
        x,
        y,
        imageWidth,
        imageHeight
    )

    const highlightColor = 'rgba(255, 255, 255, 0.3)'

    const dragonNearby = GameState.dragons.some(dragon => {
        return isInRange(dragon.position, hex, 3)
    })
    if (dragonNearby) {
        p5.fill(`rgba(0, 0, 0, 0.3)`);
    }


    if (GameState.localGrid!.pointToHex({x: p5.mouseX - OFFSET.X, y: p5.mouseY - OFFSET.Y}) === hex) {
        p5.fill(highlightColor);
    } else {
        // p5.fill('rgb(38,91,34)')
    }

    if (GameState.player) {
        if (GameState.currentState === States.MOVE) {
            if (
                isInRange(hex, GameState.player.position, 1)
                && isWalkable(hex)
            ) {
                p5.fill(highlightColor)
            }
        }

        if (GameState.currentState === States.SHOOT) {
            if (isInRange(hex, GameState.player.position, GameState.player.range, true)) {
                p5.fill(highlightColor)
            }
        }

        if (GameState.currentState === States.GIVE_ACTION) {
            if (isInRange(hex, GameState.player.position, GameState.player.range, true)) {
                p5.fill(highlightColor)
            }
        }

        if (GameState.currentState === States.HEAL) {
            if (isInRange(hex, GameState.player.position, GameState.player.range, true)) {
                p5.fill(highlightColor)
            }
        }
    }


    p5.beginShape();
    p5.noStroke();
    let first = true;
    corners.forEach(({x, y}) => {
        p5.vertex(x + OFFSET.X, y + OFFSET.Y);
        // if (first) {
        //     p5.circle(x + OFFSET.X, y + OFFSET.Y, 5)
        // }
        first = false;
    });
    p5.endShape(p5.CLOSE);

}


function drawCoordinates(p5: p5, hex: TanksHex) {
    if (!GameState.debug) return;
    p5.noStroke()
    p5.fill('#fff');
    p5.textSize(10);
    p5.textAlign(p5.CENTER);
    p5.text(
        `q: ${hex.q} r: ${hex.r}`,
        hex.corners[0].x - (HEX_WIDTH / 2) + OFFSET.X,
        hex.corners[0].y + OFFSET.Y
    )
}

function drawDragon(p5: p5, hex: TanksHex) {
    const [centerX, centerY, imageWidth, imageHeight] = getImageCoordinates(hex.corners, GameGraphics.dragonImage)
    p5.image(
        GameGraphics.dragonImage,
        centerX,
        centerY,
        imageWidth,
        imageHeight
    );
}

function drawLoot(p5: p5, hex: TanksHex) {
    const [centerX, centerY, imageWidth, imageHeight] = getImageCoordinates(hex.corners, GameGraphics.lootImage)
    p5.image(
        GameGraphics.lootImage,
        centerX,
        centerY,
        imageWidth,
        imageHeight
    );
}

function drawBuilding(p5: p5, hex: TanksHex, building: any) {

    switch (building.type) {

        case 'OASIS': {
            let [centerX, centerY, imageWidth, imageHeight] = getImageCoordinates(hex.corners, GameGraphics.oasisImage)
            p5.image(
                GameGraphics.oasisImage,
                centerX,
                centerY,
                imageWidth,
                imageHeight
            );
            break;
        } 

        case 'ICE_FORTRESS': {
            const [centerX, centerY, imageWidth, imageHeight] = getImageCoordinates(hex.corners, GameGraphics.iceFortressImage)
            p5.image(
                GameGraphics.iceFortressImage,
                centerX,
                centerY,
                imageWidth,
                imageHeight
            );
            break;
        }

        case 'CASTLE': {
            const [centerX, centerY, imageWidth, imageHeight] = getImageCoordinates(hex.corners, GameGraphics.castleImage) 
            p5.image(
                GameGraphics.castleImage,
                centerX,
                centerY,
                imageWidth,
                imageHeight
            );
            break;
        }

        case 'ORCS_CAMP': {
            const [centerX, centerY, imageWidth, imageHeight] = getImageCoordinates(hex.corners, GameGraphics.orcsCampImage)
            p5.image(
                GameGraphics.orcsCampImage,
                centerX,
                centerY,
                imageWidth,
                imageHeight
            );
            break;
        }

        case 'TELEPORT': {
            const [centerX, centerY, imageWidth, imageHeight] = getImageCoordinates(hex.corners, GameGraphics.teleportImage)
            p5.image(
                GameGraphics.teleportImage,
                centerX,
                centerY,
                imageWidth,
                imageHeight
            );
            break
        }

        case 'PIRATES': {
            const [centerX, centerY, imageWidth, imageHeight] = getImageCoordinates(hex.corners, GameGraphics.piratesImage)
            p5.image(
                GameGraphics.piratesImage,
                centerX,
                centerY,
                imageWidth,
                imageHeight
            );
            break;
        }

        default:
            break;
    }

}

function drawAction(p5: p5, hex: TanksHex) {

    const corners = hex.corners;

    p5.fill('white');
    p5.textSize(HEX.SIDE + 5 * Math.sin(p5.frameCount * 0.1));
    p5.textAlign(p5.CENTER);
    p5.text(
        '👊',
        corners[0].x - HEX_WIDTH / 2 + OFFSET.X,
        corners[0].y + HEX_HEIGHT / 2 + OFFSET.Y
    )
}

function drawHeart(p5: p5, hex: TanksHex) {

    const corners = hex.corners;

    p5.fill('red')
    p5.textSize(HEX.SIDE + 5 * Math.sin(p5.frameCount * 0.1));
    p5.textAlign(p5.CENTER);
    p5.text(
        '💖',
        corners[0].x - HEX_WIDTH / 2 + OFFSET.X,
        corners[0].y + HEX_HEIGHT / 2 + OFFSET.Y
    )
}

// tile is the loaded image
function getImageCoordinates(corners: { x: number, y: number }[], image:any) {

    const scale = HEX_WIDTH / image.width;

    const imageWidth = HEX_WIDTH;
    const imageHeight = image.height * scale;
    
    const x = corners[4].x + OFFSET.X
    const y = corners[2].y + OFFSET.Y - imageHeight

    return [x, y, imageWidth, imageHeight]
}
