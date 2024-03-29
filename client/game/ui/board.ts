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
    p5.stroke('rgb(243,235,173)');
    // p5.noStroke();

    const [...corners] = hex.corners;

    p5.image(
        GameGraphics.tiles[hex.tile],
        corners[4].x + OFFSET.X,
        corners[4].y + OFFSET.Y - HEX_TOP_TRIANGLE_HEIGHT,
        HEX_WIDTH,
        HEX_HEIGHT + 9, // +5 WHY???
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
    let first = true;
    corners.forEach(({x, y}) => {
        p5.vertex(x + OFFSET.X, y + OFFSET.Y);
        if (first) {
            p5.circle(x + OFFSET.X, y + OFFSET.Y, 5)
        }
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
    p5.image(
        GameGraphics.dragonImage,
        hex.corners[0].x - HEX_WIDTH + OFFSET.X,
        hex.corners[0].y + OFFSET.Y - HEX_TOP_TRIANGLE_HEIGHT,
        HEX_WIDTH,
        HEX_HEIGHT + 12
    );
}

function drawLoot(p5: p5, hex: TanksHex) {
    p5.image(
        GameGraphics.lootImage,
        hex.corners[0].x - HEX_WIDTH + OFFSET.X,
        hex.corners[0].y + OFFSET.Y - HEX_TOP_TRIANGLE_HEIGHT,
        HEX_WIDTH,
        HEX_HEIGHT + 12
    );
}

function drawBuilding(p5: p5, hex: TanksHex, building: any) {
    switch (building.type) {

        case 'OASIS':
            p5.image(
                GameGraphics.oasisImage,
                hex.corners[0].x - HEX_WIDTH + OFFSET.X,
                hex.corners[0].y + OFFSET.Y - 10,
                HEX_WIDTH,
                HEX_HEIGHT
            );
            break;

        case 'ICE_FORTRESS':
            p5.image(
                GameGraphics.iceFortressImage,
                hex.corners[0].x - HEX_WIDTH + OFFSET.X,
                hex.corners[0].y + OFFSET.Y - HEX_TOP_TRIANGLE_HEIGHT,
                HEX_WIDTH,
                HEX_HEIGHT + 12
            );
            break;

        case 'CASTLE':
            p5.image(
                GameGraphics.castleImage,
                hex.corners[0].x - HEX_WIDTH + OFFSET.X,
                hex.corners[0].y + OFFSET.Y - HEX_TOP_TRIANGLE_HEIGHT,
                HEX_WIDTH,
                HEX_HEIGHT + 10
            );
            break;

        case 'ORCS_CAMP':
            p5.image(
                GameGraphics.orcsCampImage,
                hex.corners[0].x - HEX_WIDTH + OFFSET.X,
                hex.corners[0].y + OFFSET.Y - HEX_TOP_TRIANGLE_HEIGHT,
                HEX_WIDTH,
                HEX_HEIGHT + 15
            );
            break;
        case 'TELEPORT':
            p5.image(
                GameGraphics.teleportImage,
                hex.corners[0].x - HEX_WIDTH + OFFSET.X,
                hex.corners[0].y + OFFSET.Y - HEX_TOP_TRIANGLE_HEIGHT,
                HEX_WIDTH,
                HEX_HEIGHT + 10
            );
            break
        case 'PIRATES':
            p5.image(
                GameGraphics.piratesImage,
                hex.corners[0].x - HEX_WIDTH + OFFSET.X,
                hex.corners[0].y + OFFSET.Y - HEX_TOP_TRIANGLE_HEIGHT,
                HEX_WIDTH,
                HEX_HEIGHT + 10
            );
            break;

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