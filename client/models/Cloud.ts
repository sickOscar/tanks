export enum CloudDirection {
    LEFT,
    RIGHT,
    UP,
    DOWN
}

export class Cloud {

    image:any;
    x:number;
    y:number;
    speed:number;
    direction:CloudDirection;
    
    constructor(image: any, x:number, y:number, speed:number, direction:CloudDirection) {
       this.image = image;
       this.x = x;
       this.y = y;
       this.speed = speed;
       this.direction = direction;
    }

    move() {
        this.x += this.speed;
    }

}
