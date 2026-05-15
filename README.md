# Spider Robot Simulator & Controller

A comprehensive 12-servo quadruped robot platform featuring a 3D web-based Inverse Kinematics (IK) simulator and an ESP32 WiFi Live Controller.

**Developed by iiclub**

## Overview

This project provides a complete ecosystem for developing, simulating, and controlling a quadruped "Spider" robot. It is divided into two main components:
1. **3D IK Simulator**: A React-based web application that visualizes the robot in 3D, computes inverse kinematics, and generates code snippets for movements.
2. **ESP32 Firmware**: A robust WiFi-enabled microcontroller firmware that hosts an onboard HTTP API and Web UI for real-time servo control and persistent calibration.

## Features

### 3D Simulator (Web Interface)
- **Interactive 3D Scene**: Built with React, Three.js, and React Three Fiber.
- **Inverse Kinematics (IK)**: Drag the robot's feet to automatically compute the required hip, shoulder, and knee angles.
- **Animation Recorder**: Record sequences of movements and play them back.
- **Code Generator**: Export your custom movements into ready-to-use C++ code for the ESP32.

### ESP32 WiFi Controller
- **Access Point Mode**: The ESP32 creates its own network (`SpiderRobot`), removing the need for external routers.
- **Live Calibration UI**: Easily trim and reverse servos via a built-in web portal. Calibration data is saved directly to the ESP32's flash memory.
- **HTTP REST API**: Send precise angle data to any of the 12 servos over the network.
- **CORS Support**: Allows the React simulator to communicate directly with the ESP32 seamlessly.

## Getting Started

### Prerequisites
- Node.js (v16+)
- Arduino IDE or PlatformIO (for ESP32 firmware)
- ESP32 Development Board

### Running the Simulator

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open your browser to the local URL provided by Vite.

### Flashing the Firmware

1. Open `firmware/spider_robot_wifi.ino` in your Arduino IDE.
2. Ensure you have the `ArduinoJson` library installed.
3. Flash the code to your ESP32 board.
4. Connect to the `SpiderRobot` WiFi network (Password: `12345678`).
5. Open your browser and navigate to `http://192.168.4.1` to access the onboard control and calibration panel.

## Architecture & Tech Stack

- **Frontend:** React 18, Zustand (State Management), Vite
- **3D Rendering:** Three.js, React Three Fiber, React Three Drei
- **Firmware:** C++, WebServer, ArduinoJson, ESP32 Preferences (Flash memory)

## License
Proprietary - Developed by iiclub. All rights reserved.