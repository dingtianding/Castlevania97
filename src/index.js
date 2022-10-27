import Game from "./scripts/game.js"
import Instruction from "./scripts/instruction.js"
import Music from "./scripts/music.js"

import { animate, countDown } from "./scripts/game.js"


document.addEventListener("DOMContentLoaded", function () {
    const canvas = document.querySelector('canvas');
    const c = canvas.getContext('2d');

    canvas.width = 1024
    canvas.height = 576

    let game = new Game();


    let music = new Music();
    music.addEventListeners();
  
    let instruction = new Instruction();
    instruction.addEventListeners();


    animate();
    countDown()
});




