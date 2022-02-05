

let players = [];
const pictures = {};
let events = []

let configFetched = false;
let config = {
    rows: 0,
    cols: 0
};

let sio;

let localBoard = null;
let playerId = null;
let player = null;
let heartLocation = null;

let stage = 'RUN';

const States = {
    IDLE: 'idle',
    MOVE: 'move',
    SHOOT: 'shoot',
    GIVE_ACTION: 'give-action',
    UPGRADE: 'upgrade',
    HEAL: 'heal'
}

let currentState = States.IDLE;

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
    logoutButton.disabled = !isAuthenticated;
}

window.onload = async () => {
    await configureClient();

    await updateLoginUi();

    const isAuthenticated = await auth0.isAuthenticated();

    if (isAuthenticated) {
        // show the gated content
        getJson('/config')
            .then(async c => {
                config = c;
                configFetched = true;

                WIDTH = config.cols * SQUARE_SIZE;
                HEIGHT = config.rows * SQUARE_SIZE

                resizeCanvas(WIDTH, HEIGHT);

                const jwt = await auth0.getTokenSilently()
                connectSocket(jwt)
            })
            .catch(err => {
                console.log(err)
            })

        players = await getJson('/players')
        events = await getJson('/events')

        drawEvents()
        return;
    }

    // NEW - check for the code and state parameters
    const query = window.location.search;
    if (query.includes("code=") && query.includes("state=")) {

        // Process the login state
        await auth0.handleRedirectCallback();

        const isAuth = await auth0.isAuthenticated();

        await updateLoginUi();

        // Use replaceState to redirect the user away and remove the querystring parameters
        window.history.replaceState({}, document.title, "/");

        getJson('/config')
            .then(async c => {
                config = c;
                configFetched = true;

                WIDTH = config.cols * SQUARE_SIZE;
                HEIGHT = config.rows * SQUARE_SIZE

                resizeCanvas(WIDTH, HEIGHT);

                const jwt = await auth0.getTokenSilently()
                connectSocket(jwt);

            }).catch(err => {
                console.log(err);
            }).catch(() => createCanvas(200, 200))

        players = await getJson('/players')
        events = await getJson('/events')

        drawEvents()


    }
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
    const markup = events.map(e => {
        const p = players.find(p => p.id === e.actor);

        const pre = `<div class="event">
                    <span class="event-date">${new Date(e.created_at).toLocaleString()}</span>
                    <p>
                        <img src="${p.picture}" title="${p.name}" class="img-thumbnail" alt="${p.name}"> `;

        const post = `</p></div>
            `

        if (e.action === States.MOVE) {
            return `${pre} moved to [${e.destination[0]}:${e.destination[1]}] ${post}`
        }

        if (e.action === States.UPGRADE) {
            return `${pre} upgraded his range${post}`
        }

        if (e.action === States.SHOOT) {
            const enemy = players.find(p => p.id === e.enemy)
            return `${pre} shoots to <img src="${enemy.picture}" title="${enemy.name}" class="img-thumbnail" alt="${enemy.name}">${post}`
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
    document.querySelector('#logs').innerHTML = markup.join('');
}




function connectSocket(jwt) {
    sio = io('', {
        auth: {
            token: `Bearer ${jwt}`
        }
    });

    sio.on('player', setPlayer)
    sio.on('message', newMessage);
    sio.on('board', setBoard)
    sio.on('playerslist', setPlayers);
    sio.on('action', addPlayerAction)

    sio.on('connect_error', error => {
        console.error(error)
    })
}

const SQUARE_SIZE = 80;
let WIDTH = 200;
let HEIGHT = 200;

const chatContainer = document.querySelector('#chat');
const cellInfoContainer = document.querySelector('#cell-info');
const actionButtons = document.querySelectorAll(`#actions  button`);
const playersContainer = document.querySelector('#players-container')

const toggleRulesButton = document.querySelector('#toggle-rules');
const rulesContainer = document.querySelector('#rules');

toggleRulesButton.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (Array.from(rulesContainer.classList).includes('d-none')) {
        rulesContainer.classList.remove('d-none');
    } else {
        rulesContainer.classList.add('d-none')
    }
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



function newMessage(content) {
    const div = document.createElement('div');
    div.classList = ['message'];
    div.innerText = content;
    // chatContainer.appendChild(div);
}

function addPlayerAction(action) {
    events.unshift(action)
    drawEvents();
}

function setBoard(serverMessage) {

    const parsedMessage = JSON.parse(serverMessage);
    localBoard = parsedMessage.board;
    const p = [];

    // set local player
    for (let i = 0; i < config.rows; i++) {
        for (let j = 0; j < config.cols; j++ ) {
            
            if (localBoard[i][j]) {
                if (!pictures[localBoard[i][j].id]) {
                    pictures[localBoard[i][j].id] = loadImage(localBoard[i][j].picture)
                }
            }
            
            if (localBoard[i][j] && localBoard[i][j].id === playerId) {
                player = localBoard[i][j];
            }
        }
    }
    
    
    heartLocation = parsedMessage.features.heartLocation;
    

}

function setPlayer(id) {
    playerId = id;
}


function setPlayers(playersList) {
    try {
        players = JSON.parse(playersList);

        // players.forEach(p => {
        //     if (!player.loadedPicture) {
        //         p.loadedPicture = loadImage(p.picture)
        //     }
        // })

        const listItems = players.map(p => `
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


function setup() {
    const canvas = createCanvas(100, 100);
    canvas.parent('board-holder')
}

function draw() {
    background('white');
    if (!configFetched || !localBoard) {
        return;
    }

    if (stage === 'RUN') {
        background(81)
        drawBoard();
    }

}

function drawBoard() {
    for (let y = 0; y < config.rows; y++) {
        for (let x = 0; x < config.cols; x++) {
            drawCell(y, x);
        }
    }
}


function drawCell(y, x) {
    stroke('white')

    if (localBoard[y][x] === null) {
        drawEmptyCell(y, x);
        if (heartLocation && heartLocation[0] === x && heartLocation[1] === y) {
            drawHeart(y, x);
        }
    } else {
        if (localBoard[y][x].id === playerId) {
            drawPlayer(localBoard[y][x], true);
        } else {
            drawPlayer(localBoard[y][x])
        }
    }

}

function isInRange(cell1, cell2, range) {
    return (
        cell1.x >= cell2.x - range
        && cell1.x <= cell2.x + range
        && cell1.y >= cell2.y - range
        && cell1.y <= cell2.y + range
    )
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

function drawEmptyCell(y, x) {
    noFill()

    if (currentState === States.MOVE) {
        if(isInRange({x: x, y: y}, player.position, 1)) {
            fill('rgba(110,110,110,0.67)')
        }
    }

    if (currentState === States.SHOOT) {
        if(isInRange({x: x, y: y}, player.position, player.range)) {
            fill('rgba(110,110,110,0.67)')
        }
    }

    if (currentState === States.GIVE_ACTION) {
        if(isInRange({x: x, y: y}, player.position, player.range)) {
            fill('rgba(110,110,110,0.67)')
        }
    }

    if (currentState === States.HEAL) {
        if(isInRange({x: x, y: y}, player.position, player.range)) {
            fill('rgba(110,110,110,0.67)')
        }
    }


    square(SQUARE_SIZE * x, SQUARE_SIZE * y, SQUARE_SIZE);

}

function drawPlayer(tank, isThisSession) {

    fill('white')

    const rootX = tank.position.x * SQUARE_SIZE;
    const rootY = tank.position.y * SQUARE_SIZE;

    if (isThisSession) {
        fill('#305c30')
    } else {
        fill('#801c1c')
    }
    square(SQUARE_SIZE * tank.position.x, SQUARE_SIZE * tank.position.y, SQUARE_SIZE);

    if (pictures[tank.id]) {
        tint(255, 126);
        image(pictures[tank.id], rootX, rootY, SQUARE_SIZE, SQUARE_SIZE);
    }

    // life
    // for(let i = 0; i < tank.life; i++) {
    //     noStroke()
    //     if (i < tank.life) {
    //         fill('red')
    //         let boxSize = SQUARE_SIZE / 8;
    //         circle(rootX + (SQUARE_SIZE / 2) -  (boxSize * 2) + (i * boxSize * 2), rootY + SQUARE_SIZE - boxSize , boxSize)
    //     }
    // }

    noStroke()
    fill('white')

    if (tank.life === 0) {

        textSize(SQUARE_SIZE);
        textStyle(NORMAL);
        textAlign(CENTER, CENTER)
        text('☠', rootX + SQUARE_SIZE / 2, rootY + SQUARE_SIZE / 2)

    } else {

        textStyle(BOLD)
        textAlign(LEFT, TOP)

        // life
        textSize(SQUARE_SIZE / 6);
        text(`💓 x ${tank.life}`, rootX + SQUARE_SIZE / 10, rootY + SQUARE_SIZE - 20)

        // actions
        textStyle(BOLD)
        textSize(SQUARE_SIZE / 6);
        textAlign(LEFT, TOP)
        text(`👊 x ${tank.actions}`, rootX + SQUARE_SIZE / 10, rootY + SQUARE_SIZE / 10);

        // range
        textSize(SQUARE_SIZE / 6);
        textAlign(LEFT, TOP)
        text(`👁 x ${tank.range}`, rootX + SQUARE_SIZE / 10, rootY + SQUARE_SIZE / 3);

    }




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
        if (inGrid(mouseX, mouseY)) {
            const {x, y} = getCellFromMousePos(mouseX, mouseY)
            // showCellInfo(localBoard[y][x]);
            return;
        }
    }

    if (inGrid(mouseX, mouseY)) {
        const cell = getCellFromMousePos(mouseX, mouseY);
        sio.emit('playerevent', currentState, cell, (isValid) => {
            if (isValid) {
                currentState = States.IDLE;
            } else {
                animate(cell, 'BLOW')
            }
        });
    }

}

function animate(cell, animation) {

}
