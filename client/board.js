

let players = [];

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
                createCanvas(config.cols * SQUARE_SIZE, config.rows * SQUARE_SIZE);

                const jwt = await auth0.getTokenSilently()
                connectSocket(jwt)

            })
            .catch(() => createCanvas(200, 200))
        return;
    }

    // NEW - check for the code and state parameters
    const query = window.location.search;
    if (query.includes("code=") && query.includes("state=")) {

        // Process the login state
        await auth0.handleRedirectCallback();

        const isAuth = await auth0.isAuthenticated();
        console.log(`isAuth`, isAuth)
        
        await updateLoginUi();

        // Use replaceState to redirect the user away and remove the querystring parameters
        window.history.replaceState({}, document.title, "/");

        getJson('/config')
            .then(async c => {
                config = c;
                configFetched = true;

                WIDTH = config.cols * SQUARE_SIZE;
                HEIGHT = config.rows * SQUARE_SIZE
                createCanvas(config.cols * SQUARE_SIZE, config.rows * SQUARE_SIZE);

                const jwt = await auth0.getTokenSilently()
                connectSocket(jwt);

            })
            .catch(() => createCanvas(200, 200))

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

// END AUTH



let configFetched = false;
let config = {
    rows: 0,
    cols: 0
};

let sio;

function connectSocket(jwt) {
    sio = io('', {
        auth: {
            token: `Bearer ${jwt}`
        }
    });

    sio.on('player', setPlayer)
    sio.on('message', newMessage);
    sio.on('board', setBoard)

    sio.on('connect_error', error => {
        console.error(error)
    })
}



const SQUARE_SIZE = 80;
let WIDTH = 200;
let HEIGHT = 200;

const chatContainer = document.querySelector('#chat');
const cellInfoContainer = document.querySelector('#cell-info');
const actionButtons = document.querySelectorAll(`#actions > button`);



actionButtons.forEach(el => {
    el.addEventListener('click', function () {
        const state = this.getAttribute('data-action')
        if (!Object.values(States).includes(state)) {
            return
        }

        if (state === 'upgrade') {
            sio.emit('playerevent', 'upgrade', null, (isValid) => {
                console.log('upgraded')
            });
        } else {
            currentState = state;
        }


    })
})

let localBoard = null;
let playerId = null;
let player = null;

let stage = 'RUN'

const States = {
    IDLE: 'idle',
    MOVE: 'move',
    SHOOT: 'shoot',
    GIVE_ACTION: 'give-action',
    UPGRADE: 'upgrade'
}

let currentState = States.IDLE;

function newMessage(content) {
    const div = document.createElement('div');
    div.classList = ['message'];
    div.innerText = content;
    chatContainer.appendChild(div);
}

function setBoard(board) {
    localBoard = JSON.parse(board);

    const p = [];

    // set local player + pictures
    for (let i = 0; i < config.rows; i++) {
        for (let j = 0; j < config.cols; j++ ) {

            if (localBoard[i][j]) {
                const foundPlayer = localBoard[i][j];
                p.push(foundPlayer)
                const playerInList = players.find(pl => pl.id === foundPlayer.id)
                if (!playerInList) {
                    // new player
                    loadImage(foundPlayer.picture, (loadedPicture) => {
                        foundPlayer.loadedPicture = loadedPicture;
                    })
                } else {
                    localBoard[i][j].loadedPicture = playerInList.loadedPicture;
                }
            }


            if (localBoard[i][j] && localBoard[i][j].id === playerId) {
                player = localBoard[i][j];
            }
        }
    }

    players = p.map(pl => pl);

}

function setPlayer(id) {
    playerId = id;
}

function getPlayer() {

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

}

function draw() {
    background(81);
    if (!configFetched || !localBoard) {
        return;
    }

    if (stage === 'RUN') {
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

    if (tank.loadedPicture) {
        tint(255, 126);
        image(tank.loadedPicture, rootX, rootY, SQUARE_SIZE, SQUARE_SIZE);
    }

    // life
    for(let i = 0; i < 3; i++) {
        noStroke()
        if (i < tank.life) {
            fill('red')
            let boxSize = SQUARE_SIZE / 8;
            circle(rootX + (SQUARE_SIZE / 2) -  (boxSize * 2) + (i * boxSize * 2), rootY + SQUARE_SIZE - boxSize , boxSize)
        }
    }

    // actions
    fill('white')
    textStyle(BOLD)
    textSize(SQUARE_SIZE / 6);
    textAlign(LEFT, TOP)
    text(`Actions: ${tank.actions}`, rootX + SQUARE_SIZE / 10, rootY + SQUARE_SIZE / 10);

    // range
    fill('white')
    textStyle(BOLD)
    textSize(SQUARE_SIZE / 6);
    textAlign(LEFT, TOP)
    text(`Range: ${tank.range}`, rootX + SQUARE_SIZE / 10, rootY + SQUARE_SIZE / 3);
}

function inGrid(x, y) {
    return x < config.cols * SQUARE_SIZE && y < config.rows * SQUARE_SIZE;
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
            showCellInfo(localBoard[y][x]);
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
