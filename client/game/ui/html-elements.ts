import {GameState, States} from "../../consts";

export function setOnline(playersList: string) {

    const playersContainer = document.querySelector('#players-container') as HTMLDivElement;

    try {
        const onlinePlayers = JSON.parse(playersList);

        const listItems = onlinePlayers.map((p: any, i:number) => i < 4 && `
            <img alt="${p.name}" src="${p.picture}" title="${p.name}" class="img-thumbnail">
        `)
        playersContainer.innerHTML = listItems.join('');

    } catch (err) {
        console.error(err)
    }

}

export function drawEvents() {

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

    const markup = GameState.events.map(e => {

        let p = GameState.players.find(p => p.id === e.actor);

        if (!p && e.actor === 'jury') {
            const enemy = GameState.players.find(p => p.id === e.enemy)!
            p = {
                id: '',
                picture: '',
                name: 'jury'
            }
            const pre = `<div class="event">
                    <span class="event-date">${new Date(e.created_at).toLocaleString()}</span>
                    <p>`;

            const post = `</p></div>
            `
            return `${pre}the jury added action to <img src="${enemy.picture}"  title="${enemy.name}" class="img-thumbnail" alt="${enemy.name}">${post}`
        }

        if (!p) {
            return '';
        }

        const pre = `<div class="event">
                    <span class="event-date">${new Date(e.created_at).toLocaleString()}</span>
                    <p>
                        <img src="${p.picture}" title="${p.name}" class="img-thumbnail" alt="${p.name}"> `;

        const post = `</p></div>
            `

        if (e.action === States.MOVE) {
            return `${pre} moved to [${letters[e.destination[0]]}:${e.destination[1]}] ${post}`
        }

        if (e.action === States.UPGRADE) {
            return `${pre} upgraded his range${post}`
        }

        if (e.action === States.SHOOT) {
            const enemy = GameState.players.find(p => p.id === e.enemy)!
            return `${pre} shoots <img src="${enemy.picture}" title="${enemy.name}" class="img-thumbnail" alt="${enemy.name}">${post}`
        }

        if (e.action === States.GIVE_ACTION) {
            const enemy = GameState.players.find(p => p.id === e.enemy)!
            return `${pre} gives an action to <img src="${enemy.picture}"  title="${enemy.name}" class="img-thumbnail" alt="${enemy.name}">${post}`
        }

        if (e.action === States.HEAL) {
            const enemy = GameState.players.find(p => p.id === e.enemy)
            if (enemy) {
                return `${pre} heals <img src="${enemy.picture}"  title="${enemy.name}" class="img-thumbnail" alt="${enemy.name}">${post}`
            }
            return `${pre} heals himself${post}`
        }


    })
    const logsContainer = document.querySelector('#logs-container') as HTMLDivElement;
    logsContainer.innerHTML = markup.join('');
}