import Fighter from "./fighter.js"

const player = new Fighter({
    position: {
    x: 256,
    y: 0,
        },
    velocity: {
    x: 0,
    y: 10,
    },
    offset: {
        x: 0,
        y: 0
    },
    imageSrc: 'assets/hero/Idle.png',
    framesMax: 4,
    scale: 2.5,
    offset: {
        x: 215,
        y: 157
    },
    sprites: {
        idle: {
            imageSrc: 'assets/hero/Idle.png',
            framesMax: 4
        },
        run: {
            imageSrc: 'assets/samuraiMack/Run.png',
            framesMax: 8
        },
        jump: {
            imageSrc: 'assets/samuraiMack/Jump.png',
            framesMax: 2
        },
        fall: {
            imageSrc: 'assets/samuraiMack/Fall.png',
            framesMax: 2
        },
        attack1: {
            imageSrc: 'assets/samuraiMack/Attack1.png',
            framesMax: 6
        },
        takeHit: {
            imageSrc: 'assets/samuraiMack/Take Hit - white silhouette.png',
            framesMax: 4
        },
        death: {
            imageSrc: 'assets/samuraiMack/Death.png',
            framesMax: 6
        },
    },
        attackBox: {
            offset:{
                x: 100,
                y: 50
            },
            width: 160,
            height: 50
        }
    
})

const enemy = new Fighter({
    position: {
    x: 768,
    y: 100,
        },
    velocity: {
    x: 0,
    y: 0,
    },
    offset: {
        x: -50,
        y: 0
    },
    imageSrc: 'assets/kenji/Idle.png',
    framesMax: 4,
    scale: 2.5,
    offset: {
        x: 215,
        y: 167
    },
    sprites: {
        idle: {
            imageSrc: 'assets/kenji/Idle.png',
            framesMax: 4
        },
        run: {
            imageSrc: 'assets/kenji/Run.png',
            framesMax: 8
        },
        jump: {
            imageSrc: 'assets/kenji/Jump.png',
            framesMax: 2
        },
        fall: {
            imageSrc: 'assets/kenji/Fall.png',
            framesMax: 2
        },
        attack1: {
            imageSrc: 'assets/kenji/Attack1.png',
            framesMax: 4
        },
        takeHit: {
            imageSrc: 'assets/kenji/Take hit.png',
            framesMax: 3
        },
        death: {
            imageSrc: 'assets/kenji/Death.png',
            framesMax: 7
        },
    },
    attackBox: {
        offset:{
            x: -170,
            y: 50
        },
        width: 170,
        height: 50
    }
    
})

export const playerSprite = player;
export const enemySprite = enemy;