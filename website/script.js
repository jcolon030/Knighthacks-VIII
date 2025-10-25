// Registry of "block type" -> generator function
const BLOCK_GENERATORS = {
  for: ({ lightIDs, color }) => {
    const { r, g, b } = hexToRgb(color || "#00FF00");
    return `
for (int i = 0; i < ${lightIDs.length}; i++) {
  int idx[] = ${{lightIDs}};
  strip.setPixelColor(idx, strip.Color(${r}, ${g}, ${b}));
}
strip.show();
`;
  },

  delay: ({ ms = 500 }) => `delay(${Number(ms) || 500});`,

  // add more blocks here...
  // "fade", "blink", "wipe", etc.
};

// helper: "#RRGGBB" -> {r,g,b}
function hexToRgb(hex) {
  const s = hex.replace('#','');
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// CodeBlock Class that describes a block
class CodeBlock {
  constructor(type, lightIDs = [], color = "#00FF00", extra = {}) {
    this.type = type;
    this.lightIDs = lightIDs;
    this.color = color;
    this.extra = extra; // room for other params (e.g., ms for delay)
  }

  toCode() {
    const gen = BLOCK_GENERATORS[this.type];
    if (!gen) throw new Error(`Unknown block type: ${this.type}`);
    return gen({
      type: this.type,
      lightIDs: this.lightIDs,
      color: this.color,
      ...this.extra,
    }).trim();
  }
}

// Builds Arduino Files using CodeBlocks Objects
function buildArduinoSketch(blocks) {
  const includes = `#include <Adafruit_NeoPixel.h>

#define PIN 2
#define NUM_LEDS 100
Adafruit_NeoPixel strip(NUM_LEDS, PIN, NEO_GRB + NEO_KHZ800);
`;

  const setup = `
void setup() {
  strip.begin();
  strip.show(); // all LEDs off
}
`;

  // put all generated snippets into loop in order
  const loopBody = blocks.map(b => b.toCode()).join('\n\n');

  const loop = `
void loop() {
${indent(loopBody, 2)}
}
`;

  return `${includes}\n${setup}\n${loop}\n`;
}

// simple indentation helper
function indent(text, spaces = 2) {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map(l => (l ? pad + l : l)).join('\n');
}

// Downloads the Arduino File to the user computer (Needs to be switched so that the file goes to queue)
function downloadTextFile(filename, text, mime = 'text/plain') {
  // Creates a file like object that store written code
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: filename
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// We accepts all CodeBlocks into an Array and make it global for onExport() to see
`
const blocks = [
  new CodeBlock('for', [0,1,2,3,4], '#00FF00'),
  new CodeBlock('delay', [], '#000000', { ms: 300 }),
  new CodeBlock('for', [10,11,12], '#FF00FF'),
];
`
// When user clicks "Export"
async function onExport() {
  const sketch = buildArduinoSketch(blocks);

  const res = await fetch("http://127.0.0.1:8000/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: "alice",
      device_id: "light-1",
      code: sketch,   // <-- use the right variable here
      env: "nano"
    })
  });

  const data = await res.json();
  console.log("Server response:", data);
}

let blockSpace = document.getElementById("blockSpace");
let textInputs;

function setColorBlockClicked(){
  blockSpace.innerHTML += '<span id="setColorBlock" style="margin-left:20vh;margin-top:0;margin-bottom:1vh;">light <input type="text" id="setColorBlockPinNum" placeholder="ID"> set color <input type="text" id="setColorBlockColorInput" placeholder="COLOR" style="width: 15vh;"></span>';
}

function clearButton(){
  blockSpace.innerHTML = '<button id="execute" onclick="executeScript()">Execute</button>';
}

function executeScript(){
  console.log(`Executing blocks`);
  textInputs = document.querySelectorAll('input[type="text"]');
  textInputs.forEach(input => {
    console.log(input.value);
  });
}