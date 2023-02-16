import p5 from 'p5';
import * as Honeycomb from 'honeycomb-grid';
import {TanksHex} from "../server/app/board";
import {Tank} from "./models/Tank";
import {GameGraphics, GameState, HEX_HEIGHT, HEX_SIDE, HEX_WIDTH, pictures, States, X_OFFSET, Y_OFFSET} from "./consts";
import {drawPopup} from "./game-ui/popups";
import {io} from "socket.io-client";
import {createAuth0Client} from '@auth0/auth0-spa-js';
import {drawBoard} from "./game-ui/board";
import MicroModal from 'micromodal';
import {ActionResult} from "../server/app/action-result";
import { drawCursor } from './game-ui/mouse';
import {drawEvents, setOnline} from "./game-ui/html-elements";

MicroModal.init();


new p5((p5) => {


    let configFetched = false;
    let sio:any;
    let visibleActions = false;

    let stage = 'RUN';
    // AUTH
    let auth0:any;

    const voteSelect = document.querySelector('select#vote') as HTMLSelectElement;
    const pollForm = document.querySelector('form#poll') as HTMLFormElement;
    const showPollResultsButton = document.querySelector('button#show-poll-results') as HTMLButtonElement;
    const actionsContainer = document.querySelector('#actions') as HTMLDivElement;
    const pollResultsContainer = document.querySelector('#poll-results') as HTMLDivElement;
    const pollResultsTable = document.querySelector('#poll-results-table') as HTMLTableElement;
    const modalOverlay = document.querySelector('#modal-overlay') as HTMLDivElement;
    const loginButton = document.querySelector('#btn-login') as HTMLButtonElement;
    const logoutButton = document.querySelector('#btn-logout') as HTMLButtonElement;
    const actionButtons = document.querySelectorAll(`#actions  button`) as NodeListOf<HTMLButtonElement>;
    const boardContainer = document.querySelector('#board-holder') as HTMLDivElement;

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

    showPollResultsButton.addEventListener('click', event => {
        event.preventDefault();
        pollResultsContainer.classList.remove('d-none');
        modalOverlay.classList.remove('d-none');

        getJson('poll')
            .then(response => {
                pollResultsTable.innerHTML = response.map((row:any) => `
                <tr>
                    <td><img class="img-thumbnail" src="${row.picture}" alt="${row.name}"></td>
                    <td>${row.name}</td>
                    <td>${row.count}</td>
                </tr>
            `).join('')
            })
            .catch(console.error)
    })


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
            boardContainer.classList.remove('d-none');
        } else {
            boardContainer.classList.add('d-none');
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

                if (this.tank && tank) {
                    this.tank.buffs = new Set(tank.buffs);
                }

                this.tile = tile
            }
        }
        // non ho voglia di capire come tipizzare questo
        // @ts-ignore
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
        GameGraphics.maskGraphics = p5.createGraphics(69, 69);

        const jwt = await auth0.getTokenSilently()
        connectSocket(jwt);

        GameState.players = await getJson('/players')
        GameState.events = await getJson('/events')

        drawEvents()
    }

    loginButton.addEventListener('click', () => {
        auth0.loginWithRedirect();
    })

    logoutButton.addEventListener('click', () => {
        auth0.logout();
    })


    function connectSocket(jwt:string) {
        sio = io('', {
            auth: {
                token: `Bearer ${jwt}`
            }
        });

        sio.on('player', setPlayer)
        // sio.on('message', newMessage);
        sio.on('board', updateBoard);
        sio.on('playerslist', setOnline);
        sio.on('action', addPlayerAction)

        sio.on('connect_error', (error:any) => {
            console.error(error)
        })
    }

    actionButtons.forEach(el => {
        el.addEventListener('click', function () {

            if (!GameState.player) {
                return;
            }

            const state = this.getAttribute('data-action')!;
            if (!Object.values(States).includes(state)) {
                return
            }

            if (state === States.UPGRADE ) {
                sio.emit('playerevent', States.UPGRADE, null, (_isValid:boolean) => {
                    console.log('upgraded');
                });
            } else {
                if (GameState.currentState === state) {
                    GameState.currentState = States.IDLE
                } else {
                    GameState.currentState = state;
                }
            }

        })
    })


    function addPlayerAction(action:any) {
        GameState.events.unshift(action)
        drawEvents();
    }

    function updateBoard(serverMessage:string) {

        const parsedMessage = JSON.parse(serverMessage);

        // console.log(`parsedMessage`, parsedMessage)
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
                GameState.player = hex.tank;
            }
        })

        if (GameState.player && GameState.player.life > 0) {
            actionsContainer.classList.remove('d-none');
            visibleActions = true;
            pollForm.classList.add('d-none')
        }

        if (GameState.player && GameState.player.life <= 0) {
            visibleActions = false;
            actionsContainer.classList.add('d-none');
            pollForm.classList.remove('d-none')
        }

        GameState.heartsLocations = parsedMessage.features.heartsLocations;
        GameState.actionsLocations = parsedMessage.features.actionsLocations;
        GameState.buildings = parsedMessage.features.buildings;

        voteSelect.innerHTML = playersList
            .filter(p => p.life > 0)
            .map(p => `
            <option value=${p.id}>${p.name}</option>
        `)
            .join('')

        // debugger;

    }

    function setPlayer(id:string) {
        GameState.playerId = id;
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
        GameGraphics.tiles = [
            p5.loadImage('./assets/grass.png'),
            p5.loadImage('./assets/sea.png'),
            p5.loadImage('./assets/desert.png'),
            p5.loadImage('./assets/forest.png'),
            p5.loadImage('./assets/mountain.png'),
            p5.loadImage('./assets/swamp.png'),
            p5.loadImage('./assets/ice.png'),
        ]

        GameGraphics.oasisImage = p5.loadImage('./assets/oasis.webp');
        GameGraphics.iceFortressImage = p5.loadImage('./assets/ice_fortress.webp');

    }

    p5.setup = function() {
        const canvas = p5.createCanvas(100, 100);
        canvas.parent('board-holder')

        GameGraphics.maskGraphics = p5.createGraphics(100, 100);

        p5.frameRate(10)
    }

    p5.draw = function() {

        GameState.activePlayerHover = null;

        p5.clear();
        if (!configFetched || !GameState.localGrid) {
            return;
        }

        if (stage === 'RUN') {
            drawBoard(p5);
        }

        drawCursor(p5);
        drawPopup(p5);

    }



    p5.mouseClicked = function() {

        if (GameState.currentState === States.IDLE) {
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

            MicroModal.show('action-confirm');


            sio.emit('playerevent', GameState.currentState, {q: hex.q, r: hex.r}, (actionResult:ActionResult) => {
                console.log(`actionResult`, actionResult)
                if (actionResult.exit) {
                    GameState.currentState = States.IDLE;
                } else {
                    console.log(actionResult.failReason)
                    //  animate(cell, 'BLOW')
                }
            });
        }

    }

})


