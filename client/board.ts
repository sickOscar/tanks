import p5 from 'p5';
import * as Honeycomb from 'honeycomb-grid';
import {AxialCoordinates} from 'honeycomb-grid';
import {TanksHex} from "../server/app/board";
import {Tank} from "./models/Tank";
import {
    GameState,
    HEX_HEIGHT,
    HEX_SIDE,
    HEX_TOP_TRIANGLE_HEIGHT,
    HEX_WIDTH,
    pictures,
    States,
    X_OFFSET,
    Y_OFFSET
} from "./consts";
import {drawPopup} from "./game/popups";
import {io} from "socket.io-client";
import {createAuth0Client} from '@auth0/auth0-spa-js';

const sketch =  new p5((p5) => {

    let events:any[] = []
    let configFetched = false;
    let sio:any;
    let player:Tank;

    let stage = 'RUN';

    let maskGraphics:any;
    let hoverHex;
    let currentState = States.IDLE;
    const voteSelect = document.querySelector('select#vote') as HTMLSelectElement;
    const pollForm = document.querySelector('form#poll') as HTMLFormElement;
    const showPollResultsButton = document.querySelector('button#show-poll-results') as HTMLButtonElement;
    const actionsContainer = document.querySelector('#actions') as HTMLDivElement;
    const pollResultsContainer = document.querySelector('#poll-results') as HTMLDivElement;
    const pollResultsTable = document.querySelector('#poll-results-table') as HTMLTableElement;
    const modalOverlay = document.querySelector('#modal-overlay') as HTMLDivElement;
    const loginButton = document.querySelector('#btn-login') as HTMLButtonElement;
    const logoutButton = document.querySelector('#btn-logout') as HTMLButtonElement;

    let tiles:any[] = [];

    const walkableTiles = [0, 2, 3, 4, 5, 6];
    let oasisImage:any = null;
    let iceFortressImage:any = null;

    pollForm.addEventListener('submit', event => {
        event.preventDefault();
        sio.emit('playerevent', 'vote', voteSelect.value, (response:any) => {
            if (!response) {
                alert(`Well, no. You already voted today. The blockchain doesn't lie`)
            } else {
                alert('Thank you!')
            }
        })
    })

    document.addEventListener('click', event => {
        if (Array.from(event.target!.classList).includes('close-modal-button')) {
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

    // AUTH
    let auth0:any;
    const fetchAuthConfig = () => fetch("/auth_config.json");
    const configureClient = async () => {
        const response = await fetchAuthConfig();
        const config = await response.json();

        auth0 = await createAuth0Client({
            domain: config.domain,
            clientId: config.clientId,
            authorizationParams: {
                audience: config.audience,
                redirect_uri: window.location.origin
            }
        });
    };

    async function updateLoginUi() {
        const isAuthenticated = await auth0.isAuthenticated();
        loginButton.disabled = isAuthenticated;
        loginButton.style.display = isAuthenticated ? 'none' : 'flex';
        logoutButton.disabled = !isAuthenticated;
        logoutButton.style.display = !isAuthenticated ? 'none' : 'flex';

        if (isAuthenticated) {
            document.querySelector('#board-holder')!.classList.remove('d-none');
            document.querySelector('#right-side')!.classList.remove('d-none')
        } else {
            document.querySelector('#board-holder')!.classList.add('d-none');
            document.querySelector('#right-side')!.classList.add('d-none')
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

    function resizeGrid(grid:any) {
        grid.hexSettings.dimensions = {
            xRadius: HEX_SIDE,
            yRadius: HEX_SIDE
        }
        return grid;
    }

    function setupLocalGrid(grid:any) {
        const resizedGrid = resizeGrid(grid);

        const TanksHex = class extends Honeycomb.defineHex(resizedGrid.hexSettings) {
            tank:Tank|null = null;
            tile:number = 0;

            constructor({q, r, tank, tile}:{q:number, r:number, tank:Tank|null, tile:number}) {
                super({q, r});
                this.tank = tank;
                this.tile = tile
            }
        }
        GameState.localGrid = new Honeycomb.Grid<TanksHex>(TanksHex, resizedGrid.coordinates);
    }

    async function initCanvas() {

        const c = await getJson('/config');
        configFetched = true;
        setupLocalGrid(c.grid);

        GameState.WIDTH = c.cols * HEX_WIDTH + X_OFFSET;
        GameState.HEIGHT = c.rows * HEX_HEIGHT + Y_OFFSET;

        p5.resizeCanvas(GameState.WIDTH, GameState.HEIGHT);

        // MAGIC: 69 is SUPER RANDOM
        // don't understand properly how to calculate the size of the mask
        maskGraphics = p5.createGraphics(69, 69);

        const jwt = await auth0.getTokenSilently()
        connectSocket(jwt);

        GameState.players = await getJson('/players')
        events = await getJson('/events')

        drawEvents()
    }

    loginButton.addEventListener('click', () => {
        auth0.loginWithRedirect();
    })

    logoutButton.addEventListener('click', () => {
        auth0.logout();
    })

    function drawEvents() {

        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

        const markup = events.map(e => {

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


    function connectSocket(jwt:string) {
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

            const state = this.getAttribute('data-action')!;
            if (!Object.values(States).includes(state)) {
                return
            }

            if (state === States.UPGRADE ) {
                sio.emit('playerevent', States.UPGRADE, null, (isValid:boolean) => {
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


    function addPlayerAction(action:any) {
        events.unshift(action)
        drawEvents();
    }

    function setBoard(serverMessage:string) {

        const parsedMessage = JSON.parse(serverMessage);

        console.log(`parsedMessage`, parsedMessage)
        setupLocalGrid(parsedMessage.grid);

        const playersList:Tank[] = [];

        GameState.localGrid!.forEach(hex => {
            if (hex.tank) {
                playersList.push(hex.tank);
            }

            if (hex.tank) {
                if (!pictures[hex.tank.id]) {
                    pictures[hex.tank.id] = p5.loadImage(hex.tank.picture)
                }
            }

            if (hex.tank && hex.tank.id === GameState.playerId) {
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

        GameState.heartsLocations = parsedMessage.features.heartsLocations;
        GameState.actionsLocations = parsedMessage.features.actionsLocations;
        GameState.buildings = parsedMessage.features.buildings;

        // debugger;

    }

    function setPlayer(id:string) {
        GameState.playerId = id;
    }


    function setOnline(playersList:string) {
        try {
            const onlinePlayers = JSON.parse(playersList);

            const listItems = onlinePlayers.map((p:any) => `
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

        GameState.activePlayerHover = null;

        p5.clear();
        if (!configFetched || !GameState.localGrid) {
            return;
        }

        if (stage === 'RUN') {
            // p5.image(backgroundImage, 0, 0);
            drawBoard();
        }

        drawCursor();
        // drawPlayerHover();
        drawPopup(p5);

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
        if (!GameState.activePlayerHover) {
            return;
        }

        const hex = GameState.activePlayerHover;

        p5.textSize(14);
        p5.noStroke();
        p5.fill('white');
        p5.textAlign(p5.CENTER);
        p5.text(hex.tank!.name, hex.corners[2].x + X_OFFSET, hex.corners[2].y + Y_OFFSET + 16)

    }

    function drawBoard() {
        p5.noFill();
        p5.stroke('white');
        GameState.localGrid!.forEach(drawCell);
    }


    function drawCoordinates(hex:TanksHex) {
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


            if (GameState.heartsLocations) {
                const hasHeart = GameState.heartsLocations.find(loc => {
                    return loc[0] === hex.q && loc[1] === hex.r
                })
                if (hasHeart) {
                    drawHeart(hex);
                }
            }

            if (GameState.actionsLocations) {
                const hasAction = GameState.actionsLocations.find(loc => {
                    return loc[0] === hex.q && loc[1] === hex.r
                })
                if (hasAction) {
                    drawAction(hex);
                }
            }

            if (GameState.buildings) {
                const hasBuilding = GameState.buildings.find(building => {
                    return building.position.q === hex.q && building.position.r === hex.r
                })
                if (hasBuilding) {
                    drawBuilding(hex, hasBuilding);
                }
            }


        } else {

            if (hex.tank?.id === GameState.playerId) {
                drawPlayer(hex);
            } else {
                drawPlayer(hex)
            }
        }

        drawCoordinates(hex);


    }

    function drawBuilding(hex:TanksHex, building:any) {
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

    function isInRange(destinationCell:AxialCoordinates, startingCell:AxialCoordinates, range:number, shooting  = false) {
        let finalRange = range;
        if (shooting) {
            const startingTile = GameState.localGrid?.getHex({q: startingCell.q, r: startingCell.r})?.tile;
            const destinationTile = GameState.localGrid?.getHex({q: destinationCell.q, r: destinationCell.r})?.tile;
            if (startingTile === 4) {
                finalRange = range + 1;
            }
            if (startingTile === 3 || destinationTile === 3) {
                finalRange = range - 1;
            }
        }
        return GameState.localGrid!.distance(destinationCell, startingCell) <= finalRange
    }

    function isWalkable(hex:TanksHex) {
        return walkableTiles.includes(hex.tile);
    }

    function drawAction(hex:TanksHex) {

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

        if (GameState.localGrid!.pointToHex({x: p5.mouseX - X_OFFSET, y: p5.mouseY - Y_OFFSET}) === hex) {
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
        if (!tank) {
            return;
        }

        const [...corners] = hex.corners;

        if (pictures[tank.id]) {

            const origin = corners[4];
            const originOffset = p5.createVector(origin.x + X_OFFSET, origin.y + Y_OFFSET);
            originOffset.y = originOffset.y - HEX_TOP_TRIANGLE_HEIGHT;

            maskGraphics.fill('rgba(0,0,0,1)');
            maskGraphics.beginShape();
            corners.forEach(({ x, y }) => {
                maskGraphics.vertex(x + X_OFFSET - originOffset.x, y + Y_OFFSET - originOffset.y);
            })
            maskGraphics.endShape(p5.CLOSE);


            pictures[tank.id].mask(maskGraphics);

            p5.image(
                pictures[tank.id],
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

        if (GameState.localGrid!.pointToHex({x:p5.mouseX - X_OFFSET, y:p5.mouseY - Y_OFFSET}).equals({q:hex.q, r:hex.r})) {
            GameState.activePlayerHover = hex;
        }

    }



    p5.mouseClicked = function() {

        if (currentState === States.IDLE) {
            const hex = GameState.localGrid!.pointToHex(
                { x: p5.mouseX - X_OFFSET, y: p5.mouseY - Y_OFFSET },
                { allowOutside: false }
            );
            if (hex) {
                return;
            }
        }

        const hex = GameState.localGrid!.pointToHex(
            { x: p5.mouseX - X_OFFSET, y: p5.mouseY - Y_OFFSET},
            { allowOutside: false }
        );
        if (hex) {
            sio.emit('playerevent', currentState, {q: hex.q, r: hex.r}, (isValid:boolean) => {
                if (isValid) {
                    currentState = States.IDLE;
                } else {
                    //  animate(cell, 'BLOW')
                }
            });
        }

    }

})


