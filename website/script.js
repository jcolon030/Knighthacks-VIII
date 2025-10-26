// In-memory program and variable stores
let blocks = [];
let variables = {}; // Stores integer variables by name
let finalCommands = [];

// ---------------------------------------------
// Supabase client (browser-side; uses anon key)
// NOTE: Typically the URL should NOT end with a trailing slash.
// ---------------------------------------------
const SUPABASE_URL = "https://rjcspfjnhadhodecleht.supabase.co/"; // trailing '/' may work but is uncommon
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqY3NwZmpuaGFkaG9kZWNsZWh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NDc5MDUsImV4cCI6MjA3NzAyMzkwNX0.YXpOzWNu9wUH6htpXHyAwBaZecqXwFXszmq2ihU1ENw"; // public anon key
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------
// Enqueue a new commands_N row for a device
// - Computes next N by reading existing rows
// - Inserts a new row with status "pending"
// ---------------------------------------------
async function enqueueProgram(deviceId, commands) {
  // 1) Read existing rows to determine next N
  const { data, error } = await sb
    .from("programs")
    .select("n")
    .eq("device_id", deviceId)
    .like("name", "commands_%");

  if (error) { 
    console.error("select n error:", error); 
    return; 
  }

  // Find max n then add 1 (fallback to 1 if none)
  const nextN = (data?.reduce((m, r) => Math.max(m, r?.n ?? 0), 0) || 0) + 1;
  const name = `commands_${nextN}`;

  // 2) Insert the pending program row
  const { error: insErr } = await sb.from("programs").insert({
    device_id: deviceId,
    name,
    commands,                 // JSON array of strings
    status: "pending",
    updated_at: new Date().toISOString()
  });

  if (insErr) console.error("insert error:", insErr);
  else console.log("Enqueued", name);
}

// ---------------------------------------------
// Reverse-lookup helper: find key name by value
// Returns the first key whose value === value
// ---------------------------------------------
function getKeyByValue(obj, value) {
  for (let key in obj) {
    if (obj[key] === value) return key;
  }
  return null;
}

// ======================
// Helper Functions
// ======================

// Parse color in "#RRGGBB" or "(r,g,b)" into {r,g,b}
function parseColor(input) {
  if (!input) return { r: 0, g: 255, b: 0 };
  const rgbMatch = input.match(/\(?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)?/);
  if (rgbMatch) return { r: +rgbMatch[1], g: +rgbMatch[2], b: +rgbMatch[3] };
  const s = input.replace('#', '');
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Brightness passthrough (kept as-is)
// If you later accept "50%" etc., convert to 0–255 here
function parseBrightness(value) {
  return value;
}

// Resolve a token to a value:
// - If it matches a variable name, return the variable's value
// - Otherwise return the literal (string or number)
function resolveValue(val) {
  if (variables[val] !== undefined) return variables[val];
  return val;
}

// ======================
// Block Generators
// Produce command strings for each block type
// ======================

const BLOCK_GENERATORS = {
  light: ({ lightIDs, color }) => {
    const { r, g, b } = parseColor(color || "#00FF00");

    // Single light id (either number or variable name)
    if (lightIDs.length == 1) {
      // Push to finalCommands for downstream enqueue
      finalCommands.push(
        `L, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[0]) - 1).toString()}, ${r}, ${g}, ${b}`
      );
      console.log(finalCommands);
      console.log(
        `L, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[0]) - 1).toString()}, ${r}, ${g}, ${b}`
      );

      // Return a string using variable lookup, if applicable
      return `L, ${variables[`${getKeyByValue(variables, lightIDs[0])}`]}, ${variables[`${getKeyByValue(variables, lightIDs[0])}`]}, ${r}, ${g}, ${b}`;
    }

    // Multiple light ids (assumes a contiguous range from first to last)
    finalCommands.push(
      `L, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[lightIDs.length - 1]) - 1).toString()}, ${r}, ${g}, ${b}`
    );
    console.log(typeof finalCommands);
    console.log(
      `L, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[lightIDs.length - 1]) - 1).toString()}, ${r}, ${g}, ${b}`
    );

    // Return string for the range
    return `L, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[lightIDs.length - 1]) - 1).toString()}, ${r}, ${g}, ${b}`;
  },

  turnOff: ({ lightIDs }) => {
    // Single id: clear one index
    if (lightIDs.length == 1) {
      console.log(
        `C, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[0]) - 1).toString()}`
      );
      return `C, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[0]) - 1).toString()}`;
    }
    // Multiple ids: clear a range from first to last
    console.log(
      `C, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[lightIDs.length - 1]) - 1).toString()}`
    );
    return `C, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[lightIDs.length - 1]) - 1).toString()}`;
  },

  setBrightness: ({ lightIDs, brightness }) => {
    // Emits a per-range brightness command (your firmware may actually use global brightness)
    if (lightIDs.length == 1) {
      console.log(`brightness = ${brightness}`);
      console.log(
        `B, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[0]) - 1).toString()}, ${parseBrightness(parseInt(brightness)).toString()}`
      );
      return `B, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[0]) - 1).toString()}, ${parseBrightness(parseInt(brightness)).toString()}`;
    }
    // Range brightness
    console.log(
      `B, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[lightIDs.length - 1]) - 1).toString()}, ${parseBrightness(parseInt(brightness)).toString()}`
    );
    return `B, ${(parseInt(lightIDs[0]) - 1).toString()}, ${(parseInt(lightIDs[lightIDs.length - 1]) - 1).toString()}, ${parseBrightness(parseInt(brightness)).toString()}`;
  },

  // Delay block: emits "D,<ms>" (or "W,<ms>" if your firmware expects W)
  delay: ({ ms }) => {
    console.log(`D, ${resolveValue(ms)}`);
    return `D, ${resolveValue(ms)}`;
  },

  // Variable write (purely symbolic in the emitted code string)
  setVar: ({ varName, value }) => `${varName} = ${resolveValue(value)};`,

  // Variable increment (emitted as code string)
  incVar: ({ varName, value }) => `${varName} += ${resolveValue(value)};`,

  // update/show command
  update: () => {
    console.log(`S`);
    return `S`;
  },

  // Preset hooks (implement as needed)
  setAllColors: (color) => {
    // Placeholder
  },

  turnAllOff: () => {
    // Placeholder
  }
};

// ======================
// CodeBlock Class
// Wraps a block instance and produces a command string via generator
// ======================

class CodeBlock {
  constructor(type, lightIDs = [], color = "#00FF00", extra = {}) {
    this.type = type;
    this.lightIDs = lightIDs;
    this.color = color;
    this.extra = extra; // e.g., { brightness }, { ms }, { varName, value }, etc.
  }

  toCode() {
    const gen = BLOCK_GENERATORS[this.type];
    if (!gen) throw new Error(`Unknown block type: ${this.type}`);

    // Special-case: single ID that matches a variable name
    if (this.lightIDs.length === 1) {
      const id = this.lightIDs[0];
      if (variables.hasOwnProperty(id)) {
        // Pass through the variable name for generator to resolve
        return gen({
          type: this.type,
          lightIDs: [id],
          color: this.color,
          ...this.extra,
        }).trim();
      }
    }

    // Default: pass numeric IDs or literals directly
    return gen({
      type: this.type,
      lightIDs: this.lightIDs,
      color: this.color,
      ...this.extra,
    }).trim();
  }
}

// ======================
// Variables UI helpers
// ======================

// Create a new variable with default value 1
function createVariable() {
  const nameInput = document.getElementById('newVarName');
  const name = nameInput.value.trim();
  if (!name) return alert("Enter a variable name");
  if (variables[name] !== undefined) return alert("Variable already exists");
  variables[name] = 1;
  renderVariables();
  nameInput.value = '';
}

// Render variables to a list element
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

// Populate a <select> with current variable names
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
// Walk the UI blocks, build CodeBlock objects, and emit command strings
// ======================

function executeScript() {
  console.log("Executing blocks...");
  blocks = []; // clear previous run

  const blockElements = blockSpace.querySelectorAll(
    ".setColorBlock, .turnOffBlock, .setBrightnessBlock, .delayBlock, .setVarBlock, .incVarBlock, .changeVarBlock, .updateBlock, .setAllColorBlock, .turnOffAllBlock, .rainbowBlock"
  );

  blockElements.forEach(el => {
    // Set variable to explicit value
    if (el.classList.contains("setVarBlock")) {
      const varName = el.querySelector('.varSelect').value;
      const value = resolveInputToValue(el.querySelector('.varValueInput').value);
      variables[varName] = Number(value); // update immediately
      blocks.push(new CodeBlock("setVar", [], "#FFFFFF", { varName, value }));
    }

    // Increment variable by a value
    else if (el.classList.contains("incVarBlock")) {
      const varName = el.querySelector('.varSelect').value;
      const value = resolveInputToValue(el.querySelector('.varValueInput').value);
      variables[varName] += Number(value); // increment immediately
      blocks.push(new CodeBlock("incVar", [], "#FFFFFF", { varName, value }));
    }

    // Change variable by a value (same as increment here)
    else if (el.classList.contains("changeVarBlock")) {
      const varName = el.querySelector('.varSelect').value;
      const value = resolveInputToValue(el.querySelector('.varValueInput').value);
      variables[varName] += Number(value);
      blocks.push(new CodeBlock("changeVar", [], "#FFFFFF", { varName, value }));
    }

    // Turn off one or a range of lights
    else if (el.classList.contains("turnOffBlock")) {
      let pinInput = el.querySelector(".turnOffBlockPinNum").value.trim();
      let pin = resolveInputToValue(pinInput);
      let pinArray = pin.toString().split(",");
      console.log(`${pinInput} variable was found -> value: ${pin}`);
      if (pinArray.length == 1) {
        finalCommands.push(`C, ${(parseInt(pinArray[0]) - 1).toString()}, ${(parseInt(pinArray[0]) - 1).toString()}`);
      } else {
        finalCommands.push(`C, ${(parseInt(pinArray[0]) - 1).toString()}, ${(parseInt(pinArray[pinArray.length - 1]) - 1).toString()}`);
      }
      if (pinInput !== "") blocks.push(new CodeBlock("turnOff", pinArray, "#000000"));
    }

    // Set color for one or a range of lights
    else if (el.classList.contains("setColorBlock")) {
      let pinInput = el.querySelector(".setColorBlockPinNum").value.trim();
      let color = el.querySelector(".setColorBlockColorInput").value;
      let pin = resolveInputToValue(pinInput);
      const { r, g, b } = parseColor(color || "#00FF00");
      let pinArray = pin.toString().split(",");
      if (pinArray.length == 1) {
        finalCommands.push(`L, ${(parseInt(pinArray[0]) - 1).toString()}, ${(parseInt(pinArray[0]) - 1).toString()}, ${r}, ${g}, ${b}`);
      } else {
        finalCommands.push(`L, ${(parseInt(pinArray[0]) - 1).toString()}, ${(parseInt(pinArray[pinArray.length - 1]) - 1).toString()}, ${r}, ${g}, ${b}`);
      }
      if (pinInput !== "" && color) blocks.push(new CodeBlock("light", pinArray, color));
    }

    // Set brightness for one or a range (depending on firmware support)
    else if (el.classList.contains("setBrightnessBlock")) {
      let pinInput = el.querySelector(".setBrightnessBlockPinNum").value.trim();
      let pin = resolveInputToValue(pinInput);
      let pinArray = pin.toString().split(",");
      let brightness = el.querySelector(".setBrightnessBlockBrightnessInput").value;
      console.log(`Pre CodeBlock: ${brightness}`);
      if (pinArray.length == 1) {
        finalCommands.push(`B, ${(parseInt(pinArray[0]) - 1).toString()}, ${(parseInt(pinArray[0]) - 1).toString()}, ${parseBrightness(parseInt(brightness)).toString()}`);
      } else {
        finalCommands.push(`B, ${(parseInt(pinArray[0]) - 1).toString()}, ${(parseInt(pinArray[pinArray.length - 1]) - 1).toString()}, ${parseBrightness(parseInt(brightness)).toString()}`);
      }
      blocks.push(new CodeBlock("setBrightness", pinArray, "#000000", { brightness }));
    }

    // Delay block
    else if (el.classList.contains("delayBlock")) {
      const ms = el.querySelector(".delayBlockTime").value;
      finalCommands.push(`D, ${resolveValue(ms)}`);
      if (ms) blocks.push(new CodeBlock("delay", [], "#000000", { ms }));
    }

    // Flush/show block
    else if (el.classList.contains("updateBlock")) {
      console.log("found");
      finalCommands.push(`S`);
      blocks.push(new CodeBlock("update", [], "#000000"));
    }

    // Set all lights to color
    else if (el.classList.contains("setAllColorBlock")) {
      let color = el.querySelector(".setAllColorBlockInput").value;
      let { r, g, b } = parseColor(color || "#00FF00");
      finalCommands.push(`A, ${r}, ${g}, ${b}`);
      blocks.push(new CodeBlock("setAllColors", [], color));
    }

    // Turn off all lights
    else if (el.classList.contains("turnOffAllBlock")) {
      finalCommands.push(`Z`);
      blocks.push(new CodeBlock("turnAllOff", [], "#000000"));
    }

    // Rainbow preset trigger (single-letter command)
    else if (el.classList.contains("rainbowBlock")) {
      finalCommands.push(`R`);
    }
  });

  // Enqueue built commands for processing by the backend bridge
  enqueueProgram("Arduino Nano", finalCommands);

  // Debug output
  console.log(finalCommands);

  // Reset the command buffer after enqueue
  finalCommands = [];

  console.log("Blocks to export:", blocks);
}

// ======================
// Drag and Drop UI wiring
// ======================

const paletteBlocks = document.querySelectorAll('#blocksPanel span');
let draggedBlock = null;

// Start dragging from palette: store the className as the drag data
paletteBlocks.forEach(block => {
  block.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', block.className);
  });
});

// Allow dropping into the workspace
blockSpace.addEventListener('dragover', e => e.preventDefault());

// Drop from the palette into the workspace: create a new block element
blockSpace.addEventListener('drop', e => {
  e.preventDefault();

  // If currently reordering an existing block, skip creating a new one
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

  // Populate block inner HTML and sizing based on type
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
  else if (className.includes('setAllColorBlock')) {
    newBlock.innerHTML = 'ALL lights color <input class="setAllColorBlockInput" placeholder="(r,g,b)" style="width:15vh;">';
    newBlock.style.width = '50vh';
  }
  else if (className.includes('turnOffAllBlock')) {
    newBlock.innerHTML = 'turn off ALL';
    newBlock.style.width = '30vh';
  }
  else if (className.includes('rainbowBlock')) {
    newBlock.innerHTML = 'rainbow preset';
    newBlock.style.width = '30vh';
  }

  blockSpace.appendChild(newBlock);
});

// Begin reordering an existing block in the workspace
blockSpace.addEventListener('dragstart', e => {
  if (e.target.classList.contains('draggableBlock')) {
    draggedBlock = e.target;
  }
});

// Handle reordering position on dragover
blockSpace.addEventListener('dragover', e => {
  e.preventDefault();
  if (!draggedBlock) return;

  const target = e.target.closest('.draggableBlock');
  if (target && target !== draggedBlock) {
    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertBeforeNode = (e.clientY < midY) ? target : target.nextSibling;

    // Guard against DOM exceptions
    if (insertBeforeNode instanceof Node && draggedBlock instanceof Node) {
      blockSpace.insertBefore(draggedBlock, insertBeforeNode);
    }
  }
});

// Finish reordering
blockSpace.addEventListener('drop', e => {
  e.preventDefault();
  draggedBlock = null; // reset drag state
});

// Variable creation button handler
document.getElementById('createVarBtn').addEventListener('click', createVariable);

// Clear the workspace and reset blocks
function clearButton() {
  blockSpace.innerHTML = '<button id="execute" onclick="executeScript()">Execute</button>';
  blocks = [];
}

// Resolve input values:
// - If matches a variable name, returns that variable's numeric value
// - Otherwise returns Number(trimmed) if numeric, else the raw string
function resolveInputToValue(input) {
  const trimmed = input.trim();
  if (trimmed === "") return "";
  if (variables[trimmed] !== undefined) return variables[trimmed];
  return Number(trimmed) || trimmed;
}
