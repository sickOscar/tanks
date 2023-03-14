import {GameState} from "../../consts";
import {Stages} from "../../main";

export function handleHistory() {
    historyButton.addEventListener('click', () => {

        stage = (() => {
            if (stage === Stages.HISTORY) {
                GameState.history = [];
                actionsContainer.classList.remove('hidden');
                return Stages.RUN;
            } else { getJson('/history')
                .then(history => {
                    GameState.history = history;
                    const boardStringified = JSON.stringify(history[GameState.historyIndex].board);
                    updateBoard(boardStringified);
                })
                actionsContainer.classList.add('hidden');

                return Stages.HISTORY;
            }
        })()
    });

}