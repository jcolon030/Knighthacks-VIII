# Light Hacks  
*Project by Jay Colon, Lauren Bliss, Nivedita Sujith, and Brady Leifert – Fall 2025*

Light Hacks enables anyone to design and control custom light displays without needing to write code. With an intuitive “code-block” interface, users can shape movements, colors, brightness and patterns for their lights — whether indoors or outdoors.

---

## 🔍 Table of Contents  
- [Live Demo](#live-demo)  
- [Features](#features)  
- [Tech Stack](#tech-stack)  
- [Installation & Setup](#installation--setup)  
- [Usage](#usage)  

---

## Live Demo  
*[Our Devpost Page](https://devpost.com/software/lighthacks)*

---

## Features  
- Visual, drag-and-drop style interface for building light control sequences  
- Customizable parameters: patterns, colors, transitions, brightness  
- Hardware integration for microcontroller / LED strips (eg. NeoPixels)  
- Real-world output on connected lights   

---

## Tech Stack  
- **Frontend:** HTML, CSS, JavaScript — interactive UI for building light scenes  
- **Backend & Database:** Supabase
- **Hardware / Firmware:** Arduino Nano 
- **Other tools:** (List any build tools, bundlers, frameworks, libraries)  

---

## Installation & Setup  
> These instructions will get you a copy of the project running locally for development and testing.

1. Clone the repository:  
   ```bash
   git clone https://github.com/jcolon030/Knighthacks-VIII.git  
   cd Knighthacks-VIII

2. **Flash your Arduino**  
   - Open the `flash.ino` file located in the `arduino-flash/` directory.  
   - Upload it to your Arduino using the Arduino IDE.  

3. **Configure Supabase keys**  
   - Open the backend code and locate the environment variable section.  
   - Add your Supabase credentials (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE`).  

4. **Connect your Arduino**  
   - Plug your Arduino into your computer via USB.  
   - Ensure the correct port is selected in the Arduino IDE or serial settings.  

5. **Start the website**  
   - Access our page at knightlights.netlify.app to create sequences

---

## Usage  
1. In the UI, choose or build a new light sequence.  
2. Configure properties like:  
   - Colors (solid, gradient, cycling)  
   - Movement / patterns (wipe, chase, sparkle, fade)  
   - Brightness and timing controls  
3. Preview in browser first to see how it looks.  
4. Once satisfied, hit **Execute** to send the sequence to your connected hardware.  

---
