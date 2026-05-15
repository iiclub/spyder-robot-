# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A **React + Three.js web app** that simulates a 12-servo quadruped (spider) robot. Users manipulate the 3D robot model via Forward Kinematics (FK) sliders or Inverse Kinematics (IK) targets, record pose sequences, group them into named action methods, and generate uploadable Arduino code.

## Commands

```bash
npm install      # Install dependencies
npm run dev      # Vite dev server on localhost:3000
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

No test framework is configured yet.

## Architecture

```
src/
  main.jsx              # ReactDOM entry point
  App.jsx               # Top-level layout (header, viewport, sidebar, bottom panels)
  App.css               # All styles (single CSS file, CSS custom properties)
  constants.js          # Robot dimensions, leg config, pin mappings, presets
  store.js              # Zustand store (with subscribeWithSelector middleware)
  ik-solver.js          # Analytical 3-DOF IK solver + step-by-step explanations
  code-generator.js     # Generates complete Arduino .ino from poses/methods
  esp32-link.js         # ESP32 HTTP communication + live link subscription
  components/
    Scene3D.jsx         # React Three Fiber Canvas, lights, grid, PlaybackController
    RobotModel.jsx      # 3D body + 4 LegModel components using Three.js group hierarchy
    DraggableFeet.jsx   # Click-and-drag foot targets in 3D viewport (IK)
    Sidebar.jsx         # FK/IK mode toggle, leg selector, servo sliders, presets, overview
    Esp32Panel.jsx      # ESP32 connection, live mode toggle, quick servo commands
    Recorder.jsx        # Pose recording, timeline, playback controls, method management
    IKExplainer.jsx     # Renders IK math explanation steps from ik-solver
    CodeOutput.jsx      # Displays + copies generated Arduino code
firmware/
  spider_robot_wifi.ino # ESP32 firmware: WiFi AP + HTTP server + 12 servo control
```

## Key Concepts

**State management:** Single Zustand store (`store.js`) holds all robot state — servo angles, IK targets, recorded poses, methods, playback state. Components subscribe to slices via selectors to avoid unnecessary re-renders.

**3D Model:** Built with React Three Fiber (`@react-three/fiber`). The robot uses a nested `<group>` hierarchy for FK: each joint is a group with rotation, and child segments inherit parent transforms automatically. Body sits at `STANDING_BODY_Y` height.

**Servo direction (mirrored sides):** Left-side servos (FL, BL) init at 0° and increase outward. Right-side servos (FR, BR) init at 180° and decrease outward. Joints cannot physically rotate toward the body center. `SERVO_CONFIG` in `constants.js` defines `init` and `dir` per joint. Helper functions `servoToJoint()` / `jointToServo()` convert between servo angles (0-180) and joint angles (0 = init/straight, positive = outward/down). The 3D model and IK solver both work in joint-angle space internally.

**Leg coordinate system:** Each leg has 3 joints (hip/shoulder/knee). Hip rotates around Y (forward/backward), shoulder and knee rotate around Z (up/down). Left legs have `baseRotation = PI` and mirrored hip direction.

**IK Solver:** Analytical solver in `ik-solver.js`. Computes hip angle via `atan2`, then projects to 2D plane and uses law of cosines for shoulder/knee. Returns both servo angles and educational step-by-step explanation array.

**Code Generator:** `code-generator.js` produces a complete Arduino sketch with `Servo.h`, pin definitions, `smoothMove()` interpolation, recorded pose sequences, and named method functions.

**Recording flow:** User positions robot → clicks "Record Pose" → pose saved with transition time → optionally groups poses into a named method → generates Arduino code that replays the sequence in `loop()`.

**ESP32 Live Link:** `esp32-link.js` subscribes to the Zustand store's `legs` slice via `subscribeWithSelector`. When `liveMode` is true, any angle change (from sliders, IK drag, presets, playback) is debounced at 50ms and sent as `POST /set-angles` to the ESP32. The firmware (`firmware/spider_robot_wifi.ino`) runs in WiFi AP mode (SSID: "SpiderRobot", IP: 192.168.4.1) and exposes endpoints: `/status`, `/set-all-90`, `/set-all-0`, `/set-servo`, `/set-angles`. Requires ESP32Servo + ArduinoJson libraries.

**3D Foot Dragging:** `DraggableFeet.jsx` renders translucent spheres at each foot's world position. Click-drag creates a camera-facing plane through the foot and raycasts pointer movement onto it, updating IK targets in real-time. OrbitControls are disabled during drag.

## Robot Dimensions (constants.js)

- Body: 8cm wide x 12cm long x 2cm thick
- Leg segments: coxa 3cm, femur 6cm, tibia 8cm
- 4 legs: FL (red), FR (blue), BL (green), BR (orange)
- Default Arduino pins: FL 2-4, FR 5-7, BL 8-10, BR 11-13

## Stack

React 18, Three.js 0.162, @react-three/fiber 8, @react-three/drei 9, Zustand 4, Vite 5.
