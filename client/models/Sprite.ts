import p5 from "p5";

export class Sprite {

    x: number;
    y: number;
    w: number;
    h: number;
    len: number;
    index: number;
    animation: any[];
    speed: number;

    constructor(animation:any[]) {
        this.x = 0
        this.y = 0
        this.animation = animation;
        this.w = animation[0].width;
        this.h = animation[0].height;
        this.len = animation.length;
        this.index = 0;
        this.speed = 1;
    }

    place(x:number, y:number, w:number|undefined=undefined, h:number|undefined=undefined, random_time=false, speed=1) {
        this.x = x;
        this.y = y;
        this.h = h != undefined ? h : this.h;
        this.w = w != undefined ? w : this.w;
        this.speed = speed;
        this.index = random_time ? Math.floor(Math.random() * this.len) : 0
    }

    animate(p5:p5) {
        this.index += this.speed;
        let index = Math.floor(this.index) % this.len;
        p5.image(this.animation[index], this.x, this.y, this.w, this.h);
    }
}
