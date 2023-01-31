import db from "../db";
import {AxialCoordinates} from "honeycomb-grid";

export interface Action {
    actor: any;
    created_at: any;
    action: string;
    enemy?: any;
    destination?: AxialCoordinates;
}

export interface PlayerParams {
    id: string;
    name: string;
    picture: string;
}

export class Player {

    id:string;
    name:String;
    picture;

    constructor(params:PlayerParams) {
        this.id = params.id;
        this.name = params.name;
        this.picture = params.picture;
    }

    static async get(playerId:string, gameId:number):Promise<{sub:string,game:number}|undefined> {
        const res = await db.query(`
            SELECT * FROM players WHERE sub = $1 AND game = $2
        `, [playerId, gameId])
        return res.rows[0];
    }

}