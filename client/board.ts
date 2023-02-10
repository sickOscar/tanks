import p5 from 'p5';
import * as Honeycomb from 'honeycomb-grid';
import {TanksHex} from "../server/app/board";
import {AxialCoordinates, Grid} from "honeycomb-grid";
import {Tank} from "./models/Tank";
import {BUILDINGS} from "./consts";

const sketch =  new p5((p5) => {


    let players = [];
    const pictures:{[key:string]: any} = {};
    let events = []
    let configFetched = false;
    let backgroundImage;
    let activePlayerHover = null;
    let sio;
    let playerId:string|null = null;
    let player:Tank;
    let heartsLocations:[q:number, r:number][] = [];
    let actionsLocations:[q:number, r:number][] = [];
    let buildings:{type:string, position:AxialCoordinates}[] = [];
    let localGrid:Grid<TanksHex>;
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
    const modalOverlay = document.querySelector('#modal-overlay') as HTMLDivElement;
    const loginButton = document.querySelector('#btn-login');
    const logoutButton = document.querySelector('#btn-logout');
    const hover = {
        hex: null,
        for: 0
    }
    const POPUP_DELAY = 10;
    let tiles:any[] = [];
    const TILES = [
        {name: "🌿 Plains", description: "Moving here will cost you 1 👊"},
        {name: "🌊 Water", description: "You cannot move here"},
        {name: "🏜️ Desert", description: "Moving here will cost you 1 👊\nBeing here when action gets distributed\nwill cost you 1 💓"},
        {name: "🌲 Forest", description: "Moving here will cost you 1 👊\nYour range will be decreased by 1\nYour enemies' range to you is decreased by 1"},
        {name: "⛰️ Mountain", description: "Moving here will cost you 2 👊\nYour range will be increased by 1"},
        {name: "🐊 Swamp", description: "Moving here will cost you 1 👊\nWhen here you can Hunt 🏹🐊"},
        {name: "❄️ Ice", description: "Moving here will cost you 2 👊"},
    ]



    const walkableTiles = [0, 2, 3, 4, 5, 6];
    let oasisImage = null;
    let iceFortressImage = null;

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

        auth0 = await window.createAuth0Client({
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
        localGrid = new Honeycomb.Grid<TanksHex>(TanksHex, resizedGrid.coordinates);
    }

    async function initCanvas() {

        const c = await getJson('/config');
        configFetched = true;
        setupLocalGrid(c.grid);

        WIDTH = c.cols * HEX_WIDTH + X_OFFSET;
        HEIGHT = c.rows * HEX_HEIGHT + Y_OFFSET;

        p5.resizeCanvas(WIDTH, HEIGHT);

        // MAGIC: 69 is SUPER RANDOM
        // don't understand properly how to calculate the size of the mask
        maskGraphics = p5.createGraphics(69, 69);

        const jwt = await auth0.getTokenSilently()
        connectSocket(jwt);

        players = await getJson('/players')
        events = await getJson('/events')

        drawEvents()
    }

    loginButton.addEventListener('click', () => {
        auth0.loginWithRedip5.rect({
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
        const logsContainer = document.querySelector('#logs-container') as HTMLDivElement;
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

        sio.on('connect_error', (error:any) => {
            console.error(error)
        })
    }


    const actionButtons = document.querySelectorAll(`#actions  button`) as NodeListOf<HTMLButtonElement>;
    const playersContainer = document.querySelector('#players-container') as HTMLDivElement;

    const toggleRulesButton = document.querySelector('#toggle-rules') as HTMLAnchorElement;
    const rulesContainer = document.querySelector('#rules') as HTMLDivElement;

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

        const playersList:Tank[] = [];

        localGrid.forEach(hex => {
            if (hex.tank) {
                playersList.push(hex.tank);
            }

            if (hex.tank) {
                if (!pictures[hex.tank.id]) {
                    pictures[hex.tank.id] = p5.loadImage(hex.tank.picture)
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

    async function getJson(url:string):Promise<any> {
        const token = await auth0.getTokenSilently();
        return fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
            .then(response => response.json())
            .catch(console.error);
    }

    p5.preload = function() {
        // backgroundImage = p5.loadImage('tanks.jpg');
        tiles = [
            p5.loadImage('./assets/grass.png'),
            p5.loadImage('./assets/sea.png'),
            p5.loadImage('./assets/desert.png'),
            p5.loadImage('./assets/forest.png'),
            p5.loadImage('./assets/mountain.png'),
            p5.loadImage('./assets/swamp.png'),
            p5.loadImage('./assets/ice.png'),
        ]

        oasisImage = p5.loadImage('./assets/oasis.webp');
        iceFortressImage = p5.loadImage('./assets/ice_fortress.webp');

    }

    p5.setup = function() {
        const canvas = p5.createCanvas(100, 100);
        canvas.parent('board-holder')

        maskGraphics = p5.createGraphics(100, 100);

        p5.frameRate(10)
    }

    p5.draw = function() {

        activePlayerHover = null;

        p5.clear();
        if (!configFetched || !localGrid) {
            return;
        }

        if (stage === 'RUN') {
            // p5.image(backgroundImage, 0, 0);
            drawBoard();
        }

        drawCursor();
        // drawPlayerHover();
        drawPopup();

    }

    function drawCursor() {

        p5.cursor('default')

        if (currentState === States.SHOOT) {
            p5.cursor('pointer');
        }

        if (currentState === States.MOVE) {
            p5.cursor('pointer');
        }

        if (currentState === States.GIVE_ACTION) {
            p5.cursor('pointer');
        }

        if (currentState === States.HEAL) {
            p5.cursor('pointer');
        }
    }

    function drawPlayerHover() {
        if (!activePlayerHover) {
            return;
        }

        const hex = activePlayerHover;

        p5.textSize(14);
        p5.noStroke();
        p5.fill('white');
        p5.textAlign(p5.CENTER);
        p5.text(hex.tank.name, hex.corners[2].x + X_OFFSET, hex.corners[2].y + Y_OFFSET + 16)

    }

    function drawBoard() {
        p5.noFill();
        p5.stroke('white');
        localGrid.forEach(drawCell);
    }


    function drawCoordinates(hex) {
        // p5.noStroke()
        // p5.fill('#fff');
        // p5.textSize(10);
        // p5.textAlign(p5.CENTER);
        // p5.text(
        //     `q: ${hex.q} r: ${hex.r}`,
        //     hex.corners[0].x - (HEX_WIDTH / 2) + X_OFFSET,
        //     hex.corners[0].y + Y_OFFSET
        // )
    }

    function drawCell(hex:TanksHex) {
        p5.stroke('white')

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
                p5.image(
                    oasisImage,
                    hex.corners[0].x - HEX_WIDTH + X_OFFSET,
                    hex.corners[0].y + Y_OFFSET - 10,
                    HEX_WIDTH,
                    HEX_HEIGHT
                );
                break;

            case 'ICE_FORTRESS':
                p5.image(
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

        p5.fill('white');
        p5.textSize(HEX_SIDE + 5 * Math.sin(p5.frameCount * 0.1));
        p5.textAlign(p5.CENTER);
        p5.text(
            '👊',
            corners[0].x - HEX_WIDTH / 2 + X_OFFSET,
            corners[0].y + HEX_HEIGHT / 2 + Y_OFFSET
        )
    }

    function drawHeart(hex:TanksHex) {

        const corners = hex.corners;

        p5.fill('red')
        p5.textSize(HEX_SIDE + 5 * Math.sin(p5.frameCount * 0.1));
        p5.textAlign(p5.CENTER);
        p5.text(
            '💖',
            corners[0].x - HEX_WIDTH / 2 + X_OFFSET,
            corners[0].y + HEX_HEIGHT / 2 + Y_OFFSET
        )
    }

    function drawEmptyCell(hex:TanksHex) {
        p5.noFill()
        p5.strokeWeight(2);
        p5.stroke('rgb(243,235,173)');
        // p5.noStroke();

        const [...corners] = hex.corners;

        p5.image(
            tiles[hex.tile],
            corners[4].x + X_OFFSET,
            corners[4].y + Y_OFFSET - HEX_TOP_TRIANGLE_HEIGHT,
            HEX_WIDTH,
            HEX_HEIGHT + 9, // +5 WHY???
        )

        const highlightColor = 'rgba(255, 255, 255, 0.3)'

        if (localGrid.pointToHex({x: p5.mouseX - X_OFFSET, y: p5.mouseY - Y_OFFSET}) === hex) {
            p5.fill(highlightColor);
        } else {
            // p5.fill('rgb(38,91,34)')
        }

        if (currentState === States.MOVE) {
            if(
                isInRange(hex, player.position, 1)
                && isWalkable(hex)
            ) {
                p5.fill(highlightColor)
            }
        }

        if (currentState === States.SHOOT) {
            if(isInRange(hex, player.position, player.range, true)) {
                p5.fill(highlightColor)
            }
        }

        if (currentState === States.GIVE_ACTION) {
            if(isInRange(hex, player.position, player.range, true)) {
                p5.fill(highlightColor)
            }
        }

        if (currentState === States.HEAL) {
            if(isInRange(hex, player.position, player.range, true)) {
                p5.fill(highlightColor)
            }
        }

        p5.beginShape();
        let first = true;
        corners.forEach(({ x, y }) => {
            p5.vertex(x + X_OFFSET, y + Y_OFFSET);
            if (first) {
                p5.circle(x + X_OFFSET, y + Y_OFFSET, 5)
            }
            first = false;
        });
        p5.endShape(p5.CLOSE);



    }

    function drawPlayer(hex:TanksHex) {

        const tank = hex.tank;
        const [...corners] = hex.corners;

        if (pictures[hex.tank.id]) {

            const origin = corners[4];
            const originOffset = p5.createVector(origin.x + X_OFFSET, origin.y + Y_OFFSET);
            originOffset.y = originOffset.y - HEX_TOP_TRIANGLE_HEIGHT;

            maskGraphics.fill('rgba(0,0,0,1)');
            maskGraphics.beginShape();
            corners.forEach(({ x, y }) => {
                maskGraphics.vertex(x + X_OFFSET - originOffset.x, y + Y_OFFSET - originOffset.y);
            })
            maskGraphics.endShape(p5.CLOSE);


            pictures[hex.tank.id].mask(maskGraphics);

            p5.image(
                pictures[hex.tank.id],
                corners[0].x - HEX_WIDTH + X_OFFSET,
                corners[0].y - HEX_TOP_TRIANGLE_HEIGHT + Y_OFFSET,
                HEX_WIDTH,
                HEX_HEIGHT
            );

        }

        p5.noStroke()
        p5.fill('white')
        p5.textStyle('bold');

        if (tank.life === 0) {

            p5.textSize(HEX_SIDE);
            p5.textAlign(p5.CENTER);

            p5.text(
                '☠',
                corners[0].x - HEX_WIDTH / 2 + X_OFFSET,
                corners[0].y + HEX_HEIGHT / 2 + Y_OFFSET
            )

        } else {

            // p5.textSize(12);
            // p5.textAlign(p5.LEFT);
            //
            // // life
            //
            // p5.text(
            //     `💓 x ${tank.life}`,
            //     corners[0].x - HEX_WIDTH + 15 + X_OFFSET,
            //     corners[0].y + 15 + Y_OFFSET
            // )
            //
            // // actions
            // p5.text(
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
            // p5.text(
            //     `👁 x ${tank.range} ${rangeModifier}`,
            //     corners[0].x - HEX_WIDTH + 15 + X_OFFSET,
            //     corners[0].y + 45 + Y_OFFSET
            // );

        }

        p5.stroke('white');
        p5.noFill();
        p5.beginShape();
        corners.forEach(({ x, y }) => {
            p5.vertex(x + X_OFFSET, y + Y_OFFSET);
        });
        p5.endShape(p5.CLOSE);

        if (localGrid.pointToHex({x:p5.mouseX - X_OFFSET, y:p5.mouseY - Y_OFFSET}).equals({q:hex.q, r:hex.r})) {
            activePlayerHover = hex;
        }

    }

    function drawPopup() {

        const hex = localGrid.pointToHex(
            {x:p5.mouseX - X_OFFSET, y:p5.mouseY - Y_OFFSET},
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

                if (p5.mouseX > WIDTH / 2) {
                    rectSourceX = hex.corners[0].x + X_OFFSET - HEX_WIDTH - 10 - size[0];
                }

                p5.fill('black');
                p5.stroke('white');
                p5.rect(rectSourceX, rectSourceY, size[0], size[1]);

                p5.textAlign(p5.LEFT);
                p5.noStroke();
                p5.fill('white');
                p5.textSize(18);
                p5.text('Health potion', rectSourceX + popupXOffset, rectSourceY  + 20);

                p5.textSize(12);
                p5.text('Move here to get one 💓', rectSourceX +  popupXOffset, rectSourceY + 40);

            } else if (actionsLocations.find(([q, r]) => q === hex.q && r === hex.r)) {
                size = smallSize;

                if (p5.mouseX > WIDTH / 2) {
                    rectSourceX = hex.corners[0].x + X_OFFSET - HEX_WIDTH - 10 - size[0];
                }

                p5.fill('black');
                p5.stroke('white');
                p5.rect(rectSourceX, rectSourceY, size[0], size[1]);

                p5.textAlign(p5.LEFT);
                p5.noStroke();
                p5.fill('white');
                p5.textSize(18);
                p5.text('Action potion', rectSourceX + popupXOffset, rectSourceY  + 20);

                p5.textSize(12);
                p5.text('Move here to get one 👊', rectSourceX +  popupXOffset, rectSourceY + 40);

            } else if (buildings.find(({position}) => position.q === hex.q && position.r === hex.r)) {

                const building = buildings.find(({position}) => position.q === hex.q && position.r === hex.r);
                size = largeSize;

                if (p5.mouseX > WIDTH / 2) {
                    rectSourceX = hex.corners[0].x + X_OFFSET - HEX_WIDTH - 10 - size[0];
                }

                p5.fill('black');
                p5.stroke('white');
                p5.rect(rectSourceX, rectSourceY, size[0], size[1]);

                p5.textAlign(p5.LEFT);
                p5.noStroke();
                p5.fill('white');
                p5.textSize(18);
                p5.text(BUILDINGS[building.type].name, rectSourceX + popupXOffset, rectSourceY  + 20);

                p5.textSize(12);
                p5.text(BUILDINGS[building.type].description, rectSourceX +  popupXOffset, rectSourceY + 40);

            } else if (!hex.tank) {

                // empty

                size = smallSize;

                if (p5.mouseX > WIDTH / 2) {
                    rectSourceX = hex.corners[0].x + X_OFFSET - HEX_WIDTH - 10 - size[0];
                }

                p5.fill('black');
                p5.stroke('white');
                p5.rect(rectSourceX, rectSourceY, size[0], size[1]);

                p5.textAlign(p5.LEFT);
                p5.noStroke();
                p5.fill('white');
                p5.textSize(18);
                p5.text(TILES[hex.tile].name, rectSourceX + popupXOffset, rectSourceY  + 20);

                p5.textSize(12);
                p5.text(TILES[hex.tile].description, rectSourceX +  popupXOffset, rectSourceY + 40);
            } else if (hex.tank) {

                size = mediumSize;

                if (p5.mouseX > WIDTH / 2) {
                    rectSourceX = hex.corners[0].x + X_OFFSET - HEX_WIDTH - 10 - size[0];
                }

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

                p5.textAlign(p5.LEFT);
                p5.noStroke();
                p5.fill('white');
                p5.textSize(18);
                p5.textLeading(18);
                p5.text(
                    hex.tank.name.split(' ').join("\n"),
                    rectSourceX + popupXOffset + 30 + 5,
                    rectSourceY  + 20
                );

                p5.textSize(12);
                p5.textLeading(15);
                // p5.text(hex.tank.name, rectSourceX +  popupXOffset, rectSourceY + 40);

                // life

                if (hex.tank.life < 1) {
                    p5.text(
                        '☠',
                        rectSourceX + popupXOffset,
                        rectSourceY  + 60
                    )
                } else {
                    p5.text(
                        `💓 x ${hex.tank.life}`,
                        rectSourceX + popupXOffset,
                        rectSourceY  + 60
                    )

                    // actions
                    p5.text(
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

                    p5.text(
                        `👁 x ${hex.tank.range} ${rangeModifier}`,
                        rectSourceX + popupXOffset,
                        rectSourceY  + 90
                    );
                }



                // terrain
                p5.text(`on ${TILES[hex.tile].name}`, rectSourceX + popupXOffset, rectSourceY  + 115);

            }



        }

    }

    p5.mouseClicked = function() {

        if (currentState === States.IDLE) {
            const hex = localGrid.pointToHex(
                { x: p5.mouseX - X_OFFSET, y: p5.mouseY - Y_OFFSET },
                { allowOutside: false }
            );
            if (hex) {
                return;
            }
        }

        const hex = localGrid.pointToHex(
            { x: p5.mouseX - X_OFFSET, y: p5.mouseY - Y_OFFSET},
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

})


