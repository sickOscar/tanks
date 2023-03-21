import {GameGraphics, GameState, HistoryState} from "../../consts";

const DEFAULT_ANIMATION_DURATION = 1000;
export function computeAnimations(parsedMessage:any) {

    const lastMessage = (() => {
        if (GameState.historyState === HistoryState.IDLE) {
            return JSON.parse(GameState.lastMessageFromServer!);
        }
        return GameState.history[GameState.historyIndex - 1].board;
    })();
    // console.log(`lastMessage.grid`, lastMessage.grid)
    // console.log(`parsedMessage.grid`, parsedMessage.grid)

    const prevCoord = lastMessage.grid.coordinates;
    const nextCoord = parsedMessage.grid.coordinates;

    const initDiffing = () => {
        GameState.diffing = GameState.diffing || {
            lostAction: [],
            gainedAction: [],
            lostLife: [],
            gainedLife: [],
        }
    }

    for (let i = 0; i < prevCoord.length; i++) {
        const prev = prevCoord[i];
        const next = nextCoord[i];

        // somebody moved here
        if (!prev.tank && next.tank) {
            // find out who in nexCoord
            const tank = next.tank;
            // find out where in prevCoord
            const movedFrom = prevCoord.find((hex: any) => hex.tank && hex.tank.id === tank.id);
            initDiffing();
            GameState.diffing!.lostAction.push(next);
        }


        // somebody here loose 1 life
        if (prev.tank && next.tank && prev.tank.life > next.tank.life) {
            initDiffing();
            GameState.diffing!.lostLife.push(next);
        }

        // somebody gained 1 action
        if (prev.tank && next.tank && prev.tank.actions < next.tank.actions) {
            initDiffing();
            GameState.diffing!.gainedAction.push(next);
        }

        // somebody lost 1 action
        if (prev.tank && next.tank && prev.tank.actions > next.tank.actions) {
            initDiffing();
            GameState.diffing!.lostAction.push(next);
        }


        // somebody gained a life
        if (prev.tank && next.tank && prev.tank.life < next.tank.life) {
            initDiffing();
            GameState.diffing!.gainedLife.push(next);
        }

    }

    if (!GameState.diffing) return;
    console.log('diffing', GameState.diffing);

    // action up
    for (const actionUp of GameState.diffing.gainedAction) {
        console.log('add Action UP')
        GameGraphics.animations.push({
            type: `UP_ACTION`,
            startedAt: Date.now(),
            duration: DEFAULT_ANIMATION_DURATION,
            hex: actionUp
        });
    }

    // action down
    for (const actionDown of GameState.diffing.lostAction) {
        console.log('add acitron  dionw')
        GameGraphics.animations.push({
            type: `DOWN_ACTION`,
            startedAt: Date.now(),
            duration: DEFAULT_ANIMATION_DURATION,
            hex: actionDown
        });
    }

    // life up
    for (const lifeUp of GameState.diffing.gainedLife) {
        GameGraphics.animations.push({
            type: `UP_LIFE`,
            startedAt: Date.now(),
            duration: DEFAULT_ANIMATION_DURATION,
            hex: lifeUp
        });
    }

    // life down
    for (const lifeDown of GameState.diffing.lostLife) {
        GameGraphics.animations.push({
            type: `DOWN_LIFE`,
            startedAt: Date.now(),
            duration: DEFAULT_ANIMATION_DURATION,
            hex: lifeDown
        });
    }


    GameState.diffing = null;
}