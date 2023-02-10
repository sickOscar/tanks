let players = [];
const pictures = {};
let events = []
let configFetched = false;
let backgroundImage;
let activePlayerHover = null;
let sio;
let playerId = null;
let player = null;
let heartsLocations = null;
let actionsLocations = null;
let buildings = null;
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
const HEX_SIDE = 40;
const HEX_WIDTH = 2 * (Math.sqrt(3)/2) * HEX_SIDE;
const HEX_HEIGHT = HEX_SIDE * Math.sqrt(3);
const HEX_TOP_TRIANGLE_HEIGHT = (Math.sqrt(3) / 2 * HEX_SIDE) / 2
let WIDTH = 200;
let HEIGHT = 200;
let maskGraphics;
let hoverHex;
let currentState = States.IDLE;
const voteSelect = document.querySelector('select#vote');
const pollForm = document.querySelector('form#poll');
const showPollResultsButton = document.querySelector('button#show-poll-results')
const actionsContainer = document.querySelector('#actions');
const pollResultsContainer = document.querySelector('#poll-results')
const pollResultsTable = document.querySelector('#poll-results-table')
const modalOverlay = document.querySelector('#modal-overlay');
const loginButton = document.querySelector('#btn-login');
const logoutButton = document.querySelector('#btn-logout');
const hover = {
    hex: null,
    for: 0
}
const POPUP_DELAY = 10;
const TILES = [
    {name: "🌿 Plains", description: "Moving here will cost you 1 👊"},
    {name: "🌊 Water", description: "You cannot move here"},
    {name: "🏜️ Desert", description: "Moving here will cost you 1 👊\nBeing here when action gets distributed\nwill cost you 1 💓"},
    {name: "🌲 Forest", description: "Moving here will cost you 1 👊\nYour range will be decreased by 1\nYour enemies' range to you is decreased by 1"},
    {name: "⛰️ Mountain", description: "Moving here will cost you 2 👊\nYour range will be increased by 1"},
    {name: "🐊 Swamp", description: "Moving here will cost you 1 👊\nWhen here you can Hunt 🏹🐊"},
    {name: "❄️ Ice", description: "Moving here will cost you 2 👊"},
]

const BUILDINGS = {
    'OASIS': {
        name:  `Oasis`,
        description: `If you are here when actions gets distributed,\n `
    },
    'ICE_FORTRESS': {
        name: `Ice Fortress`,
        description: `If you are here when actions gets distributed,\n `
    },
}

const walkableTiles = [0, 2, 3, 4, 5, 6];
let oasisImage = null;
let iceFortress = null;

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


function randomNumber(min, max) {
    return Math.random() * (max - min) + min;
}



// AUTH


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
        xRadius: HEX_SIDE,
        yRadius: HEX_SIDE
    }
    return grid;
}

function setupLocalGrid(grid) {
    const resizedGrid = resizeGrid(grid);

    const TanksHex = class extends Honeycomb.defineHex(resizedGrid.hexSettings) {
        tank = null;
        tile = 0;

        constructor({q, r, tank, tile}) {
            super({q, r});
            this.tank = tank;
            this.tile = tile
        }
    }
    localGrid = new Honeycomb.Grid(TanksHex, resizedGrid.coordinates);
}

async function initCanvas() {

    const c = await getJson('/config');
    configFetched = true;
    setupLocalGrid(c.grid);

    WIDTH = c.cols * HEX_WIDTH + X_OFFSET;
    HEIGHT = c.rows * HEX_HEIGHT + Y_OFFSET;

    resizeCanvas(WIDTH, HEIGHT);

    // MAGIC: 69 is SUPER RANDOM
    // don't understand properly how to calculate the size of the mask
    maskGraphics = createGraphics(69, 69);

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
    actionsLocations = parsedMessage.features.actionsLocations;
    buildings = parsedMessage.features.buildings;

    // debugger;

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
    tiles = [
        loadImage('./assets/grass.png'),
        loadImage('./assets/sea.png'),
        loadImage('./assets/desert.png'),
        loadImage('./assets/forest.png'),
        loadImage('./assets/mountain.png'),
        loadImage('./assets/swamp.png'),
        loadImage('./assets/ice.png'),
    ]

    oasisImage = loadImage('./assets/oasis.webp');
    iceFortressImage = loadImage('./assets/ice_fortress.webp');

}

function setup() {
    const canvas = createCanvas(100, 100);
    canvas.parent('board-holder')

    maskGraphics = createGraphics(100, 100);

    frameRate(10)
}

function draw() {

    activePlayerHover = null;

    clear();
    if (!configFetched || !localGrid) {
        return;
    }

    if (stage === 'RUN') {
        // image(backgroundImage, 0, 0);
        drawBoard();
    }

    drawCursor();
    // drawPlayerHover();
    drawPopup();

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

    const hex = activePlayerHover;

    textSize(14);
    noStroke();
    fill('white');
    textAlign(CENTER);
    text(hex.tank.name, hex.corners[2].x + X_OFFSET, hex.corners[2].y + Y_OFFSET + 16)

}

function drawBoard() {
    noFill();
    stroke('white');
    localGrid.forEach(drawCell);
}


function drawCoordinates(hex) {
    // noStroke()
    // fill('#fff');
    // textSize(10);
    // textAlign(CENTER);
    // text(
    //     `q: ${hex.q} r: ${hex.r}`,
    //     hex.corners[0].x - (HEX_WIDTH / 2) + X_OFFSET,
    //     hex.corners[0].y + Y_OFFSET
    // )
}

function drawCell(hex) {
    stroke('white')

    drawEmptyCell(hex);

    if (!hex.tank) {


        if (heartsLocations) {
            const hasHeart = heartsLocations.find(loc => {
                return loc[0] === hex.q && loc[1] === hex.r
            })
            if (hasHeart) {
                drawHeart(hex);
            }
        }

        if (actionsLocations) {
            const hasAction = actionsLocations.find(loc => {
                return loc[0] === hex.q && loc[1] === hex.r
            })
            if (hasAction) {
                drawAction(hex);
            }
        }

        if (buildings) {
            const hasBuilding = buildings.find(building => {
                return building.position.q === hex.q && building.position.r === hex.r
            })
            if (hasBuilding) {
                drawBuilding(hex, hasBuilding);
            }
        }


    } else {

        if (hex.tank?.id === playerId) {
            drawPlayer(hex, true);
        } else {
            drawPlayer(hex)
        }
    }

    drawCoordinates(hex);


}

function drawBuilding(hex, building) {
    switch(building.type) {


        case 'OASIS':
            image(
                oasisImage,
                hex.corners[0].x - HEX_WIDTH + X_OFFSET,
                hex.corners[0].y + Y_OFFSET - 10,
                HEX_WIDTH,
                HEX_HEIGHT
            );
            break;

        case 'ICE_FORTRESS':
            image(
                iceFortressImage,
                hex.corners[0].x - HEX_WIDTH + X_OFFSET,
                hex.corners[0].y + Y_OFFSET - HEX_TOP_TRIANGLE_HEIGHT,
                HEX_WIDTH,
                HEX_HEIGHT + 12
            );
            break;

        default:
            break;
    }

}

function isInRange(destinationCell, startingCell, range, shooting  = false) {
    let finalRange = range;
    if (shooting) {
        const startingTile = localGrid.getHex({q: startingCell.q, r: startingCell.r})?.tile;
        const destinationTile = localGrid.getHex({q: destinationCell.q, r: destinationCell.r})?.tile;
        if (startingTile === 4) {
            finalRange = range + 1;
        }
        if (startingTile === 3 || destinationTile === 3) {
            finalRange = range - 1;
        }
    }
    return localGrid.distance(destinationCell, startingCell) <= finalRange
}

function isWalkable(hex) {
    return walkableTiles.includes(hex.tile);
}

function drawAction(hex) {

    const corners = hex.corners;

    fill('white');
    textSize(HEX_SIDE + 5 * Math.sin(frameCount * 0.1));
    textAlign(CENTER);
    text(
        '👊',
        corners[0].x - HEX_WIDTH / 2 + X_OFFSET,
        corners[0].y + HEX_HEIGHT / 2 + Y_OFFSET
    )
}

function drawHeart(hex) {

    const corners = hex.corners;

    fill('red')
    textSize(HEX_SIDE + 5 * Math.sin(frameCount * 0.1));
    textAlign(CENTER);
    text(
        '💖',
        corners[0].x - HEX_WIDTH / 2 + X_OFFSET,
        corners[0].y + HEX_HEIGHT / 2 + Y_OFFSET
    )
}

function drawEmptyCell(hex) {
    noFill()
    strokeWeight(2);
    stroke('rgb(243,235,173)');
    // noStroke();

    const [...corners] = hex.corners;

    image(
        tiles[hex.tile],
        corners[4].x + X_OFFSET,
        corners[4].y + Y_OFFSET - HEX_TOP_TRIANGLE_HEIGHT,
        HEX_WIDTH,
        HEX_HEIGHT + 9, // +5 WHY???
    )

    const highlightColor = 'rgba(255, 255, 255, 0.3)'

    if (localGrid.pointToHex({x: mouseX - X_OFFSET, y: mouseY - Y_OFFSET}) === hex) {
        fill(highlightColor);
    } else {
        // fill('rgb(38,91,34)')
    }

    if (currentState === States.MOVE) {
        if(
            isInRange(hex, player.position, 1)
            && isWalkable(hex)
        ) {
            fill(highlightColor)
        }
    }

    if (currentState === States.SHOOT) {
        if(isInRange(hex, player.position, player.range, true)) {
            fill(highlightColor)
        }
    }

    if (currentState === States.GIVE_ACTION) {
        if(isInRange(hex, player.position, player.range, true)) {
            fill(highlightColor)
        }
    }

    if (currentState === States.HEAL) {
        if(isInRange(hex, player.position, player.range, true)) {
            fill(highlightColor)
        }
    }

    beginShape();
    let first = true;
    corners.forEach(({ x, y }) => {
        vertex(x + X_OFFSET, y + Y_OFFSET);
        if (first) {
            circle(x + X_OFFSET, y + Y_OFFSET, 5)
        }
        first = false;
    });
    endShape(CLOSE);



}

function drawPlayer(hex, isThisSession) {

    const tank = hex.tank;
    const [...corners] = hex.corners;

    if (pictures[hex.tank.id]) {

        const origin = corners[4];
        const originOffset = createVector(origin.x + X_OFFSET, origin.y + Y_OFFSET);
        originOffset.y = originOffset.y - HEX_TOP_TRIANGLE_HEIGHT;

        maskGraphics.fill('rgba(0,0,0,1)');
        maskGraphics.beginShape();
        corners.forEach(({ x, y }) => {
            maskGraphics.vertex(x + X_OFFSET - originOffset.x, y + Y_OFFSET - originOffset.y);
        })
        maskGraphics.endShape(CLOSE);


        pictures[hex.tank.id].mask(maskGraphics);

        image(
            pictures[hex.tank.id],
            corners[0].x - HEX_WIDTH + X_OFFSET,
            corners[0].y - HEX_TOP_TRIANGLE_HEIGHT + Y_OFFSET,
            HEX_WIDTH,
            HEX_HEIGHT
        );

    }

    noStroke()
    fill('white')
    textStyle('bold');

    if (tank.life === 0) {

        textSize(HEX_SIDE);
        textAlign(CENTER);

        text(
            '☠',
            corners[0].x - HEX_WIDTH / 2 + X_OFFSET,
            corners[0].y + HEX_HEIGHT / 2 + Y_OFFSET
        )

    } else {

        // textSize(12);
        // textAlign(LEFT);
        //
        // // life
        //
        // text(
        //     `💓 x ${tank.life}`,
        //     corners[0].x - HEX_WIDTH + 15 + X_OFFSET,
        //     corners[0].y + 15 + Y_OFFSET
        // )
        //
        // // actions
        // text(
        //     `👊 x ${tank.actions}`,
        //     corners[0].x - HEX_WIDTH + 15 + X_OFFSET,
        //     corners[0].y + 30 + Y_OFFSET
        // );
        //
        // // range
        //
        // let rangeModifier = '';
        // let tile = localGrid.getHex({q: hex.q, r: hex.r}).tile;
        // if (tile === 4) {
        //     rangeModifier = ' (+1 ⛰️)';
        // }
        //
        // if (tile === 3) {
        //     rangeModifier = ' (-1 🌲)';
        // }
        //
        // text(
        //     `👁 x ${tank.range} ${rangeModifier}`,
        //     corners[0].x - HEX_WIDTH + 15 + X_OFFSET,
        //     corners[0].y + 45 + Y_OFFSET
        // );

    }

    stroke('white');
    noFill();
    beginShape();
    corners.forEach(({ x, y }) => {
        vertex(x + X_OFFSET, y + Y_OFFSET);
    });
    endShape(CLOSE);

    if (localGrid.pointToHex({x:mouseX - X_OFFSET, y:mouseY - Y_OFFSET}).equals({q:hex.q, r:hex.r})) {
        activePlayerHover = hex;
    }

}

function drawPopup() {
    
    const hex = localGrid.pointToHex(
        {x:mouseX - X_OFFSET, y:mouseY - Y_OFFSET},
        {allowOutside: false}
    );
    
    if (!hex) {
        return;
    }


    if (hover.hex && hover.hex.equals({q:hex.q, r:hex.r})) {
        hover.for += 1;
    } else {
        hover.hex = hex;
        hover.for = 0;
    }

    const smallSize = [280, 80];
    const mediumSize = [200, 120];
    const largeSize = [300, 150];


    if (hover.for > POPUP_DELAY) {
        
        let rectSourceX = hex.corners[0].x + X_OFFSET + 10 ;
        let rectSourceY = hex.corners[0].y + Y_OFFSET - HEX_TOP_TRIANGLE_HEIGHT;

        let size = smallSize;

        let popupXOffset = 15;

        if (heartsLocations.find(([q, r]) => q === hex.q && r === hex.r)) {
            size = smallSize;

            if (mouseX > WIDTH / 2) {
                rectSourceX = hex.corners[0].x + X_OFFSET - HEX_WIDTH - 10 - size[0];
            }

            fill('black');
            stroke('white');
            rect(rectSourceX, rectSourceY, size[0], size[1]);

            textAlign(LEFT);
            noStroke();
            fill('white');
            textSize(18);
            text('Health potion', rectSourceX + popupXOffset, rectSourceY  + 20);

            textSize(12);
            text('Move here to get one 💓', rectSourceX +  popupXOffset, rectSourceY + 40);

        } else if (actionsLocations.find(([q, r]) => q === hex.q && r === hex.r)) {
            size = smallSize;

            if (mouseX > WIDTH / 2) {
                rectSourceX = hex.corners[0].x + X_OFFSET - HEX_WIDTH - 10 - size[0];
            }

            fill('black');
            stroke('white');
            rect(rectSourceX, rectSourceY, size[0], size[1]);

            textAlign(LEFT);
            noStroke();
            fill('white');
            textSize(18);
            text('Action potion', rectSourceX + popupXOffset, rectSourceY  + 20);

            textSize(12);
            text('Move here to get one 👊', rectSourceX +  popupXOffset, rectSourceY + 40);

        } else if (buildings.find(({position}) => position.q === hex.q && position.r === hex.r)) {

            const building = buildings.find(({position}) => position.q === hex.q && position.r === hex.r);
            size = largeSize;

            if (mouseX > WIDTH / 2) {
                rectSourceX = hex.corners[0].x + X_OFFSET - HEX_WIDTH - 10 - size[0];
            }

            fill('black');
            stroke('white');
            rect(rectSourceX, rectSourceY, size[0], size[1]);

            textAlign(LEFT);
            noStroke();
            fill('white');
            textSize(18);
            text(BUILDINGS[building.type].name, rectSourceX + popupXOffset, rectSourceY  + 20);

            textSize(12);
            text(BUILDINGS[building.type].description, rectSourceX +  popupXOffset, rectSourceY + 40);

        } else if (!hex.tank) {

            // empty

            size = smallSize;

            if (mouseX > WIDTH / 2) {
                rectSourceX = hex.corners[0].x + X_OFFSET - HEX_WIDTH - 10 - size[0];
            }
            
            fill('black');
            stroke('white');
            rect(rectSourceX, rectSourceY, size[0], size[1]);

            textAlign(LEFT);
            noStroke();
            fill('white');
            textSize(18);
            text(TILES[hex.tile].name, rectSourceX + popupXOffset, rectSourceY  + 20);

            textSize(12);
            text(TILES[hex.tile].description, rectSourceX +  popupXOffset, rectSourceY + 40);
        } else if (hex.tank) {

            size = mediumSize;

            if (mouseX > WIDTH / 2) {
                rectSourceX = hex.corners[0].x + X_OFFSET - HEX_WIDTH - 10 - size[0];
            }

            fill('black');
            stroke('white');
            rect(rectSourceX, rectSourceY, size[0], size[1]);

            if (pictures[hex.tank.id]) {
                image(
                    pictures[hex.tank.id],
                    rectSourceX + popupXOffset,
                    rectSourceY + popupXOffset - 5,
                    30,
                    30
                );
            }

            textAlign(LEFT);
            noStroke();
            fill('white');
            textSize(18);
            textLeading(18);
            text(
                hex.tank.name.split(' ').join("\n"),
                rectSourceX + popupXOffset + 30 + 5,
                rectSourceY  + 20
            );

            textSize(12);
            textLeading(15);
            // text(hex.tank.name, rectSourceX +  popupXOffset, rectSourceY + 40);

            // life

            if (hex.tank.life < 1) {
                text(
                    '☠',
                    rectSourceX + popupXOffset,
                    rectSourceY  + 60
                )
            } else {
                text(
                    `💓 x ${hex.tank.life}`,
                    rectSourceX + popupXOffset,
                    rectSourceY  + 60
                )

                // actions
                text(
                    `👊 x ${hex.tank.actions}`,
                    rectSourceX + popupXOffset,
                    rectSourceY  + 75
                );

                // range

                let rangeModifier = '';
                let tile = localGrid.getHex({q: hex.q, r: hex.r}).tile;
                if (tile === 4) {
                    rangeModifier = ' (+1 ⛰️)';
                }

                if (tile === 3) {
                    rangeModifier = ' (-1 🌲)';
                }

                text(
                    `👁 x ${hex.tank.range} ${rangeModifier}`,
                    rectSourceX + popupXOffset,
                    rectSourceY  + 90
                );
            }



            // terrain
            text(`on ${TILES[hex.tile].name}`, rectSourceX + popupXOffset, rectSourceY  + 115);

        }



    }

}

function mouseClicked() {

    if (currentState === States.IDLE) {
        const hex = localGrid.pointToHex(
            { x: mouseX - X_OFFSET, y: mouseY - Y_OFFSET },
            { allowOutside: false }
        );
        if (hex) {
            return;
        }
    }

    const hex = localGrid.pointToHex(
        { x: mouseX - X_OFFSET, y: mouseY - Y_OFFSET},
        { allowOutside: false }
    );
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
