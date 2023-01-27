

let players = [];
const pictures = {};
let events = []

let configFetched = false;

let backgroundImage;
let mouseHoveredCell = [-1, -1];
let activePlayerHover = null;
let sio;

let playerId = null;
let player = null;
let heartsLocations = null;

let localGrid = null;

let stage = 'RUN';

const States = {
    IDLE: 'idle',
    MOVE: 'move',
    SHOOT: 'shoot',
    GIVE_ACTION: 'give-action',
    UPGRADE: 'upgrade',
    HEAL: 'heal'
}

const X_OFFSET = 50;
const Y_OFFSET = 50;

const SQUARE_SIZE = 40;
let WIDTH = 200;
let HEIGHT = 200;

let currentState = States.IDLE;

const voteSelect = document.querySelector('select#vote');
const pollForm = document.querySelector('form#poll');
const showPollResultsButton = document.querySelector('button#show-poll-results')
const actionsContainer = document.querySelector('#actions');
const pollResultsContainer = document.querySelector('#poll-results')
const pollResultsTable = document.querySelector('#poll-results-table')
const modalOverlay = document.querySelector('#modal-overlay');

pollForm.addEventListener('submit', event => {
    event.preventDefault();
    sio.emit('playerevent', 'vote', voteSelect.value, response => {
        if (!response) {
            alert(`Well, no. You already voted today. The blockchain doesn't lie`)
        } else {
            alert('Thank you!')
        }
    })
})

document.addEventListener('click', event => {
    if (Array.from(event.target.classList).includes('close-modal-button')) {
        document.querySelectorAll('.drawer').forEach(el => {
            el.classList.add('d-none');
        })
        modalOverlay.classList.add('d-none');
    }
})

showPollResultsButton.addEventListener('click', event => {
    event.preventDefault();
    pollResultsContainer.classList.remove('d-none');
    modalOverlay.classList.remove('d-none');

    getJson('poll')
        .then(response => {
            pollResultsTable.innerHTML = response.map(row => `
                <tr>
                    <td><img class="img-thumbnail" src="${row.picture}" alt="${row.name}"></td>
                    <td>${row.name}</td>
                    <td>${row.count}</td>
                </tr>
            `).join('')
        })
        .catch(console.error)
})

const titleQuerySelector = ".navbar-brand";

const titleGlitchInterval = 5000;
const titleGlithAnimationDuration = 2000;

function randomNumber(min, max) {
    return Math.random() * (max - min) + min;
}

setInterval(() => {
    const title = document.querySelector(titleQuerySelector);

    title.classList.add("glitched");

    setTimeout(() => {
        title.classList.remove("glitched");
    }, titleGlithAnimationDuration);
}, titleGlitchInterval + randomNumber(-500, 500));



// AUTH

const loginButton = document.querySelector('#btn-login');
const logoutButton = document.querySelector('#btn-logout');

let auth0 = null;
const fetchAuthConfig = () => fetch("/auth_config.json");
const configureClient = async () => {
    const response = await fetchAuthConfig();
    const config = await response.json();

    auth0 = await createAuth0Client({
        domain: config.domain,
        client_id: config.clientId,
        audience: config.audience
    });
};

async function updateLoginUi() {
    const isAuthenticated = await auth0.isAuthenticated();
    loginButton.disabled = isAuthenticated;
    loginButton.style.display = isAuthenticated ? 'none' : 'flex';
    logoutButton.disabled = !isAuthenticated;
    logoutButton.style.display = !isAuthenticated ? 'none' : 'flex';

    if (isAuthenticated) {
        document.querySelector('#board-holder').classList.remove(['d-none']);
        document.querySelector('#right-side').classList.remove(['d-none'])
    } else {
        document.querySelector('#board-holder').classList.add(['d-none']);
        document.querySelector('#right-side').classList.add(['d-none'])
    }

}

window.onload = async () => {
    await configureClient();

    await updateLoginUi();

    const isAuthenticated = await auth0.isAuthenticated();

    if (isAuthenticated) {
        await initCanvas()
        return;
    }

    // NEW - check for the code and state parameters
    const query = window.location.search;
    if (query.includes("code=") && query.includes("state=")) {

        // Process the login state
        await auth0.handleRedirectCallback();

        await updateLoginUi();

        // Use replaceState to redirect the user away and remove the querystring parameters
        window.history.replaceState({}, document.title, "/");

        await initCanvas()
    }
}

function resizeGrid(grid) {
    grid.hexSettings.dimensions = {
        xRadius: SQUARE_SIZE,
        yRadius: SQUARE_SIZE
    }
    return grid;
}

function setupLocalGrid(grid) {
    const resizedGrid = resizeGrid(grid);

    const TanksHex = class extends Honeycomb.defineHex(resizedGrid.hexSettings) {
        tank = null;

        constructor({q, r, tank}) {
            super({q, r});
            this.tank = tank;
        }
    }
    localGrid = new Honeycomb.Grid(TanksHex, resizedGrid.coordinates);
}

async function initCanvas() {

    const c = await getJson('/config');
    configFetched = true;
    setupLocalGrid(c.grid);

    WIDTH = c.cols * SQUARE_SIZE * 2;
    HEIGHT = c.rows * SQUARE_SIZE * 2;
    
    console.log(`WIDTH`, WIDTH)
    console.log(`HEIGHT`, HEIGHT)

    resizeCanvas(WIDTH, HEIGHT);

    const jwt = await auth0.getTokenSilently()
    connectSocket(jwt);


    players = await getJson('/players')
    events = await getJson('/events')

    drawEvents()
}

loginButton.addEventListener('click', () => {
    auth0.loginWithRedirect({
        redirect_uri: window.location.origin
    });
})

logoutButton.addEventListener('click', () => {
    auth0.logout({
        returnTo: window.location.origin
    });
})

function drawEvents() {

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

    const markup = events.map(e => {

        let p = players.find(p => p.id === e.actor);

        if (!p && e.actor === 'jury') {
            const enemy = players.find(p => p.id === e.enemy)
            p = {
                picture: '',
                name: 'jury'
            }
            const pre = `<div class="event">
                    <span class="event-date">${new Date(e.created_at).toLocaleString()}</span>
                    <p>`;

            const post = `</p></div>
            `
            return`${pre}the jury added action to <img src="${enemy.picture}"  title="${enemy.name}" class="img-thumbnail" alt="${enemy.name}">${post}`
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
            const enemy = players.find(p => p.id === e.enemy)
            return `${pre} shoots <img src="${enemy.picture}" title="${enemy.name}" class="img-thumbnail" alt="${enemy.name}">${post}`
        }

        if (e.action === States.GIVE_ACTION) {
            const enemy = players.find(p => p.id === e.enemy)
            return `${pre} gives an action to <img src="${enemy.picture}"  title="${enemy.name}" class="img-thumbnail" alt="${enemy.name}">${post}`
        }

        if (e.action === States.HEAL) {
            const enemy = players.find(p => p.id === e.enemy)
            if (enemy) {
                return `${pre} heals <img src="${enemy.picture}"  title="${enemy.name}" class="img-thumbnail" alt="${enemy.name}">${post}`
            }
            return `${pre} heals himself${post}`

        }


    })
    const logsContainer = document.querySelector('#logs-container')
    logsContainer.innerHTML = markup.join('');
}


function connectSocket(jwt) {
    sio = io('', {
        auth: {
            token: `Bearer ${jwt}`
        }
    });

    sio.on('player', setPlayer)
    // sio.on('message', newMessage);
    sio.on('board', setBoard)
    sio.on('playerslist', setOnline);
    sio.on('action', addPlayerAction)

    sio.on('connect_error', error => {
        console.error(error)
    })
}



const cellInfoContainer = document.querySelector('#cell-info');
const actionButtons = document.querySelectorAll(`#actions  button`);
const playersContainer = document.querySelector('#players-container')

const toggleRulesButton = document.querySelector('#toggle-rules');
const rulesContainer = document.querySelector('#rules');

toggleRulesButton.addEventListener('click', (ev) => {
    ev.preventDefault();
    rulesContainer.classList.remove('d-none');
    modalOverlay.classList.remove('d-none');
})

actionButtons.forEach(el => {
    el.addEventListener('click', function () {

        if (!player) {
            return;
        }

        const state = this.getAttribute('data-action')
        if (!Object.values(States).includes(state)) {
            return
        }

        if (state === States.UPGRADE ) {
            sio.emit('playerevent', States.UPGRADE, null, (isValid) => {
                console.log('upgraded');
            });
        } else {
            if (currentState === state) {
                currentState = States.IDLE
            } else {
                currentState = state;
            }
        }

    })
})


function addPlayerAction(action) {
    events.unshift(action)
    drawEvents();
}

function setBoard(serverMessage) {

    const parsedMessage = JSON.parse(serverMessage);
    console.log(`parsedMessage`, parsedMessage)

    setupLocalGrid(parsedMessage.grid);

    const playersList = [];

    // set local player
    // for (let i = 0; i < config.rows; i++) {
    //     for (let j = 0; j < config.cols; j++ ) {
    //
    //         if (localBoard[i][j]) {
    //             playersList.push(localBoard[i][j]);
    //         }
    //
    //         if (localBoard[i][j]) {
    //             if (!pictures[localBoard[i][j].id]) {
    //                 pictures[localBoard[i][j].id] = loadImage(localBoard[i][j].picture)
    //             }
    //         }
    //
    //         if (localBoard[i][j] && localBoard[i][j].id === playerId) {
    //             player = localBoard[i][j];
    //         }
    //     }
    // }

    localGrid.forEach(hex => {
        if (hex.tank) {
            playersList.push(hex.tank);
        }

        if (hex.tank) {
            if (!pictures[hex.tank.id]) {
                pictures[hex.tank.id] = loadImage(hex.tank.picture)
            }
        }

        if (hex.tank && hex.tank.id === playerId) {
            player = hex.tank;
        }
    })

    if (player && player.life > 0) {
        actionsContainer.classList.remove('d-none');
        pollForm.classList.add('d-none')
    }

    if (player && player.life <= 0) {
        actionsContainer.classList.add('d-none');
        pollForm.classList.remove('d-none')
    }

    voteSelect.innerHTML = playersList
        .filter(p => p.life > 0)
        .map(p => `
            <option value=${p.id}>${p.name}</option>
        `)
        .join('')

    heartsLocations = parsedMessage.features.heartsLocations;

}

function setPlayer(id) {
    playerId = id;
}


function setOnline(playersList) {
    try {
        const onlinePlayers = JSON.parse(playersList);

        const listItems = onlinePlayers.map(p => `
            <li class="list-group-item">
                <img src="${p.picture}"  class="img-thumbnail"> ${p.name}    
            </li>
        `)
        const markup = `
            <ul class="list-group">
                ${listItems.join('')}
            </ul>
        `;
        playersContainer.innerHTML = markup;

    } catch (err) {
        console.error(err)
    }

}

async function getJson(url) {
    const token = await auth0.getTokenSilently();
    return fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    })
        .then(response => response.json())
        .catch(console.error);
}

function preload() {
    backgroundImage = loadImage('tanks.jpg');
}

function setup() {
    const canvas = createCanvas(100, 100);
    canvas.parent('board-holder')
    frameRate(2)
}

function draw() {

    activePlayerHover = null;

    // background('white');
    if (!configFetched || !localGrid) {
        return;
    }

    const mouseCellX = Math.floor(mouseX / SQUARE_SIZE);
    const mouseCellY = Math.floor(mouseY / SQUARE_SIZE)
    mouseHoveredCell = [mouseCellX, mouseCellY];

    if (stage === 'RUN') {
        // background('#3e852e');
        image(backgroundImage, 0, 0);
        drawBoard();
    }

    drawCursor();
    drawPlayerHover();

}

function drawCursor() {

    cursor('default')

    if (currentState === States.SHOOT) {
        cursor('pointer');
    }

    if (currentState === States.MOVE) {
        cursor('pointer');
    }

    if (currentState === States.GIVE_ACTION) {
        cursor('pointer');
    }

    if (currentState === States.HEAL) {
        cursor('pointer');
    }
}

function drawPlayerHover() {
    if (!activePlayerHover) {
        return;
    }


    textAlign(LEFT, TOP)
    noStroke()
    fill('#fff');
    text(activePlayerHover.name,
        activePlayerHover.position.x * SQUARE_SIZE + SQUARE_SIZE - 15 + 5,
        activePlayerHover.position.y * SQUARE_SIZE + (SQUARE_SIZE /2) - 15 + 5
    )

}

function drawBoard() {

    noFill();
    stroke('white');
    

    localGrid.forEach(drawCell)

}


function drawCell(hex) {
    stroke('white')

    if (!hex.tank) {
        drawEmptyCell(hex);

        if (heartsLocations) {
            const hasHeart = heartsLocations.find(loc => {
                return loc[0] === x && loc[1] === y
            })
            if (hasHeart) {
                drawHeart(y, x);
            }
        }

    } else {

        if (hex.tank?.id === playerId) {
            drawPlayer(hex, true);
        } else {
            drawPlayer(hex)
        }
    }

}

function isInRange(cell1, cell2, range) {
    return localGrid.distance(cell1, cell2) <= range
}

function drawHeart(y, x) {
    const rootX = x * SQUARE_SIZE;
    const rootY = y * SQUARE_SIZE;
    fill('red')
    textSize(SQUARE_SIZE / 2);
    textStyle(NORMAL);
    textAlign(CENTER, CENTER)
    text('💖', rootX + SQUARE_SIZE / 2, rootY + SQUARE_SIZE / 2)
}

function drawEmptyCell(hex) {
    noFill()
    strokeWeight(2);

    const highlightColor = 'rgba(84,175,60,0.57)'


    if (currentState === States.MOVE) {
        if(isInRange(hex, player.position, 1)) {
            fill(highlightColor)
        }
    }

    if (currentState === States.SHOOT) {
        if(isInRange(hex, player.position, player.range)) {
            fill(highlightColor)
        }
    }

    if (currentState === States.GIVE_ACTION) {
        if(isInRange(hex, player.position, player.range)) {
            fill(highlightColor)
        }
    }

    if (currentState === States.HEAL) {
        if(isInRange(hex, player.position, player.range)) {
            fill(highlightColor)
        }
    }

    
    // if (mouseHoveredCell[0] === x && mouseHoveredCell[1] === y) {
    //     fill('rgba(255,255,255,0.11)')
    // }

    // square(SQUARE_SIZE * x, SQUARE_SIZE * y, SQUARE_SIZE);

    const [...corners] = hex.corners;
    beginShape();
    corners.forEach(({ x, y }) => {
        vertex(x + X_OFFSET, y + Y_OFFSET);
    });
    endShape(CLOSE);

}

function drawPlayer(hex, isThisSession) {

    fill('white')

    const [...corners] = hex.corners;
    beginShape();
    corners.forEach(({ x, y }) => {
        vertex(x + X_OFFSET, y + Y_OFFSET);
    });
    endShape(CLOSE);

    // const rootX = tank.position.x * SQUARE_SIZE;
    // const rootY = tank.position.y * SQUARE_SIZE;
    //
    // if (isThisSession) {
    //     fill('#305c30')
    // } else {
    //     fill('#801c1c')
    // }
    // square(SQUARE_SIZE * tank.position.x, SQUARE_SIZE * tank.position.y, SQUARE_SIZE);
    //




    if (pictures[hex.tank.id]) {

        // const hexaMask = createGraphics(WIDTH, HEIGHT);
        //
        // hexaMask.fill('rgba(0, 0, 0, 1');
        // hexaMask.circle(0, 0, 1000);
        //
        // pictures[hex.tank.id].mask(hexaMask);

        // tint(255, 126);
        image(
            pictures[hex.tank.id],
            corners[0].x,
            corners[0].y + SQUARE_SIZE,
            SQUARE_SIZE,
            SQUARE_SIZE
        );
    }

    // // life
    // // for(let i = 0; i < tank.life; i++) {
    // //     noStroke()
    // //     if (i < tank.life) {
    // //         fill('red')
    // //         let boxSize = SQUARE_SIZE / 8;
    // //         circle(rootX + (SQUARE_SIZE / 2) -  (boxSize * 2) + (i * boxSize * 2), rootY + SQUARE_SIZE - boxSize , boxSize)
    // //     }
    // // }
    //
    // noStroke()
    // fill('white')
    //
    // if (tank.life === 0) {
    //
    //     textSize(SQUARE_SIZE);
    //     textStyle(NORMAL);
    //     textAlign(CENTER, CENTER)
    //     text('☠', rootX + SQUARE_SIZE / 2, rootY + SQUARE_SIZE / 2)
    //
    // } else {
    //
    //     textStyle(BOLD)
    //     textAlign(LEFT, TOP)
    //
    //     // life
    //     textSize(SQUARE_SIZE / 6);
    //     text(`💓 x ${tank.life}`, rootX + SQUARE_SIZE / 10, rootY + SQUARE_SIZE - 20)
    //
    //     // actions
    //     textStyle(BOLD)
    //     textSize(SQUARE_SIZE / 6);
    //     textAlign(LEFT, TOP)
    //     text(`👊 x ${tank.actions}`, rootX + SQUARE_SIZE / 10, rootY + SQUARE_SIZE / 10);
    //
    //     // range
    //     textSize(SQUARE_SIZE / 6);
    //     textAlign(LEFT, TOP)
    //     text(`👁 x ${tank.range}`, rootX + SQUARE_SIZE / 10, rootY + SQUARE_SIZE / 3);
    //
    // }
    //
    // if (mouseHoveredCell[0] === tank.position.x && mouseHoveredCell[1] === tank.position.y) {
    //     activePlayerHover = tank;
    // }


}

function inGrid(x, y) {
    return x >= 0 && y >= 0 && x < config.cols * SQUARE_SIZE && y < config.rows * SQUARE_SIZE;
}

function getCellFromMousePos(mX, mY) {
    const x = Math.floor(mX / SQUARE_SIZE);
    const y = Math.floor(mY / SQUARE_SIZE);
    return {x, y}
}

function showCellInfo(cell) {
    if (cell !== null) {
        cellInfoContainer.innerHTML = `life: ${cell.life} <br/> id : ${cell.id}`;
    }
}

function mouseClicked() {

    if (currentState === States.IDLE) {
        const hex = localGrid.pointToHex({ x: mouseX, y: mouseY });
        if (hex) {
            return;
        }
    }

    const hex = localGrid.pointToHex({ x: mouseX, y: mouseY });
    if (hex) {
        sio.emit('playerevent', currentState, {q: hex.q, r: hex.r}, (isValid) => {
            if (isValid) {
                currentState = States.IDLE;
            } else {
                //  animate(cell, 'BLOW')
            }
        });
    }



}




function animate(cell, animation) {

}
