import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { LEG_IDS, LEG_CONFIG } from '../constants';

/** Pose recording, playback, and method management */
export function Recorder() {
    const [transitionMs, setTransitionMs] = useState(500);
    const [methodName, setMethodName] = useState('');

    const poses = useStore((s) => s.poses);
    const methods = useStore((s) => s.methods);
    const isPlaying = useStore((s) => s.isPlaying);

    const recordPose = useStore((s) => s.recordPose);
    const deletePose = useStore((s) => s.deletePose);
    const clearPoses = useStore((s) => s.clearPoses);
    const jumpToPose = useStore((s) => s.jumpToPose);
    const movePoseUp = useStore((s) => s.movePoseUp);
    const movePoseDown = useStore((s) => s.movePoseDown);
    const updatePoseLabel = useStore((s) => s.updatePoseLabel);
    const updatePoseTransition = useStore((s) => s.updatePoseTransition);
    const setPlaying = useStore((s) => s.setPlaying);
    const createMethod = useStore((s) => s.createMethod);
    const deleteMethod = useStore((s) => s.deleteMethod);
    const loadMethodPoses = useStore((s) => s.loadMethodPoses);

    const handleRecord = () => {
        recordPose(transitionMs);
    };

    const handleCreateMethod = () => {
        if (methodName.trim() && poses.length > 0) {
            createMethod(methodName.trim());
            setMethodName('');
        }
    };

    return (
        <>
            {/* ── Recording ─────────────────────────────────────────── */}
            <section className="panel">
                <h2>Record Actions</h2>

                <div className="record-top">
                    <button className="btn btn-full btn-accent" onClick={handleRecord}>
                        Record Current Pose
                    </button>
                    <div className="slider-row compact">
                        <label>Transition time</label>
                        <input
                            type="number"
                            value={transitionMs}
                            min={50}
                            max={5000}
                            step={50}
                            onChange={(e) => setTransitionMs(Number(e.target.value))}
                        />
                        <span className="unit">ms</span>
                    </div>
                </div>

                {/* Pose list */}
                {poses.length > 0 && (
                    <div className="pose-list">
                        <h3>Recorded Poses ({poses.length})</h3>
                        {poses.map((pose, i) => (
                            <div key={i} className="pose-item">
                                <div className="pose-header">
                                    <input
                                        className="pose-label-input"
                                        value={pose.label}
                                        onChange={(e) => updatePoseLabel(i, e.target.value)}
                                    />
                                    <span className="pose-time">{pose.transitionMs}ms</span>
                                </div>
                                <div className="pose-angles">
                                    {LEG_IDS.map((id) => (
                                        <span key={id} style={{ color: LEG_CONFIG[id].color }}>
                                            {id}: {pose.angles[id].hip}/{pose.angles[id].shoulder}/{pose.angles[id].knee}
                                        </span>
                                    ))}
                                </div>
                                <div className="pose-actions">
                                    <button className="btn btn-xs" onClick={() => jumpToPose(i)} title="Apply this pose">
                                        Apply
                                    </button>
                                    <button className="btn btn-xs" onClick={() => movePoseUp(i)} disabled={i === 0}>
                                        Up
                                    </button>
                                    <button className="btn btn-xs" onClick={() => movePoseDown(i)} disabled={i === poses.length - 1}>
                                        Dn
                                    </button>
                                    <button className="btn btn-xs btn-danger" onClick={() => deletePose(i)}>
                                        Del
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Playback controls */}
                {poses.length > 0 && (
                    <div className="playback-controls">
                        <button
                            className={`btn ${isPlaying ? 'btn-danger' : 'btn-accent'}`}
                            onClick={() => setPlaying(!isPlaying)}
                        >
                            {isPlaying ? 'Stop' : 'Play Sequence'}
                        </button>
                        <button className="btn" onClick={clearPoses}>
                            Clear All
                        </button>
                    </div>
                )}
            </section>

            {/* ── Methods ───────────────────────────────────────────── */}
            <section className="panel">
                <h2>Action Methods</h2>
                <p className="hint">
                    Group recorded poses into reusable named methods.
                    These become functions in the generated Arduino code.
                </p>

                <div className="method-create">
                    <input
                        type="text"
                        placeholder="Method name (e.g. walkForward)"
                        value={methodName}
                        onChange={(e) => setMethodName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateMethod()}
                    />
                    <button
                        className="btn"
                        onClick={handleCreateMethod}
                        disabled={!methodName.trim() || poses.length === 0}
                    >
                        Create Method
                    </button>
                </div>

                {poses.length > 0 && (
                    <p className="hint">
                        Current poses ({poses.length}) will be saved into the method and cleared.
                    </p>
                )}

                {/* Saved methods */}
                {methods.length > 0 && (
                    <div className="method-list">
                        <h3>Saved Methods</h3>
                        {methods.map((method, i) => (
                            <div key={i} className="method-item">
                                <div className="method-info">
                                    <strong>{method.name}</strong>
                                    <span className="method-count">{method.poses.length} poses</span>
                                </div>
                                <div className="method-actions">
                                    <button
                                        className="btn btn-xs"
                                        onClick={() => loadMethodPoses(i)}
                                        title="Load poses back for editing"
                                    >
                                        Load
                                    </button>
                                    <button className="btn btn-xs btn-danger" onClick={() => deleteMethod(i)}>
                                        Del
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </>
    );
}
