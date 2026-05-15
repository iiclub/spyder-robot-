// Robot dimensions (centimeters) — matches a typical hobby 12-servo quadruped
export const BODY_WIDTH = 8;   // X axis (side to side)
export const BODY_LENGTH = 12;  // Z axis (front to back)
export const BODY_HEIGHT = 2;   // Y axis (thickness)

// Leg segment lengths
export const COXA_LEN = 3;   // Hip joint to shoulder joint
export const FEMUR_LEN = 6;  // Shoulder joint to knee joint
export const TIBIA_LEN = 8;  // Knee joint to foot

// How high the body sits when standing (computed from default standing pose)
export const STANDING_BODY_Y = 10;

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

// ── Servo direction config ─────────────────────────────────────────────
// HIP servos only: left-side init at 0°, right-side init at 180°.
// Hip joints cannot rotate toward the body center.
//
// SHOULDER & KNEE servos: standard 90° center on all legs.
//   Range is 0-180 with 90 = straight, +90 = one direction, -90 = other.
//
//   init : servo value at calibration position
//   dir  : +1 = increasing servo moves joint in positive direction
//          -1 = decreasing servo moves joint in positive direction
//
export const SERVO_CONFIG = {
    FL: { hip: { init: 90,   dir:  1 }, shoulder: { init: 90, dir: -1 }, knee: { init: 0, dir: -1 } },
    FR: { hip: { init: 90, dir: -1 }, shoulder: { init: 90, dir: -1 }, knee: { init: 0, dir: 1 } },
    BL: { hip: { init: 90,   dir:  1 }, shoulder: { init: 90, dir: 1 }, knee: { init: 0, dir: 1 } },
    BR: { hip: { init: 90, dir: -1 }, shoulder: { init: 90, dir: -1 }, knee: { init: 0, dir: 1 } },
};

/**
 * Convert a servo angle (0-180) to a joint angle in degrees.
 * Joint angle 0 = calibration/init position (leg straight out).
 * Positive joint angle = outward/downward motion.
 */
export function servoToJoint(servoAngle, legId, joint) {
    const cfg = SERVO_CONFIG[legId][joint];
    return (servoAngle - cfg.init) * cfg.dir;
}

/**
 * Convert a joint angle (degrees) back to a servo angle (0-180).
 */
export function jointToServo(jointAngle, legId, joint) {
    const cfg = SERVO_CONFIG[legId][joint];
    return clampServo(cfg.init + jointAngle * cfg.dir);
}

function clampServo(v) {
    return Math.max(0, Math.min(180, Math.round(v)));
}

/** Get the init (calibration) angles for all 4 legs */
export function getInitAngles() {
    const angles = {};
    for (const id of LEG_IDS) {
        angles[id] = {
            hip: SERVO_CONFIG[id].hip.init,
            shoulder: SERVO_CONFIG[id].shoulder.init,
            knee: SERVO_CONFIG[id].knee.init,
        };
    }
    return angles;
}

// Leg identifiers and their configuration
export const LEG_CONFIG = {
    FL: {
        name: 'Front-Left',
        hipPos: [-BODY_WIDTH / 2, 0, BODY_LENGTH / 2],
        isLeft: true,
        color: '#e74c3c',       // red
        colorHex: 0xe74c3c,
    },
    FR: {
        name: 'Front-Right',
        hipPos: [BODY_WIDTH / 2, 0, BODY_LENGTH / 2],
        isLeft: false,
        color: '#3498db',       // blue
        colorHex: 0x3498db,
    },
    BL: {
        name: 'Back-Left',
        hipPos: [-BODY_WIDTH / 2, 0, -BODY_LENGTH / 2],
        isLeft: true,
        color: '#2ecc71',       // green
        colorHex: 0x2ecc71,
    },
    BR: {
        name: 'Back-Right',
        hipPos: [BODY_WIDTH / 2, 0, -BODY_LENGTH / 2],
        isLeft: false,
        color: '#e67e22',       // orange
        colorHex: 0xe67e22,
    },
};

export const LEG_IDS = ['FL', 'FR', 'BL', 'BR'];

// Default ESP32 pin mapping (safe pins only — avoids 1,3,6,7,8)
export const DEFAULT_PINS = {
    FL: { hip: 23, shoulder: 22, knee: 21 },
    FR: { hip: 19, shoulder: 18, knee: 5 },
    BL: { hip: 17, shoulder: 16, knee: 4 },
    BR: { hip: 2,  shoulder: 15, knee: 0 },
};

// Preset poses using SERVO angles (0-180)
// Hip: left init=0, right init=180 (cannot go toward center)
// Shoulder & Knee: all legs center at 90, range ±90
export const PRESETS = {
    init: {
        name: 'Init (Calibrate)',
        angles: {
            FL: { hip: 0,   shoulder: 90, knee: 90 },
            FR: { hip: 180, shoulder: 90, knee: 90 },
            BL: { hip: 0,   shoulder: 90, knee: 90 },
            BR: { hip: 180, shoulder: 90, knee: 90 },
        },
    },
    stand: {
        name: 'Stand',
        angles: {
            FL: { hip: 0,   shoulder: 130, knee: 150 },
            FR: { hip: 180, shoulder: 130, knee: 150 },
            BL: { hip: 0,   shoulder: 130, knee: 150 },
            BR: { hip: 180, shoulder: 130, knee: 150 },
        },
    },
    sit: {
        name: 'Sit',
        angles: {
            FL: { hip: 0,   shoulder: 160, knee: 170 },
            FR: { hip: 180, shoulder: 160, knee: 170 },
            BL: { hip: 0,   shoulder: 160, knee: 170 },
            BR: { hip: 180, shoulder: 160, knee: 170 },
        },
    },
    wave: {
        name: 'Wave',
        angles: {
            FL: { hip: 20,  shoulder: 40,  knee: 30 },   // FL leg raised
            FR: { hip: 180, shoulder: 130, knee: 150 },
            BL: { hip: 0,   shoulder: 130, knee: 150 },
            BR: { hip: 180, shoulder: 130, knee: 150 },
        },
    },
};
