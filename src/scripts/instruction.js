export default class Instruction {
    constructor() {
      this.open = document.querySelector("#instructions-button");
      this.close = document.querySelector("#instructions-exit");
      this.instructions = document.querySelector("#instructions");
    }
  
    openPopup(instructions) {
      instructions.classList.add("active");
    }
  
    closePopup(instructions) {
      instructions.classList.remove("active");
    }
  
    addEventListeners() {
      this.open.addEventListener("click", (event) => {
        this.openPopup(this.instructions);
      });
  
      this.close.addEventListener("click", (event) => {
        this.closePopup(this.instructions);
      });
    }
  };