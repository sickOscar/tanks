import {IEvent} from "../model/IEvent";
import {IScoreboardRow} from "../model/IScoreboard";

class ScoreboardRow implements IScoreboardRow {
    actor: string;
    kills: number;
    deaths: number;
    hasHeal: number;
    hasBeenHealed: number;
    name: string;
    picture: string;

    constructor(actor: string, name = "", picture = "") {
        this.actor = actor;
        this.kills = 0;
        this.deaths = 0;
        this.hasHeal = 0;
        this.hasBeenHealed = 0;
        this.name = name;
        this.picture = picture;
    }

    addKills() {
        this.kills++;
    }

    addDeaths() {
        this.deaths++;
    }

    hasHealSomeone() {
        this.hasHeal++;
    }

    hasBeenHealedBySomeone() {
        this.hasBeenHealed++;
    }
}

export default class ScoreboardDTO {
    static fromEventsToScoreboard(events: IEvent[], players: {
        id: string,
        picture: string,
        name: string
    }[]): IScoreboardRow[] {
        const mapScoreboard = new Map<string, ScoreboardRow>();

        players.forEach((player) => {
            const playerRow = new ScoreboardRow(player.id, player.name, player.picture);
            mapScoreboard.set(playerRow.actor, playerRow);
        });

        events.forEach((event) => {
            switch (event.action) {
                case "kill":
                    mapScoreboard.get(event.actor)?.addKills();
                    mapScoreboard.get(event.enemy)?.addDeaths();
                    break;
                case "heal":
                    mapScoreboard.get(event.actor)?.hasHealSomeone();
                    mapScoreboard.get(event.enemy)?.hasBeenHealedBySomeone();
                    break;
                default:
                    break;
            }
        });

        return [...mapScoreboard.values()];
    }
}
