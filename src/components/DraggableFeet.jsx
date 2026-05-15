import React, { useRef, useCallback } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useStore } from '../store';
import { computeFK } from '../ik-solver';
import { LEG_IDS, LEG_CONFIG, STANDING_BODY_Y } from '../constants';

/**
 * Renders a draggable sphere at each foot position.
 * Click and drag any foot to move it — IK solves in real-time.
 *
 * @param {{ controlsRef: React.RefObject }} props
 */
export function DraggableFeet({ controlsRef }) {
    const { camera, gl } = useThree();
    const dragRef = useRef(null);

    const legs = useStore((s) => s.legs);
    const selectedLeg = useStore((s) => s.selectedLeg);

    // Compute each foot's world position from current servo angles
    const footPositions = {};
    for (const id of LEG_IDS) {
        const cfg = LEG_CONFIG[id];
        const fk = computeFK(legs[id], cfg.isLeft, id);
        footPositions[id] = [
            cfg.hipPos[0] + fk.x,
            STANDING_BODY_Y + fk.y,
            cfg.hipPos[2] + fk.z,
        ];
    }

    // ── Drag start ─────────────────────────────────────────────────────
    const startDrag = useCallback(
        (e, legId) => {
            e.stopPropagation();

            const store = useStore.getState();

            // Switch to IK mode, sync targets from current FK first
            store.syncIKTargetsFromAngles();
            store.selectLeg(legId);
            store.setMode('ik');

            // Current foot world position (anchor for the drag plane)
            const cfg = LEG_CONFIG[legId];
            const fk = computeFK(store.legs[legId], cfg.isLeft, legId);
            const hipWorld = new THREE.Vector3(
                cfg.hipPos[0],
                STANDING_BODY_Y,
                cfg.hipPos[2]
            );
            const footWorld = new THREE.Vector3(
                hipWorld.x + fk.x,
                hipWorld.y + fk.y,
                hipWorld.z + fk.z
            );

            // Drag plane faces the camera, passes through the foot
            const normal = camera.getWorldDirection(new THREE.Vector3());
            const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                normal,
                footWorld
            );

            dragRef.current = { legId, plane, hipWorld };

            // Disable orbit while dragging
            if (controlsRef.current) controlsRef.current.enabled = false;
            gl.domElement.style.cursor = 'grabbing';

            // ── Drag move (DOM event, not R3F) ─────────────────────────
            const onMove = (domEvt) => {
                if (!dragRef.current) return;
                const { legId: lid, plane: pl, hipWorld: hw } = dragRef.current;

                const rect = gl.domElement.getBoundingClientRect();
                const mouse = new THREE.Vector2(
                    ((domEvt.clientX - rect.left) / rect.width) * 2 - 1,
                    -((domEvt.clientY - rect.top) / rect.height) * 2 + 1
                );

                const ray = new THREE.Raycaster();
                ray.setFromCamera(mouse, camera);

                const hit = new THREE.Vector3();
                if (ray.ray.intersectPlane(pl, hit)) {
                    useStore.getState().setIKTarget(lid, {
                        x: hit.x - hw.x,
                        y: hit.y - hw.y,
                        z: hit.z - hw.z,
                    });
                }
            };

            // ── Drag end ───────────────────────────────────────────────
            const onUp = () => {
                dragRef.current = null;
                if (controlsRef.current) controlsRef.current.enabled = true;
                gl.domElement.style.cursor = '';
                gl.domElement.removeEventListener('pointermove', onMove);
                gl.domElement.removeEventListener('pointerup', onUp);
            };

            gl.domElement.addEventListener('pointermove', onMove);
            gl.domElement.addEventListener('pointerup', onUp);
        },
        [camera, gl, controlsRef]
    );

    return (
        <group>
            {LEG_IDS.map((id) => {
                const isSelected = selectedLeg === id;
                return (
                    <group key={id} position={footPositions[id]}>
                        {/* Invisible larger sphere for easier clicking */}
                        <mesh
                            onPointerDown={(e) => startDrag(e, id)}
                            onPointerOver={() => {
                                if (!dragRef.current)
                                    gl.domElement.style.cursor = 'grab';
                            }}
                            onPointerOut={() => {
                                if (!dragRef.current)
                                    gl.domElement.style.cursor = '';
                            }}
                        >
                            <sphereGeometry args={[1.5, 8, 8]} />
                            <meshBasicMaterial visible={false} />
                        </mesh>

                        {/* Visible target sphere */}
                        <mesh>
                            <sphereGeometry args={[isSelected ? 1.0 : 0.7, 16, 16]} />
                            <meshStandardMaterial
                                color={LEG_CONFIG[id].color}
                                transparent
                                opacity={isSelected ? 0.75 : 0.35}
                                emissive={LEG_CONFIG[id].color}
                                emissiveIntensity={isSelected ? 0.4 : 0.1}
                                depthWrite={false}
                            />
                        </mesh>

                        {/* Ring around selected foot */}
                        {isSelected && (
                            <mesh rotation-x={Math.PI / 2}>
                                <ringGeometry args={[1.2, 1.5, 24]} />
                                <meshBasicMaterial
                                    color={LEG_CONFIG[id].color}
                                    transparent
                                    opacity={0.5}
                                    side={THREE.DoubleSide}
                                />
                            </mesh>
                        )}
                    </group>
                );
            })}
        </group>
    );
}
