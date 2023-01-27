export interface IEvent {
    id: number,
    game: number,
    actor: string,
    action: string,
    destination: number[],
    enemy: string,
    created_at: Date
}
