# Light Hacks  
*Project by Jay Colon, Lauren Bliss, Nivedita Sujith, and Brady Leifert – Fall 2025*

Light Hacks enables anyone to design and control custom light displays without needing to write code. With an intuitive “code-block” interface, users can shape movements, colours, brightness and patterns for their lights — whether indoors or outdoors.

---

## 🔍 Table of Contents  
- [Live Demo](#live-demo)  
- [Features](#features)  
- [Tech Stack](#tech-stack)  
- [Installation & Setup](#installation--setup)  
- [Usage](#usage)  
- [Architecture](#architecture)  

---

## Live Demo  
*[Our Devpost Page](https://devpost.com/software/lighthacks)*

---

## Features  
- Visual, drag-and-drop style interface for building light control sequences  
- Customisable parameters: patterns, colours, transitions, brightness  
- Hardware integration for microcontroller / LED strips (eg. NeoPixels)  
- Preview mode in browser + real-world output on connected lights  
- Shareable presets and configurable scenes  

---

## Tech Stack  
- **Frontend:** HTML, CSS, JavaScript — interactive UI for building light scenes  
- **Backend & Database:** (Specify details – e.g. Node.js + Express, Python Flask, MongoDB or SQLite)  
- **Hardware / Firmware:** (Specify microcontroller etc, e.g. Arduino / ESP32, C++ firmware)  
- **Other tools:** (List any build tools, bundlers, frameworks, libraries)  

---

## Installation & Setup  
> These instructions will get you a copy of the project running locally for development and testing.

1. Clone the repository:  
   ```bash
   git clone https://github.com/jcolon030/Knighthacks-VIII.git  
   cd Knighthacks-VIII

---

## Usage  
1. In the UI, choose or build a new light sequence.  
2. Configure properties like:  
   - Colours (solid, gradient, cycling)  
   - Movement / patterns (wipe, chase, sparkle, fade)  
   - Brightness and timing controls  
3. Preview in browser first to see how it looks.  
4. Once satisfied, hit **Deploy** (or equivalent) to send the sequence to your connected hardware.  
5. Want to reuse a scene? Save it as a preset & load it later.

---

## Architecture  
Here’s a high-level breakdown:  
- **Website (Frontend):** React / vanilla JS builds UI, exports scene definitions (JSON).  
- **Backend:** Receives scene JSON, stores it in DB, serves to hardware modules.  
- **Hardware module (microcontroller):** Polls backend (or listens via WebSocket / HTTP), receives scene JSON, interprets it into LED control code, drives LED strips in real-time.  

