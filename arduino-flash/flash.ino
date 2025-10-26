#include <Adafruit_NeoPixel.h>

#define LED_PIN   2
#define NUM_LEDS  100
Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, NEO_RGB + NEO_KHZ800); // GRB is most common

String lineBuf;

void wait_ms(unsigned long ms) {
  unsigned long t0 = millis();
  while (millis() - t0 < ms) delay(1);
}

void ok() { Serial.println(F("OK")); }

void handleLine(const String& ln) {
  if (!ln.length()) return;
  char cmd = ln.charAt(0);

  int v[6] = {0}, vi = 0, start = 2;
  for (int i = 2; i <= ln.length(); i++) {
    if (i == ln.length() || ln.charAt(i) == ',') {
      if (vi < 6) v[vi++] = ln.substring(start, i).toInt();
      start = i + 1;
    }
  }

  switch (cmd) {
    case 'L': { // F,start,end,R,G,B
      int s=v[0], e=v[1], r=v[2], g=v[3], b=v[4];
      if (s<0) s=0; if (e>=NUM_LEDS) e=NUM_LEDS-1;
      if (e >= s) {
        for (int i=s; i<=e; i++) strip.setPixelColor(i, strip.Color(r,g,b));
      }
      strip.show();
      ok();
    } break;

    case 'A': { // A,R,G,B
      int r=v[0], g=v[1], b=v[2];
      for (int i=0; i<NUM_LEDS; i++) strip.setPixelColor(i, strip.Color(r,g,b));
      strip.show();
      ok();
    } break;

    case 'Z': { // clear all
      int s=0, e=99;
      if (s<0) s=0; if (e>=NUM_LEDS) e=NUM_LEDS-1;
      if (e >= s) {
        for (int i=s; i<=e; i++) strip.setPixelColor(i, strip.Color(0,0,0));
      }
      strip.show();
      ok();
    } break;

    case 'C': { // C,start,end
      int s=v[0], e=v[1];
      if (s<0) s=0; if (e>=NUM_LEDS) e=NUM_LEDS-1;
      if (e >= s) {
        for (int i=s; i<=e; i++) strip.setPixelColor(i, 0,0,0);
      }
      strip.show();
      ok();
    } break;

    case 'S': { // show
      strip.show(); ok();
    } break;

    case 'D': { // W,ms  (was 'D' before)
      wait_ms((unsigned long)v[0]); ok();
    } break;

    case 'B': { // B,brightness 0..255
      int br = v[0]; if (br<0) br=0; if (br>255) br=255;
      strip.setBrightness(br);
      strip.show();
      ok();
    } break;

    case 'R': {
      rainbow();
      ok();
    } break;

    default:
      Serial.println(F("OK")); // ignore unknown but keep host unblocked
      break;
  }
}

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  strip.begin();
  strip.setBrightness(64);
  strip.clear(); strip.show();
  Serial.begin(115200);
  delay(200);
  Serial.println(F("READY"));
}

void loop() {
  static unsigned long t=0;
  if (millis()-t >= 500) { t += 500; digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN)); }

  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c=='\n' || c=='\r') {
      lineBuf.trim();
      handleLine(lineBuf);
      lineBuf = "";
    } else {
      if (lineBuf.length() < 120) lineBuf += c;
    }
  }
}

void rainbow() {
  for (int j = 0; j < 256 * 5; j++) { // 5 rainbows
    for (int y = 0; y < 10; y++) {
      for (int x = 0; x < 10; x++) {
        int pixelIndex = (y * 10) + x; //

        if (y % 2 == 1) { // Odd rows wired reverse
          pixelIndex = (y * 10) + (10 - 1 - x);
        }
        strip.setPixelColor(pixelIndex, Wheel(((pixelIndex * 256 / 100) + j) & 255));
      }
    }
    strip.show();
    delay(50);
  }
}

uint32_t Wheel(byte WheelPos) {
  WheelPos = 255 - WheelPos;
  if (WheelPos < 85) {
    return strip.Color(255 - WheelPos * 3, 0, WheelPos * 3);
  }
  if (WheelPos < 170) {
    WheelPos -= 85;
    return strip.Color(0, WheelPos * 3, 255 - WheelPos * 3);
  }
  WheelPos -= 170;
  return strip.Color(WheelPos * 3, 255 - WheelPos * 3, 0);
}