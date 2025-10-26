// import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
// import { 
//   getFirestore, collection, addDoc, serverTimestamp 
// } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

let blocks = [];
let variables = {}; // Store int variables

let finalCommands = [];

// app.js
const SUPABASE_URL = "https://rjcspfjnhadhodecleht.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqY3NwZmpuaGFkaG9kZWNsZWh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NDc5MDUsImV4cCI6MjA3NzAyMzkwNX0.YXpOzWNu9wUH6htpXHyAwBaZecqXwFXszmq2ihU1ENw";   // anon/public key
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// enqueue next commands_N for a device
async function enqueueProgram(deviceId, commands) {
  // 1) Find current max N
  const { data, error } = await sb
    .from("programs")
    .select("n")
    .eq("device_id", deviceId)
    .like("name", "commands_%");

  if (error) { console.error("select n error:", error); return; }
  const nextN = (data?.reduce((m, r) => Math.max(m, r?.n ?? 0), 0) || 0) + 1;
  const name = `commands_${nextN}`;

  // 2) Insert pending row
  const { error: insErr } = await sb.from("programs").insert({
    device_id: deviceId,
    name,
    commands,                 // array of strings
    status: "pending",
    updated_at: new Date().toISOString()
  });

  if (insErr) console.error("insert error:", insErr);
  else console.log("Enqueued", name);
}

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
          finalCommands.push(`L, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[0]) - 1).toString()}, ${r}, ${g}, ${b}`);
          console.log(finalCommands);
          console.log(`L, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[0]) - 1).toString()}, ${r}, ${g}, ${b}`);
          return `L, ${variables[`${getKeyByValue(variables, lightIDs[0])}`]}, ${variables[`${getKeyByValue(variables, lightIDs[0])}`]}, ${r}, ${g}, ${b}`;
      }
    // Multiple lightID (number)
    finalCommands.push(`L, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[lightIDs.length - 1]) - 1).toString()}, ${r}, ${g}, ${b}`);
    console.log(typeof finalCommands);
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
      let pinArray = pin.toString().split(",");
      console.log(`${pinInput} variable was found -> value: ${pin}`);
      if (pinArray.length > 1) {
        finalCommands.push(`C, ${(parseInt(pinArray[0]) - 1).toString()}, ${(parseInt(pinArray[0]) - 1).toString()}`);
      }
      else {
        finalCommands.push(`C, ${(parseInt(pinArray[0]) - 1).toString()}, ${(parseInt(pinArray[pinArray.length - 1]) - 1).toString()}`);
      }
      if (pinInput !== "") blocks.push(new CodeBlock("turnOff", pinArray, "#000000"));
    }

    else if (el.classList.contains("setColorBlock")) {
      let pinInput = el.querySelector(".setColorBlockPinNum").value.trim();
      let color = el.querySelector(".setColorBlockColorInput").value;
      let pin = resolveInputToValue(pinInput);
      const { r, g, b } = parseColor(color || "#00FF00");
      let pinArray = pin.toString().split(",");
      if (pinArray.length > 1) {
        finalCommands.push(`L, ${(parseInt(pinArray[0]) - 1).toString()}, ${(parseInt(pinArray[0]) - 1).toString()}, ${r}, ${g}, ${b}`);
      }
      else {
        finalCommands.push(`L, ${(parseInt(pinArray[0]) - 1).toString()}, ${(parseInt(pinArray[pinArray.length - 1]) - 1).toString()}, ${r}, ${g}, ${b}`);
      }
      if (pinInput !== "" && color) blocks.push(new CodeBlock("light", pinArray, color));
    }

    else if (el.classList.contains("setBrightnessBlock")) {
      let pinInput = el.querySelector(".setBrightnessBlockPinNum").value.trim();
      let pin = resolveInputToValue(pinInput);
      let pinArray = pin.toString().split(",");
      let brightness = el.querySelector(".setBrightnessBlockBrightnessInput").value;
      console.log(`Pre CodeBlock: ${brightness}`)
      if (pinArray.length > 1) {
        finalCommands.push(`B, ${(parseInt(pinArray[0]) - 1).toString()}, ${(parseInt(pinArray[0]) - 1).toString()}, ${parseBrightness(parseInt(brightness)).toString()}`);
      }
      else {
        finalCommands.push(`B, ${(parseInt(pinArray[0]) - 1).toString()}, ${(parseInt(pinArray[pinArray.length - 1]) - 1).toString()}, ${parseBrightness(parseInt(brightness)).toString()}`);
      }
      blocks.push(new CodeBlock("setBrightness", pinArray, "#000000", { brightness }));
    }

    else if (el.classList.contains("delayBlock")) {
      const ms = el.querySelector(".delayBlockTime").value;
      finalCommands.push(`D, ${resolveValue(ms)}`);
      if (ms) blocks.push(new CodeBlock("delay", [], "#000000", { ms }));
    }

    else if(el.classList.contains("updateBlock")){
      console.log("found");
      finalCommands.push(`S`);
      blocks.push(new CodeBlock("update", [], "#000000"));
    }
  });

  enqueueProgram("Arduino Nano", finalCommands);
  finalCommands = [];

  console.log("Blocks to export:", blocks);
}

// ======================
// Drag and Drop
// ======================

const paletteBlocks = document.querySelectorAll('#blocksPanel span');
let draggedBlock = null;

// --- Palette block dragging (drag from palette to workspace) ---
paletteBlocks.forEach(block => {
  block.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', block.className);
  });
});

// Allow dropping into workspace
blockSpace.addEventListener('dragover', e => e.preventDefault());

// --- Drop from palette into workspace ---
blockSpace.addEventListener('drop', e => {
  e.preventDefault();

  // If we're currently reordering (draggedBlock exists), skip creation
  if (draggedBlock) return;

  const className = e.dataTransfer.getData('text/plain');
  if (!className) return;

  let newBlock = document.createElement('span');
  newBlock.className = className + ' draggableBlock';
  newBlock.style.display = 'block';
  newBlock.style.marginLeft = '1vh';
  newBlock.style.marginBottom = '1vh';
  newBlock.style.marginTop = '0';
  newBlock.setAttribute('draggable', true);

  // Add inputs depending on block type
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
  else if (className.includes('updateBlock')) {
    newBlock.innerHTML = 'update';
    newBlock.style.width = '10vh';
  }

  blockSpace.appendChild(newBlock);
});

// --- Reordering logic inside workspace ---
blockSpace.addEventListener('dragstart', e => {
  if (e.target.classList.contains('draggableBlock')) {
    draggedBlock = e.target;
  }
});

blockSpace.addEventListener('dragover', e => {
  e.preventDefault();
  if (!draggedBlock) return;

  const target = e.target.closest('.draggableBlock');
  if (target && target !== draggedBlock) {
    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertBeforeNode = (e.clientY < midY) ? target : target.nextSibling;

    // ✅ Safety check before inserting
    if (insertBeforeNode instanceof Node && draggedBlock instanceof Node) {
      blockSpace.insertBefore(draggedBlock, insertBeforeNode);
    }
  }
});

blockSpace.addEventListener('drop', e => {
  e.preventDefault();
  draggedBlock = null; // ✅ Clean reset
});

// --- Variable creation button ---
document.getElementById('createVarBtn').addEventListener('click', createVariable);

// --- Clear workspace function ---
function clearButton() {
  blockSpace.innerHTML = '<button id="execute" onclick="executeScript()">Execute</button>';
  blocks = [];
}

function resolveInputToValue(input) {
  const trimmed = input.trim();
  if (trimmed === "") return "";
  if (variables[trimmed] !== undefined) return variables[trimmed];
  return Number(trimmed) || trimmed;
}

