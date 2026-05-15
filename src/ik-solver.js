import {
    COXA_LEN, FEMUR_LEN, TIBIA_LEN, RAD2DEG, DEG2RAD,
    servoToJoint, jointToServo,
} from './constants.js';

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

/**
 * Solve inverse kinematics for one leg.
 *
 * @param {Object} target  - {x, y, z} foot position relative to the hip joint (cm)
 * @param {boolean} isLeft - true for FL/BL legs
 * @param {string} legId   - 'FL', 'FR', 'BL', or 'BR'
 * @returns {{ angles: {hip,shoulder,knee}, steps: Array }} servo angles (0-180) + explanation steps
 */
export function solveIK(target, isLeft, legId) {
    const { x, y, z } = target;
    const steps = [];
    const xSign = isLeft ? -1 : 1;

    // ── Step 1: Hip angle ──────────────────────────────────────────────
    // The hip servo swings the leg forward/backward in the XZ plane.
    // We compute the angle from the "straight outward" direction to the target.
    const hipJointRad = Math.atan2(z, x * xSign);
    const hipJointDeg = hipJointRad * RAD2DEG;
    const hipServo = jointToServo(hipJointDeg, legId, 'hip');

    steps.push({
        title: 'Step 1 — Hip Angle (Y-axis rotation)',
        formula: 'hipJointAngle = atan2(z, x)',
        explanation:
            `The foot target is at x=${x.toFixed(1)}, z=${z.toFixed(1)} relative to the hip. ` +
            `Using atan2, the joint angle from "straight outward" = ${hipJointDeg.toFixed(1)}°. ` +
            `On this ${isLeft ? 'LEFT' : 'RIGHT'} leg, the servo maps this as: ` +
            `servo = ${hipServo}° (init=${isLeft ? 0 : 180}, ${isLeft ? 'increasing' : 'decreasing'} = outward).`,
        result: `jointAngle = ${hipJointDeg.toFixed(1)}°  →  servo = ${hipServo}°`,
    });

    // ── Step 2: Project into the leg's 2D plane ────────────────────────
    const horizontalDist = Math.sqrt(x * x + z * z);
    const dx = horizontalDist - COXA_LEN;
    const dy = y;
    const reach = Math.sqrt(dx * dx + dy * dy);

    steps.push({
        title: 'Step 2 — Project to 2D Plane',
        formula: 'reach = √((horizontalDist − coxa)² + y²)',
        explanation:
            `Horizontal distance from hip to foot: √(${x.toFixed(1)}² + ${z.toFixed(1)}²) = ${horizontalDist.toFixed(2)} cm. ` +
            `Subtract the coxa length (${COXA_LEN} cm) to get the distance from the shoulder joint: dx = ${dx.toFixed(2)} cm. ` +
            `Vertical offset: dy = ${dy.toFixed(2)} cm. ` +
            `The shoulder-to-foot distance (reach) = ${reach.toFixed(2)} cm.`,
        result: `dx = ${dx.toFixed(2)}, dy = ${dy.toFixed(2)}, reach = ${reach.toFixed(2)} cm`,
    });

    // ── Step 3: Check reachability ─────────────────────────────────────
    const maxReach = FEMUR_LEN + TIBIA_LEN;
    const minReach = Math.abs(FEMUR_LEN - TIBIA_LEN);
    const reachable = reach <= maxReach && reach >= minReach && reach > 0.01;

    steps.push({
        title: 'Step 3 — Reachability Check',
        formula: `|femur − tibia| ≤ reach ≤ femur + tibia`,
        explanation:
            `The femur (${FEMUR_LEN} cm) and tibia (${TIBIA_LEN} cm) can reach between ` +
            `${minReach.toFixed(1)} cm and ${maxReach.toFixed(1)} cm. ` +
            `Our reach is ${reach.toFixed(2)} cm — ${reachable ? 'REACHABLE ✓' : 'OUT OF RANGE ✗'}`,
        result: reachable ? 'Target is reachable' : 'Target is NOT reachable!',
        error: !reachable,
    });

    if (!reachable) {
        return { angles: null, steps };
    }

    // ── Step 4: Knee angle (law of cosines) ────────────────────────────
    const cosKneeInner = clamp(
        (FEMUR_LEN ** 2 + TIBIA_LEN ** 2 - reach ** 2) / (2 * FEMUR_LEN * TIBIA_LEN),
        -1, 1
    );
    const kneeInnerRad = Math.acos(cosKneeInner);
    const kneeJointRad = Math.PI - kneeInnerRad;
    const kneeJointDeg = kneeJointRad * RAD2DEG;
    const kneeServo = jointToServo(kneeJointDeg, legId, 'knee');

    steps.push({
        title: 'Step 4 — Knee Angle (Law of Cosines)',
        formula: 'cos(θ) = (femur² + tibia² − reach²) / (2 · femur · tibia)',
        explanation:
            `Using the law of cosines on the triangle formed by femur, tibia, and the reach line: ` +
            `cos(θ) = ${cosKneeInner.toFixed(4)}. ` +
            `Interior angle = ${(kneeInnerRad * RAD2DEG).toFixed(1)}°. ` +
            `Knee bend (from straight) = 180° − ${(kneeInnerRad * RAD2DEG).toFixed(1)}° = ${kneeJointDeg.toFixed(1)}°.`,
        result: `jointAngle = ${kneeJointDeg.toFixed(1)}°  →  servo = ${kneeServo}°`,
    });

    // ── Step 5: Shoulder angle ─────────────────────────────────────────
    const phi = Math.atan2(-dy, dx);
    const cosBeta = clamp(
        (FEMUR_LEN ** 2 + reach ** 2 - TIBIA_LEN ** 2) / (2 * FEMUR_LEN * reach),
        -1, 1
    );
    const beta = Math.acos(cosBeta);
    const shoulderJointRad = phi - beta;
    const shoulderJointDeg = shoulderJointRad * RAD2DEG;
    const shoulderServo = jointToServo(shoulderJointDeg, legId, 'shoulder');

    steps.push({
        title: 'Step 5 — Shoulder Angle (Two-Part Calculation)',
        formula: 'shoulderAngle = atan2(−dy, dx) − acos((femur² + reach² − tibia²) / (2·femur·reach))',
        explanation:
            `φ (reach line angle) = ${(phi * RAD2DEG).toFixed(1)}°. ` +
            `β (femur-to-reach angle) = ${(beta * RAD2DEG).toFixed(1)}°. ` +
            `Shoulder joint angle = φ − β = ${shoulderJointDeg.toFixed(1)}°. ` +
            `Mapped to ${isLeft ? 'LEFT' : 'RIGHT'}-side servo = ${shoulderServo}°.`,
        result: `jointAngle = ${shoulderJointDeg.toFixed(1)}°  →  servo = ${shoulderServo}°`,
    });

    return {
        angles: { hip: hipServo, shoulder: shoulderServo, knee: kneeServo },
        steps,
    };
}

/**
 * Forward kinematics: compute foot position from servo angles.
 * Returns {x, y, z} relative to the hip joint.
 */
export function computeFK(angles, isLeft, legId) {
    const xSign = isLeft ? -1 : 1;

    // Convert servo angles → joint angles (degrees), then to radians
    const hipRad = servoToJoint(angles.hip, legId, 'hip') * DEG2RAD;
    const shoulderRad = servoToJoint(angles.shoulder, legId, 'shoulder') * DEG2RAD;
    const kneeRad = servoToJoint(angles.knee, legId, 'knee') * DEG2RAD;

    const totalTibiaAngle = shoulderRad + kneeRad;

    // In the 2D leg plane (after hip rotation):
    const shoulderX = COXA_LEN;
    const kneeX = shoulderX + FEMUR_LEN * Math.cos(shoulderRad);
    const kneeY = -FEMUR_LEN * Math.sin(shoulderRad);
    const footX = kneeX + TIBIA_LEN * Math.cos(totalTibiaAngle);
    const footY = kneeY - TIBIA_LEN * Math.sin(totalTibiaAngle);

    // Rotate back to 3D using hip angle
    const worldX = footX * Math.cos(hipRad) * xSign;
    const worldZ = footX * Math.sin(hipRad);
    const worldY = footY;

    return { x: worldX, y: worldY, z: worldZ };
}
