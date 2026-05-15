import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { PRESETS, LEG_IDS, getInitAngles } from './constants.js';
import { solveIK, computeFK } from './ik-solver.js';

function defaultAngles() {
    // Start at init/calibration position (0° for left, 180° for right)
    return getInitAngles();
}

function defaultIKTargets() {
    return {
        FL: { x: -11, y: 0, z: 0 },
        FR: { x: 11, y: 0, z: 0 },
        BL: { x: -11, y: 0, z: 0 },
        BR: { x: 11, y: 0, z: 0 },
    };
}

export const useStore = create(subscribeWithSelector((set, get) => ({
    // ── Mode ───────────────────────────────────────────────────────────
    mode: 'fk', // 'fk' or 'ik'

    // ── Selection ──────────────────────────────────────────────────────
    selectedLeg: 'FL',

    // ── Servo angles (0-180 for each of 12 servos) ────────────────────
    legs: defaultAngles(),

    // ── IK targets (foot position relative to hip, in cm) ─────────────
    ikTargets: defaultIKTargets(),

    // ── IK explanation steps ───────────────────────────────────────────
    ikExplanation: null,

    // ── Recorded poses ─────────────────────────────────────────────────
    poses: [],

    // ── Named methods (groups of poses) ────────────────────────────────
    methods: [],

    // ── Playback state ─────────────────────────────────────────────────
    isPlaying: false,
    playbackIndex: -1,

    // ── Actions ────────────────────────────────────────────────────────

    setMode: (mode) => set({ mode }),

    selectLeg: (legId) => set({ selectedLeg: legId }),

    /** Set a single servo angle for one leg */
    setLegAngle: (legId, joint, angle) =>
        set((state) => ({
            legs: {
                ...state.legs,
                [legId]: { ...state.legs[legId], [joint]: angle },
            },
        })),

    /** Set all angles at once (e.g., from a preset or playback) */
    setAllAngles: (angles) => set({ legs: structuredClone(angles) }),

    /** Reset all servos to init/calibration position (0° left, 180° right) */
    centerAll: () => set({ legs: defaultAngles() }),

    /** Apply a named preset */
    applyPreset: (presetKey) => {
        const preset = PRESETS[presetKey];
        if (preset) {
            set({ legs: structuredClone(preset.angles) });
        }
    },

    /** Update IK target and solve for angles */
    setIKTarget: (legId, target) => {
        const isLeft = legId === 'FL' || legId === 'BL';
        const result = solveIK(target, isLeft, legId);
        const update = {
            ikTargets: { ...get().ikTargets, [legId]: { ...target } },
            ikExplanation: result.steps,
        };
        if (result.angles) {
            update.legs = { ...get().legs, [legId]: result.angles };
        }
        set(update);
    },

    /** Sync IK targets from current FK angles (when switching to IK mode) */
    syncIKTargetsFromAngles: () => {
        const { legs } = get();
        const targets = {};
        for (const id of LEG_IDS) {
            const isLeft = id === 'FL' || id === 'BL';
            targets[id] = computeFK(legs[id], isLeft, id);
        }
        set({ ikTargets: targets });
    },

    // ── Multi-leg helpers ────────────────────────────────────────────────

    /** Copy selected leg's shoulder+knee angles to all other legs (hip stays per-leg) */
    copyLegToAll: (sourceLegId) =>
        set((state) => {
            const src = state.legs[sourceLegId];
            const legs = {};
            for (const id of LEG_IDS) {
                legs[id] = {
                    hip: state.legs[id].hip, // keep each leg's own hip
                    shoulder: src.shoulder,
                    knee: src.knee,
                };
            }
            return { legs };
        }),

    /** Mirror left side angles to right side (and vice versa), accounting for hip inversion */
    mirrorLeftRight: () =>
        set((state) => {
            const { FL, FR, BL, BR } = state.legs;
            return {
                legs: {
                    FL: { hip: FL.hip, shoulder: FR.shoulder, knee: FR.knee },
                    FR: { hip: FR.hip, shoulder: FL.shoulder, knee: FL.knee },
                    BL: { hip: BL.hip, shoulder: BR.shoulder, knee: BR.knee },
                    BR: { hip: BR.hip, shoulder: BL.shoulder, knee: BL.knee },
                },
            };
        }),

    /** Mirror front legs to back legs */
    mirrorFrontBack: () =>
        set((state) => {
            const { FL, FR, BL, BR } = state.legs;
            return {
                legs: {
                    FL,
                    FR,
                    BL: { hip: BL.hip, shoulder: FL.shoulder, knee: FL.knee },
                    BR: { hip: BR.hip, shoulder: FR.shoulder, knee: FR.knee },
                },
            };
        }),

    // ── Recording ──────────────────────────────────────────────────────

    recordPose: (transitionMs = 500) =>
        set((state) => ({
            poses: [
                ...state.poses,
                {
                    angles: structuredClone(state.legs),
                    transitionMs,
                    label: `Pose ${state.poses.length + 1}`,
                },
            ],
        })),

    deletePose: (index) =>
        set((state) => ({
            poses: state.poses.filter((_, i) => i !== index),
        })),

    updatePoseLabel: (index, label) =>
        set((state) => ({
            poses: state.poses.map((p, i) => (i === index ? { ...p, label } : p)),
        })),

    updatePoseTransition: (index, transitionMs) =>
        set((state) => ({
            poses: state.poses.map((p, i) => (i === index ? { ...p, transitionMs } : p)),
        })),

    clearPoses: () => set({ poses: [] }),

    movePoseUp: (index) =>
        set((state) => {
            if (index === 0) return state;
            const poses = [...state.poses];
            [poses[index - 1], poses[index]] = [poses[index], poses[index - 1]];
            return { poses };
        }),

    movePoseDown: (index) =>
        set((state) => {
            if (index >= state.poses.length - 1) return state;
            const poses = [...state.poses];
            [poses[index], poses[index + 1]] = [poses[index + 1], poses[index]];
            return { poses };
        }),

    /** Jump to a recorded pose (apply its angles) */
    jumpToPose: (index) => {
        const pose = get().poses[index];
        if (pose) {
            set({ legs: structuredClone(pose.angles) });
        }
    },

    // ── Methods (named action groups) ──────────────────────────────────

    createMethod: (name) =>
        set((state) => {
            if (state.poses.length === 0) return state;
            return {
                methods: [
                    ...state.methods,
                    { name, poses: structuredClone(state.poses) },
                ],
                poses: [], // clear poses after grouping
            };
        }),

    deleteMethod: (index) =>
        set((state) => ({
            methods: state.methods.filter((_, i) => i !== index),
        })),

    /** Load a method's poses back into the recorder for editing */
    loadMethodPoses: (index) => {
        const method = get().methods[index];
        if (method) {
            set({ poses: structuredClone(method.poses) });
        }
    },

    // ── Playback ───────────────────────────────────────────────────────

    setPlaying: (isPlaying) => set({ isPlaying, playbackIndex: isPlaying ? 0 : -1 }),
    setPlaybackIndex: (playbackIndex) => set({ playbackIndex }),

    // ── ESP32 Live Link ────────────────────────────────────────────────

    esp32Ip: '192.168.4.1',
    liveMode: false,
    esp32Connected: false,
    esp32Error: null,

    setEsp32Ip: (esp32Ip) => set({ esp32Ip }),
    setLiveMode: (liveMode) => set({ liveMode }),
    setEsp32Connected: (esp32Connected) => set({ esp32Connected }),
    setEsp32Error: (esp32Error) => set({ esp32Error }),
})));
