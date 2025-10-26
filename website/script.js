// import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
// import { 
//   getFirestore, collection, addDoc, serverTimestamp 
// } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

let blocks = [];
let variables = {}; // Store int variables

function getKeyByValue(obj, value) {
    for (let key in obj) {
        if (obj[key] === value) {
            return key;
        }
    }
    return null; // if not found
}

// ======================
// Helper Functions
// ======================

// Convert "#RRGGBB" or "(r,g,b)" to {r,g,b}
function parseColor(input) {
  if (!input) return { r: 0, g: 255, b: 0 };
  const rgbMatch = input.match(/\(?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)?/);
  if (rgbMatch) return { r: +rgbMatch[1], g: +rgbMatch[2], b: +rgbMatch[3] };
  const s = input.replace('#', '');
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Convert brightness strings like "50%" or variable names to 0–255 scale
function parseBrightness(value) {

  // console.log("I SURVIVED");
  // if (variables[value] !== undefined) value = variables[value];
  // const match = value.toString().match(/(\d+)/);
  // const num = match ? Number(match[1]) : 100;
  // return Math.round((num / 100) * 255);
  return value;
}

// Resolve value: if a variable name, return variable; else return literal
function resolveValue(val) {
  if (variables[val] !== undefined) return variables[val];
  return val;
}


// ======================
// Block Generators
// ======================

const BLOCK_GENERATORS = {
  light: ({ lightIDs, color }) => {
    const { r, g, b } = parseColor(color || "#00FF00");

    // Single lightID (number or variable name)
    if (lightIDs.length == 1) {
          console.log(`L, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[0]) - 1).toString()}, ${r}, ${g}, ${b}`);
          return `L, ${variables[`${getKeyByValue(variables, lightIDs[0])}`]}, ${variables[`${getKeyByValue(variables, lightIDs[0])}`]}, ${r}, ${g}, ${b}`;
      }
    // Multiple lightID (number)
    console.log(`L, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[lightIDs.length - 1]) - 1).toString()}, ${r}, ${g}, ${b}`);
    return `L, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[lightIDs.length - 1]) - 1).toString()}, ${r}, ${g}, ${b}`; // "L, int, int, R, G, B"
  },

  turnOff: ({ lightIDs }) => {

    // Single lightID (number or variable name)
    if (lightIDs.length == 1) {
          console.log(`C, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[0]) - 1).toString()}`);
          return `C, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[0]) - 1).toString()}`;
      }
    // Multiple lightID (number)
    console.log(`C, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[lightIDs.length - 1]) - 1).toString()}`);
    return `C, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[lightIDs.length - 1]) - 1).toString()}`; // "C, int, int"
  },

  setBrightness: ({ lightIDs, brightness }) => {
    if (lightIDs.length == 1) {
          console.log(`brightness = ${brightness}`);
          console.log(`B, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[0]) - 1).toString()}, ${parseBrightness(parseInt(brightness)).toString()}`);
          return `B, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[0]) - 1).toString()}, ${parseBrightness(parseInt(brightness)).toString()}`;
      }
    // Multiple lightID (number)
    console.log(`B, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[lightIDs.length - 1]) - 1).toString()}, ${parseBrightness(parseInt(brightness)).toString()}`);
    return `B, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[lightIDs.length - 1]) - 1).toString()}, ${parseBrightness(parseInt(brightness)).toString()}`;
  },
  delay: ({ ms }) => {
    console.log(`D, ${resolveValue(ms)}`);
    return `D, ${resolveValue(ms)}`;
  },

  setVar: ({ varName, value }) => `${varName} = ${resolveValue(value)};`,

  incVar: ({ varName, value }) => `${varName} += ${resolveValue(value)};`,

  changeVar: ({ varName, value }) => `${varName} += ${resolveValue(value)};`,

  update: () => {
    console.log(`S`);
    return `S`;
  }
};


// ======================
// CodeBlock Class
// ======================

class CodeBlock {
  constructor(type, lightIDs = [], color = "#00FF00", extra = {}) {
    this.type = type;
    this.lightIDs = lightIDs;
    this.color = color;
    this.extra = extra; // brightness, ms, varName, value, etc.
  }

  toCode() {
    const gen = BLOCK_GENERATORS[this.type];
    if (!gen) throw new Error(`Unknown block type: ${this.type}`);

    // If there’s a single light ID, check if it’s a variable
    if (this.lightIDs.length === 1) {
      const id = this.lightIDs[0];
      if (variables.hasOwnProperty(id)) {
        // Pass the variable name itself, not the value
        return gen({
          type: this.type,
          lightIDs: [id], // <-- variable name as string
          color: this.color,
          ...this.extra,
        }).trim();
      }
    }

    // Default: use the numeric light IDs
    return gen({
      type: this.type,
      lightIDs: this.lightIDs,
      color: this.color,
      ...this.extra,
    }).trim();
  }

}

// ======================
// Build Arduino Sketch
// ======================

function buildArduinoSketch(blocks) {
  const includes = `#include <Adafruit_NeoPixel.h>

#define PIN 2
#define NUM_LEDS 100
Adafruit_NeoPixel strip(NUM_LEDS, PIN, NEO_GRB + NEO_KHZ800);
`;

let dynamicVars = ``;

for(let val in variables){
  dynamicVars += `
  int ${val} = 0;`
}

  const setup = `
void setup() {
  strip.begin();
  strip.show(); // all LEDs off
}
`;

  const loopBody = blocks.map(b => b.toCode()).join('\n\n');

  const loop = `
void loop() {
${indent(loopBody, 2)}
}
`;

  return `${includes}\n${dynamicVars}\n${setup}\n${loop}\n`;
}

// simple indentation helper
function indent(text, spaces = 2) {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map(l => (l ? pad + l : l)).join('\n');
}

// ======================
// Download
// ======================

function downloadTextFile(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ======================
// Variables
// ======================

function createVariable() {
  const nameInput = document.getElementById('newVarName');
  const name = nameInput.value.trim();
  if (!name) return alert("Enter a variable name");
  if (variables[name] !== undefined) return alert("Variable already exists");
  variables[name] = 0;
  renderVariables();
  nameInput.value = '';
}

function renderVariables() {
  const list = document.getElementById('variablesList');
  list.innerHTML = '';
  Object.keys(variables).forEach(name => {
    const li = document.createElement('li');
    li.textContent = `${name} = ${variables[name]}`;
    list.appendChild(li);
  });
}

// ======================
// UI Block Functions
// ======================

let blockSpace = document.getElementById("blockSpace");

// function setColorBlockClicked() {
//   blockSpace.innerHTML += `
//     <span class="setColorBlock" style="margin-left:1vh;margin-top:0;margin-bottom:1vh;">
//       light <input type="text" class="setColorBlockPinNum" placeholder="ID">
//       set color <input type="text" class="setColorBlockColorInput" placeholder="(r,g,b)" style="width: 15vh;">
//     </span>`;
// }

// function turnOffBlockClicked() {
//   blockSpace.innerHTML += `
//     <span class="turnOffBlock" style="margin-left:1vh;margin-top:0;margin-bottom:1vh;">
//       turn off light <input class="turnOffBlockPinNum" type="text" placeholder="ID">
//     </span>`;
// }

// function setBrightnessBlockClicked() {
//   blockSpace.innerHTML += `
//     <span class="setBrightnessBlock" style="margin-left:1vh;margin-top:0;margin-bottom:1vh;">
//       light <input class="setBrightnessBlockPinNum" type="text" placeholder="ID">
//       setBrightness <input class="setBrightnessBlockBrightnessInput" type="text" placeholder="%">
//     </span>`;
// }

// function delayBlockClicked() {
//   blockSpace.innerHTML += `
//     <span class="delayBlock" style="margin-left:1vh;margin-top:0;margin-bottom:1vh;">
//       wait <input type="text" class="delayBlockTime" placeholder="ms">
//     </span>`;
// }

// function setVarBlockClicked() {
//   blockSpace.innerHTML += `
//     <span class="setVarBlock" style="margin-left:1vh;margin-top:0;margin-bottom:1vh;">
//       set <select class="varSelect"></select> = <input class="varValueInput" placeholder="value">
//     </span>`;
//   blockSpace.querySelectorAll('.setVarBlock select').forEach(populateVarSelect);
// }

// function incVarBlockClicked() {
//   blockSpace.innerHTML += `
//     <span class="incVarBlock" style="margin-left:1vh;margin-top:0;margin-bottom:1vh;">
//       increment <select class="varSelect"></select> by <input class="varValueInput" placeholder="value">
//     </span>`;
//   blockSpace.querySelectorAll('.incVarBlock select').forEach(populateVarSelect);
// }

// function changeVarBlockClicked() {
//   blockSpace.innerHTML += `
//     <span class="changeVarBlock" style="margin-left:1vh;margin-top:0;margin-bottom:1vh;">
//       change <select class="varSelect"></select> by <input class="varValueInput" placeholder="value">
//     </span>`;
//   blockSpace.querySelectorAll('.changeVarBlock select').forEach(populateVarSelect);
// }

function populateVarSelect(select) {
  select.innerHTML = '';
  Object.keys(variables).forEach(varName => {
    const option = document.createElement('option');
    option.value = varName;
    option.textContent = varName;
    select.appendChild(option);
  });
}

// ======================
// Execute Script
// ======================

function executeScript() {
  console.log("Executing blocks...");
  blocks = []; // reset

  const blockElements = blockSpace.querySelectorAll(
    ".setColorBlock, .turnOffBlock, .setBrightnessBlock, .delayBlock, .setVarBlock, .incVarBlock, .changeVarBlock, .updateBlock"
  );

  blockElements.forEach(el => {
    if (el.classList.contains("setVarBlock")) {
      const varName = el.querySelector('.varSelect').value;
      const value = resolveInputToValue(el.querySelector('.varValueInput').value);
      variables[varName] = [Number(value)]; // ✅ update variable immediately
      blocks.push(new CodeBlock("setVar", [], "#FFFFFF", { varName, value }));
    }

    else if (el.classList.contains("incVarBlock")) {
      const varName = el.querySelector('.varSelect').value;
      const value = resolveInputToValue(el.querySelector('.varValueInput').value);
      variables[varName] += Number(value); // ✅ increment variable immediately
      blocks.push(new CodeBlock("incVar", [], "#FFFFFF", { varName, value }));
    }

    else if (el.classList.contains("changeVarBlock")) {
      const varName = el.querySelector('.varSelect').value;
      const value = resolveInputToValue(el.querySelector('.varValueInput').value);
      variables[varName] += Number(value);
      blocks.push(new CodeBlock("changeVar", [], "#FFFFFF", { varName, value }));
    }

    else if (el.classList.contains("turnOffBlock")) {
      let pinInput = el.querySelector(".turnOffBlockPinNum").value.trim();
      let pin = resolveInputToValue(pinInput);
      console.log(`${pinInput} variable was found -> value: ${pin}`);
      // ✅ Don’t skip pin=0, only skip empty input
      if (pinInput !== "") blocks.push(new CodeBlock("turnOff", pin.toString().split(","), "#000000"));
    }

    else if (el.classList.contains("setColorBlock")) {
      let pinInput = el.querySelector(".setColorBlockPinNum").value.trim();
      let color = el.querySelector(".setColorBlockColorInput").value;
      let pin = resolveInputToValue(pinInput);
      if (pinInput !== "" && color) blocks.push(new CodeBlock("light", pin.toString().split(","), color));
    }

    else if (el.classList.contains("setBrightnessBlock")) {
      let pinInput = el.querySelector(".setBrightnessBlockPinNum").value.trim();
      let pin = resolveInputToValue(pinInput);
      let brightness = el.querySelector(".setBrightnessBlockBrightnessInput").value;
      console.log(`Pre CodeBlock: ${brightness}`)
      blocks.push(new CodeBlock("setBrightness", pin.toString().split(","), "#000000", { brightness }));
    }

    else if (el.classList.contains("delayBlock")) {
      const ms = el.querySelector(".delayBlockTime").value;
      if (ms) blocks.push(new CodeBlock("delay", [], "#000000", { ms }));
    }

    else if(el.classList.contains("updateBlock")){
      console.log("found");
      blocks.push(new CodeBlock("update", [], "#000000"));
    }
  });

  console.log("Blocks to export:", blocks);
  onExport();
}


// ======================
// Export
// ======================

async function onExport() {

  // const firebaseConfig = {
  //   apiKey: "ENTER_API_KEY",
  //   authDomain: "lighthacks.us.firebaseapp.com",
  //   projectId: "lighthacks-app",
  //   storageBucket: "my-frontend-app.appspot.com",
  //   messagingSenderId: "123456789",
  //   appId: "1:123456789:web:abcdef123456"
  // };

  // const app = initializeApp(firebaseConfig);
  // const db = getFirestore(app);

  // const DEVICE_ID = "";
  // let seqCounter = 1;


  const sketch = buildArduinoSketch(blocks);
  const filename = `LiveSketch_${new Date().toISOString().replace(/[:.]/g, "-")}.ino`;
  downloadTextFile(filename, sketch, "text/plain");
}

// ======================
// Drag and Drop
// ======================

const paletteBlocks = document.querySelectorAll('#blocksPanel span');

paletteBlocks.forEach(block => {
  block.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', block.className);
  });
});

blockSpace.addEventListener('dragover', e => e.preventDefault());

blockSpace.addEventListener('drop', e => {
  e.preventDefault();
  const className = e.dataTransfer.getData('text/plain');
  let newBlock = document.createElement('span');
  newBlock.className = className + ' draggableBlock';
  newBlock.style.display = 'block';
  newBlock.style.marginLeft = '1vh';
  newBlock.style.marginBottom = '1vh';
  newBlock.style.marginTop = '0';
  newBlock.setAttribute('draggable', true);

  // Add inputs depending on type
  if (className.includes('setColorBlock')) {
    newBlock.style.width = '50vh';
    newBlock.innerHTML = 'light <input type="text" class="setColorBlockPinNum" placeholder="ID"> set color <input type="text" class="setColorBlockColorInput" placeholder="(r,g,b)" style="width:15vh;">';
  }
  else if (className.includes('turnOffBlock')) {
    newBlock.innerHTML = 'turn off light <input type="text" class="turnOffBlockPinNum" placeholder="ID">';
    newBlock.style.width = '30vh';
  }
  else if (className.includes('setBrightnessBlock')) {
    newBlock.innerHTML = 'light <input type="text" class="setBrightnessBlockPinNum" placeholder="ID"> setBrightness <input type="text" class="setBrightnessBlockBrightnessInput" placeholder="%">';
    newBlock.style.width = '50vh';
  }
  else if (className.includes('delayBlock')) {
    newBlock.innerHTML = 'wait <input type="text" class="delayBlockTime" placeholder="ms">';
    newBlock.style.width = '15vh';
  }
  else if (className.includes('setVarBlock') || className.includes('changeVarBlock')) {
    newBlock.style.width = '30vh';
    newBlock.innerHTML = className.includes('setVarBlock') 
      ? 'set <select class="varSelect"></select> = <input class="varValueInput" placeholder="value">'
      : 'change <select class="varSelect"></select> by <input class="varValueInput" placeholder="value">';
    newBlock.querySelectorAll('.varSelect').forEach(populateVarSelect);
  }
  else if(className.includes('updateBlock')){
    newBlock.innerHTML = 'update'
    newBlock.style.width = '10vh';
  }

  blockSpace.appendChild(newBlock);
});

document.getElementById('createVarBtn').addEventListener('click', createVariable);

function clearButton() {
    const blockSpace = document.getElementById('blockSpace');
    blockSpace.innerHTML = '<button id="execute" onclick="executeScript()">Execute</button>';
    blocks = [];
}

let draggedBlock = null;

blockSpace.addEventListener('dragstart', e => {
  if (e.target.classList.contains('draggableBlock')) {
    draggedBlock = e.target;
  }
});

blockSpace.addEventListener('dragover', e => {
  e.preventDefault();
  const target = e.target.closest('.draggableBlock');
  if (target && target !== draggedBlock) {
    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      blockSpace.insertBefore(draggedBlock, target);
    } else {
      blockSpace.insertBefore(draggedBlock, target.nextSibling);
    }
  }
});

blockSpace.addEventListener('drop', e => {
  draggedBlock = null;
});



//LIGHT DISPLAY

// const NUM_LEDS = 50; // number of LEDs to display in preview
// let ledStates = new Array(NUM_LEDS).fill({ r: 0, g: 0, b: 0 }); // track LED colors

// function initLightDisplay() {
//   const container = document.getElementById("lightDisplayContainer");
//   container.innerHTML = "";
//   for (let i = 0; i < NUM_LEDS; i++) {
//     const led = document.createElement("div");
//     led.className = "led";
//     led.dataset.id = i;
//     container.appendChild(led);
//   }
// }

// function updateLightDisplay() {
//   const container = document.getElementById("lightDisplayContainer");
//   container.querySelectorAll(".led").forEach((led, i) => {
//     const { r, g, b } = ledStates[i];
//     led.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
//   });
// }

// // update ledStates based on blocks
// function simulateBlocks() {
//   ledStates = new Array(NUM_LEDS).fill({ r: 0, g: 0, b: 0 }); // reset

//   blocks.forEach(block => {
//     if (block.type === "light") {
//       block.lightIDs.forEach(id => {
//         const idx = resolveValue(id);
//         if (idx >= 0 && idx < NUM_LEDS) {
//           ledStates[idx] = parseColor(block.color);
//         }
//       });
//     } else if (block.type === "turnOff") {
//       block.lightIDs.forEach(id => {
//         const idx = resolveValue(id);
//         if (idx >= 0 && idx < NUM_LEDS) {
//           ledStates[idx] = { r: 0, g: 0, b: 0 };
//         }
//       });
//     }
//   });

//   updateLightDisplay();
// }

// // call init on page load
// window.addEventListener("load", () => {
//   initLightDisplay();
// });

function resolveInputToValue(input) {
  const trimmed = input.trim();
  if (trimmed === "") return "";
  if (variables[trimmed] !== undefined) return variables[trimmed];
  return Number(trimmed) || trimmed;
}
