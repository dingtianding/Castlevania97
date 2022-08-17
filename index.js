const canvas = document.querySelector('canvas'); 
const c = canvas.getContext('2d')

canvas.width = 1024
canvas.height = 576

c.fillRect(0, 0, canvas.width, canvas.height)

const gravity = 0.7

const background = new Sprite ({
    position: {
        x: 0,
        y: 0
    },
    imageSrc: 'assets/background.png'
})

const player = new Fighter({
    position: {
    x: 0,
    y: 0,
        },
    velocity: {
    x: 0,
    y: 10,
    },
    offset: {
        x: 0,
        y: 0
    }
})

const enemy = new Fighter({
    position: {
    x: 400,
    y: 100,
        },
    velocity: {
    x: 0,
    y: 0,
    },
    color: 'red',
    offset: {
        x: -50,
        y: 0
    }
})

enemy.draw()

console.log(player)

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
let timer = 20
let timerId
function countDown() {
    if (timer > 0) {
        timerId = setTimeout(countDown, 1000)
        timer--
        document.querySelector('#timer').innerHTML = timer
    }
    if(timer === 0){
        determineWinner({player, enemy, timerId})
        
    }
}
countDown()

function animate(){
    window.requestAnimationFrame(animate)
    c.fillStyle = 'black'
    c.fillRect(0, 0, canvas.width, canvas.height)
    background.update()
    player.update()
    enemy.update()

    player.velocity.x = 0
    enemy.velocity.x = 0


    // Player movement
    if(keys.a.pressed && player.lastKey === 'a') {
        player.velocity.x = -5
    } else if (keys.d.pressed && player.lastKey === 'd') {
        player.velocity.x = 5
    }
    // Enemy momvent
    if(keys.ArrowLeft.pressed && enemy.lastKey === 'ArrowLeft') {
        enemy.velocity.x = -5
    } else if (keys.ArrowRight.pressed && enemy.lastKey === 'ArrowRight') {
        enemy.velocity.x = 5
    }

    // Detect collison
    if (rectangularCollision({
        rectangle1: player,
        rectangle2: enemy
    }) &&
    player.isAttacking
        
    ) {
        player.isAttacking = false
        enemy.health -= 10
        document.querySelector('#enemyHealth').style.width = enemy.health + '%'
        console.log('hit')
    }

    if (rectangularCollision({
        rectangle1: enemy,
        rectangle2: player
    }) &&
    enemy.isAttacking
        
    ) {
        enemy.isAttacking = false
        player.health -= 10
        document.querySelector('#playerHealth').style.width = player.health + '%'
        console.log('got hit')
    }

    if(enemy.health <= 0 || player.health <= 0) {
        determineWinner({player, enemy, timerId})
    }

}

animate()

window.addEventListener('keydown', (event) => {
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
        case ' ':
            player.attack()
            break

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
})