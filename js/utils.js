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