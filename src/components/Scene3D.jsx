import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Text } from '@react-three/drei';
import { RobotModel } from './RobotModel';
import { DraggableFeet } from './DraggableFeet';
import { useStore } from '../store';
import { STANDING_BODY_Y } from '../constants';

function SceneContent() {
    const controlsRef = useRef();

    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
            <directionalLight position={[-10, 10, -10]} intensity={0.3} />

            {/* Ground grid */}
            <Grid
                args={[40, 40]}
                position={[0, -0.01, 0]}
                cellSize={2}
                cellThickness={0.5}
                cellColor="#666"
                sectionSize={10}
                sectionThickness={1}
                sectionColor="#999"
                fadeDistance={50}
                infiniteGrid
            />

            {/* Ground plane (slightly transparent) */}
            <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
                <planeGeometry args={[40, 40]} />
                <meshStandardMaterial color="#1a1a2e" transparent opacity={0.3} />
            </mesh>

            {/* Axis labels */}
            <Text position={[20, 0.5, 0]} fontSize={1} color="#e74c3c">+X</Text>
            <Text position={[0, 0.5, 20]} fontSize={1} color="#3498db">+Z (Front)</Text>
            <Text position={[0, 15, 0]} fontSize={1} color="#2ecc71">+Y (Up)</Text>

            {/* Robot */}
            <RobotModel />

            {/* Draggable foot targets — click & drag any foot to move it */}
            <DraggableFeet controlsRef={controlsRef} />

            {/* Camera controls (ref passed to DraggableFeet to disable during drag) */}
            <OrbitControls
                ref={controlsRef}
                makeDefault
                minDistance={10}
                maxDistance={60}
                target={[0, STANDING_BODY_Y / 2, 0]}
            />
        </>
    );
}

/** Playback controller — runs inside Canvas to use useFrame */
function PlaybackController() {
    const timerRef = useRef(0);
    const indexRef = useRef(-1);

    useFrame((_, delta) => {
        const { isPlaying, poses, playbackIndex, setAllAngles, setPlaybackIndex, setPlaying } =
            useStore.getState();

        if (!isPlaying || poses.length === 0) return;

        // Initialize
        if (indexRef.current !== playbackIndex) {
            indexRef.current = playbackIndex;
            timerRef.current = 0;
        }

        const currentPose = poses[playbackIndex];
        if (!currentPose) {
            setPlaying(false);
            return;
        }

        timerRef.current += delta * 1000;

        // Interpolate between previous pose and current pose
        const t = Math.min(timerRef.current / currentPose.transitionMs, 1);
        const prevPose = playbackIndex > 0 ? poses[playbackIndex - 1] : null;

        if (prevPose) {
            const interpolated = {};
            for (const leg of ['FL', 'FR', 'BL', 'BR']) {
                interpolated[leg] = {};
                for (const joint of ['hip', 'shoulder', 'knee']) {
                    const from = prevPose.angles[leg][joint];
                    const to = currentPose.angles[leg][joint];
                    interpolated[leg][joint] = Math.round(from + (to - from) * easeInOut(t));
                }
            }
            setAllAngles(interpolated);
        } else {
            setAllAngles(currentPose.angles);
        }

        // Move to next pose when transition is complete
        if (t >= 1) {
            const nextIndex = playbackIndex + 1;
            if (nextIndex < poses.length) {
                setPlaybackIndex(nextIndex);
            } else {
                // Loop back to beginning
                setPlaybackIndex(0);
            }
        }
    });

    return null;
}

function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function Scene3D() {
    return (
        <Canvas
            camera={{ position: [25, 20, 25], fov: 50 }}
            shadows
            style={{ background: '#0f0f1a' }}
        >
            <SceneContent />
            <PlaybackController />
        </Canvas>
    );
}
