import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../store';
import {
    BODY_WIDTH, BODY_LENGTH, BODY_HEIGHT,
    COXA_LEN, FEMUR_LEN, TIBIA_LEN,
    STANDING_BODY_Y, DEG2RAD,
    LEG_CONFIG, LEG_IDS, servoToJoint,
} from '../constants';

/** Small sphere at each joint for visual clarity */
function JointSphere({ position, color = '#f1c40f', size = 0.5 }) {
    return (
        <mesh position={position}>
            <sphereGeometry args={[size, 12, 12]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
        </mesh>
    );
}

/** One leg with 3 segments (coxa, femur, tibia) and 3 joints */
function LegModel({ legId, config, angles, isSelected }) {
    // Convert servo angles → joint angles (0 = init/straight, positive = outward/down)
    const hipJoint = servoToJoint(angles.hip, legId, 'hip') * DEG2RAD;
    const shoulderJoint = servoToJoint(angles.shoulder, legId, 'shoulder') * DEG2RAD;
    const kneeJoint = servoToJoint(angles.knee, legId, 'knee') * DEG2RAD;

    // Left legs face -X direction (baseRotation = PI), right legs face +X (0)
    const baseRot = config.isLeft ? Math.PI : 0;
    // For left legs, hip rotation direction is flipped in local space
    const hipDir = config.isLeft ? 1 : -1;

    const baseColor = isSelected ? '#ffffff' : config.color;
    const emissiveColor = isSelected ? config.color : '#000000';
    const emissiveIntensity = isSelected ? 0.3 : 0;

    return (
        <group position={config.hipPos}>
            {/* Base rotation to face outward */}
            <group rotation-y={baseRot}>
                {/* Hip joint sphere */}
                <JointSphere position={[0, 0, 0]} color={isSelected ? '#fff' : '#f1c40f'} />

                {/* Hip rotation (Y axis) */}
                <group rotation-y={hipJoint * hipDir}>
                    {/* Coxa segment */}
                    <mesh position={[COXA_LEN / 2, 0, 0]} castShadow>
                        <boxGeometry args={[COXA_LEN, 0.8, 1.3]} />
                        <meshStandardMaterial
                            color={baseColor}
                            emissive={emissiveColor}
                            emissiveIntensity={emissiveIntensity}
                        />
                    </mesh>

                    {/* Shoulder joint */}
                    <group position={[COXA_LEN, 0, 0]}>
                        <JointSphere position={[0, 0, 0]} color={isSelected ? '#fff' : '#e67e22'} />

                        {/* Shoulder rotation (Z axis — tilts femur up/down) */}
                        <group rotation-z={-shoulderJoint}>
                            {/* Femur segment */}
                            <mesh position={[FEMUR_LEN / 2, 0, 0]} castShadow>
                                <boxGeometry args={[FEMUR_LEN, 0.7, 1.1]} />
                                <meshStandardMaterial
                                    color={baseColor}
                                    emissive={emissiveColor}
                                    emissiveIntensity={emissiveIntensity}
                                />
                            </mesh>

                            {/* Knee joint */}
                            <group position={[FEMUR_LEN, 0, 0]}>
                                <JointSphere position={[0, 0, 0]} color={isSelected ? '#fff' : '#e74c3c'} />

                                {/* Knee rotation (Z axis — bends tibia) */}
                                <group rotation-z={-kneeJoint}>
                                    {/* Tibia segment */}
                                    <mesh position={[TIBIA_LEN / 2, 0, 0]} castShadow>
                                        <boxGeometry args={[TIBIA_LEN, 0.6, 0.9]} />
                                        <meshStandardMaterial
                                            color={baseColor}
                                            emissive={emissiveColor}
                                            emissiveIntensity={emissiveIntensity}
                                        />
                                    </mesh>

                                    {/* Foot point */}
                                    <JointSphere
                                        position={[TIBIA_LEN, 0, 0]}
                                        color={isSelected ? '#fff' : '#ecf0f1'}
                                        size={0.6}
                                    />
                                </group>
                            </group>
                        </group>
                    </group>
                </group>
            </group>
        </group>
    );
}

/** Full robot: body platform + 4 legs */
export function RobotModel() {
    const legs = useStore((s) => s.legs);
    const selectedLeg = useStore((s) => s.selectedLeg);

    return (
        <group position={[0, STANDING_BODY_Y, 0]}>
            {/* Body platform */}
            <mesh castShadow>
                <boxGeometry args={[BODY_WIDTH, BODY_HEIGHT, BODY_LENGTH]} />
                <meshStandardMaterial
                    color="#2c3e50"
                    metalness={0.4}
                    roughness={0.6}
                />
            </mesh>

            {/* Top plate decoration */}
            <mesh position={[0, BODY_HEIGHT / 2 + 0.1, 0]}>
                <boxGeometry args={[BODY_WIDTH - 1, 0.2, BODY_LENGTH - 1]} />
                <meshStandardMaterial color="#34495e" metalness={0.5} roughness={0.4} />
            </mesh>

            {/* "Front" indicator */}
            <mesh position={[0, BODY_HEIGHT / 2 + 0.4, BODY_LENGTH / 2 - 1]}>
                <coneGeometry args={[0.5, 1, 4]} />
                <meshStandardMaterial color="#3498db" />
            </mesh>

            {/* Legs */}
            {LEG_IDS.map((id) => (
                <LegModel
                    key={id}
                    legId={id}
                    config={LEG_CONFIG[id]}
                    angles={legs[id]}
                    isSelected={selectedLeg === id}
                />
            ))}
        </group>
    );
}
