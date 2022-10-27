export default class Music {
    constructor() {
      this.music = document.querySelector("#game-music");
      this.toggle = document.querySelector("#mute-button");
      this.muted = true;
      this.music.volume = 0.10;
    };
  
    addEventListeners() {
      this.toggle.addEventListener("click", (event) => {
        if (this.muted) {
          this.music.currentTime = 0;
          this.music.play();
          this.toggle.innerText = "Mute Music";
          this.muted = false;
        } else {
          this.music.pause();
          this.toggle.innerText = "Play Music";
          this.muted = true;
        }
      });
    };
  }