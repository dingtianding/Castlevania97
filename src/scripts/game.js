import Sprite from "./sprite.js"
import { playerSprite, enemySprite } from "./characters.js";


let player = playerSprite;
let enemy = enemySprite;

const background = new Sprite ({
    position: {
        x: 0,
        y: 0
    },
    imageSrc: 'assets/background2.png'
})

// const shop = new Sprite ({
//     position: {
//         x: 600,
//         y: 128
//     },
//     imageSrc: 'assets/shop.png',
//     scale: 2.75,
//     framesMax: 6
// })    


export default class Game {  
  constructor() {
  }

}

    const gravity = 0.7

    const keys = {
        a: {
            pressed: false
        },
        d: {
            pressed: false
        },
        ArrowRight: {
            pressed: false
        },
        ArrowLeft: {
            pressed: false
        }
    }

    let lastKey


    window.addEventListener('keydown', (event) => {
        if (!player.dead){

        switch (event.key){
            case 'd':
                keys.d.pressed = true
                player.lastKey = 'd'
                break
            case 'a':
                keys.a.pressed = true
                player.lastKey = 'a'
                break
            case 'w':
                player.velocity.y = -20
                break
            case 's':
                player.attack()
                break
        }
    }

    if (!enemy.dead){

        switch (event.key){
        case 'ArrowRight':
                keys.ArrowRight.pressed = true
                enemy.lastKey = 'ArrowRight'
                break
            case 'ArrowLeft':
                keys.ArrowLeft.pressed = true
                enemy.lastKey = 'ArrowLeft'
                break
            case 'ArrowUp':
                enemy.velocity.y = -20
                break
            case 'ArrowDown':
                enemy.attack()
                break
        }
    }

    })

    window.addEventListener('keyup', (event) => {
        //Player 
        switch (event.key){
            case 'd':
                keys.d.pressed = false
                break
            case 'a':
                keys.a.pressed = false
                break
        }
        //Enemy
        switch (event.key){
            case 'ArrowRight':
                keys.ArrowRight.pressed = false
                break
            case 'ArrowLeft':
                keys.ArrowLeft.pressed = false
                break
        }
    });

let timer = 30
let timerId

export function countDown() {
    if (timer > 0) {
        timerId = setTimeout(countDown, 1000)
        timer--
        document.querySelector('#timer').innerHTML = timer
    }
    if(timer === 0){
        determineWinner({player, enemy, timerId})
        
    }
}

export function animate(){
    const canvas = document.querySelector('canvas');
    const c = canvas.getContext('2d');

    c.fillRect(0, 0, canvas.width, canvas.height)

    window.requestAnimationFrame(animate)
    c.fillStyle = 'black'
    c.fillRect(0, 0, canvas.width, canvas.height)
    background.update()
    // shop.update()
    c.fillStyle = 'rgba(255, 255, 255, 0.15'
    c.fillRect(0, 0, canvas.width, canvas.height)
    player.update()
    enemy.update()

    player.velocity.x = 0
    enemy.velocity.x = 0


    // Player movement
    player.switchSprites('idle')
    if(keys.a.pressed && player.lastKey === 'a') {
        player.velocity.x = -5
        player.switchSprites('run')
    } else if (keys.d.pressed && player.lastKey === 'd') {
        player.velocity.x = 5
        player.switchSprites('run')
    } else {
        player.switchSprites('idle')
    }
    //Player Jumping
    if (player.velocity.y < 0){
        player.switchSprites('jump')
    } else if (player.velocity.y > 0){
        player.switchSprites('fall')
    }
    // Enemy momvent
    if(keys.ArrowLeft.pressed && enemy.lastKey === 'ArrowLeft') {
        enemy.velocity.x = -5
        enemy.switchSprites('run')
    } else if (keys.ArrowRight.pressed && enemy.lastKey === 'ArrowRight') {
        enemy.velocity.x = 5
        enemy.switchSprites('run')
    } else {
        enemy.switchSprites('idle')
    }

    // Enemy Jumping
    if (player.velocity.y < 0){
        player.switchSprites('jump')
    } else if (player.velocity.y > 0){
        player.switchSprites('fall')
    }

    // Detect collison & enemy gets hit
    if (rectangularCollision({
        rectangle1: player,
        rectangle2: enemy
    }) &&
    player.isAttacking && 
    player.framesCurrent === 4
        
    ) {
        enemy.takeHit()
        player.isAttacking = false

        gsap.to('#enemyHealth', {
            width: enemy.health + '%'
        })
    }
    // if player missed attack
    if (player.isAttacking && player.framesCurrent === 4){
        player.isAttacking = false
    }
    // if player gets hit
    if (rectangularCollision({
        rectangle1: enemy,
        rectangle2: player
    }) &&
    enemy.isAttacking && 
    enemy.framesCurrent === 2
        
    ) {
        player.takeHit()
        enemy.isAttacking = false
        gsap.to('#playerHealth', {
            width: player.health + '%'
        })
    }
    // if enemy missed attack
    if (enemy.isAttacking && enemy.framesCurrent === 2){
        enemy.isAttacking = false
    }

    if(enemy.health <= 0 || player.health <= 0) {
        determineWinner({player, enemy, timerId})
    }

}

function rectangularCollision({ rectangle1, rectangle2 }){
    return(
        rectangle1.attackBox.position.x + rectangle1.attackBox.width >= rectangle2.position.x && // when rectangle1'attack goes into rectangle2 position vertically
        rectangle1.attackBox.position.x <= rectangle2.position.x + rectangle2.width && // when rectangle2's attack goes into rectangle1 vertically
        rectangle1.attackBox.position.y + rectangle1.attackBox.height >=rectangle2.position.y && // when rectangle1'attack goes into rectangle2 position horizontally
        rectangle1.attackBox.position.y <= rectangle2.position.y + rectangle2.height // when rectangle2's attack goes into rectangle1 horizontally
    )
}


function determineWinner({player, enemy, timerId}){
    document.querySelector('#displayText').style.display = 'flex'
    clearTimeout(timerId)
    if(player.health === enemy.health){
        document.querySelector('#displayText').innerHTML = 'Tie'
    } else if(player.health > enemy.health){
        document.querySelector('#displayText').innerHTML = 'Player 1 Wins'
    } else if(player.health < enemy.health){
        document.querySelector('#displayText').innerHTML = 'Player 2 Wins'
    }
}




