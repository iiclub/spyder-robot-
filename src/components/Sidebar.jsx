import React, { useCallback } from 'react';
import { useStore } from '../store';
import { LEG_IDS, LEG_CONFIG, PRESETS, SERVO_CONFIG, servoToJoint } from '../constants';
import { computeFK } from '../ik-solver';
import { Esp32Panel } from './Esp32Panel';

/** Mode toggle: FK (manual angles) vs IK (drag foot targets) */
function ModeSelector() {
    const mode = useStore((s) => s.mode);
    const setMode = useStore((s) => s.setMode);
    const syncIKTargetsFromAngles = useStore((s) => s.syncIKTargetsFromAngles);

    const switchToIK = () => {
        syncIKTargetsFromAngles();
        setMode('ik');
    };

    return (
        <section className="panel">
            <h2>Mode</h2>
            <div className="btn-group">
                <button
                    className={`btn ${mode === 'fk' ? 'active' : ''}`}
                    onClick={() => setMode('fk')}
                    title="Control each servo angle directly with sliders"
                >
                    FK (Angles)
                </button>
                <button
                    className={`btn ${mode === 'ik' ? 'active' : ''}`}
                    onClick={switchToIK}
                    title="Set foot target positions, angles computed via Inverse Kinematics"
                >
                    IK (Target)
                </button>
            </div>
        </section>
    );
}

/** Calibration: set all servos to their init position */
function CalibratePanel() {
    const centerAll = useStore((s) => s.centerAll);
    return (
        <section className="panel">
            <h2>Calibrate</h2>
            <button className="btn btn-full btn-accent" onClick={centerAll}>
                Init Position (All Straight)
            </button>
            <p className="hint">
                Hip: left=0&deg; / right=180&deg;. Shoulder &amp; Knee: 90&deg; (center).
                Attach servo horns with all legs straight out in this position.
            </p>
        </section>
    );
}

/** Select which leg to control */
function LegSelector() {
    const selectedLeg = useStore((s) => s.selectedLeg);
    const selectLeg = useStore((s) => s.selectLeg);

    return (
        <section className="panel">
            <h2>Select Leg</h2>
            <div className="btn-group leg-selector">
                {LEG_IDS.map((id) => (
                    <button
                        key={id}
                        className={`btn leg-btn ${selectedLeg === id ? 'active' : ''}`}
                        style={{
                            borderColor: LEG_CONFIG[id].color,
                            background: selectedLeg === id ? LEG_CONFIG[id].color : 'transparent',
                        }}
                        onClick={() => selectLeg(id)}
                    >
                        {id}
                    </button>
                ))}
            </div>
            <div className="leg-diagram">
                <div className="leg-diagram-row">
                    <span
                        className={`leg-dot ${selectedLeg === 'FL' ? 'selected' : ''}`}
                        style={{ color: LEG_CONFIG.FL.color }}
                        onClick={() => selectLeg('FL')}
                    >FL</span>
                    <span className="body-label">FRONT</span>
                    <span
                        className={`leg-dot ${selectedLeg === 'FR' ? 'selected' : ''}`}
                        style={{ color: LEG_CONFIG.FR.color }}
                        onClick={() => selectLeg('FR')}
                    >FR</span>
                </div>
                <div className="leg-diagram-body">[ BODY ]</div>
                <div className="leg-diagram-row">
                    <span
                        className={`leg-dot ${selectedLeg === 'BL' ? 'selected' : ''}`}
                        style={{ color: LEG_CONFIG.BL.color }}
                        onClick={() => selectLeg('BL')}
                    >BL</span>
                    <span className="body-label">BACK</span>
                    <span
                        className={`leg-dot ${selectedLeg === 'BR' ? 'selected' : ''}`}
                        style={{ color: LEG_CONFIG.BR.color }}
                        onClick={() => selectLeg('BR')}
                    >BR</span>
                </div>
            </div>
        </section>
    );
}

/** FK mode: direct servo angle sliders */
function FKControls() {
    const selectedLeg = useStore((s) => s.selectedLeg);
    const angles = useStore((s) => s.legs[s.selectedLeg]);
    const setLegAngle = useStore((s) => s.setLegAngle);
    const isLeft = LEG_CONFIG[selectedLeg].isLeft;

    const joints = [
        { key: 'hip', label: 'Hip (Y-axis)', desc: 'Swings leg forward/backward' },
        { key: 'shoulder', label: 'Shoulder (X-axis)', desc: 'Lifts/lowers upper leg' },
        { key: 'knee', label: 'Knee (X-axis)', desc: 'Bends/extends lower leg' },
    ];

    const hipInit = isLeft ? '0°' : '180°';

    return (
        <section className="panel">
            <h2>
                Servo Angles{' '}
                <span className="leg-badge" style={{ background: LEG_CONFIG[selectedLeg].color }}>
                    {selectedLeg}
                </span>
            </h2>
            <p className="hint" style={{ marginBottom: 6 }}>
                Hip init={hipInit} ({isLeft ? 'left' : 'right'} side) &middot; Shoulder/Knee center=90&deg;
            </p>
            {joints.map(({ key, label, desc }) => {
                const jointDeg = servoToJoint(angles[key], selectedLeg, key);
                return (
                    <div className="slider-row" key={key}>
                        <div className="slider-label">
                            <label>{label}</label>
                            <span className="slider-val">
                                {angles[key]}&deg;
                                <span style={{ color: '#888', fontSize: 10, marginLeft: 4 }}>
                                    (joint: {jointDeg.toFixed(0)}&deg;)
                                </span>
                            </span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={180}
                            step={1}
                            value={angles[key]}
                            onChange={(e) => setLegAngle(selectedLeg, key, Number(e.target.value))}
                        />
                        <p className="slider-desc">{desc}</p>
                    </div>
                );
            })}
        </section>
    );
}

/** IK mode: foot target position sliders */
function IKControls() {
    const selectedLeg = useStore((s) => s.selectedLeg);
    const target = useStore((s) => s.ikTargets[s.selectedLeg]);
    const setIKTarget = useStore((s) => s.setIKTarget);
    const isLeft = LEG_CONFIG[selectedLeg].isLeft;

    const axes = [
        { key: 'x', label: 'X (sideways)', min: -20, max: 20, desc: 'Left/right from hip' },
        { key: 'y', label: 'Y (height)', min: -18, max: 8, desc: 'Up/down from hip' },
        { key: 'z', label: 'Z (forward)', min: -15, max: 15, desc: 'Forward/backward from hip' },
    ];

    const handleChange = (axis, value) => {
        setIKTarget(selectedLeg, { ...target, [axis]: value });
    };

    return (
        <section className="panel">
            <h2>
                Foot Target{' '}
                <span className="leg-badge" style={{ background: LEG_CONFIG[selectedLeg].color }}>
                    {selectedLeg}
                </span>
            </h2>
            {axes.map(({ key, label, min, max, desc }) => (
                <div className="slider-row" key={key}>
                    <div className="slider-label">
                        <label>{label}</label>
                        <span className="slider-val">{target[key].toFixed(1)} cm</span>
                    </div>
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={0.5}
                        value={target[key]}
                        onChange={(e) => handleChange(key, Number(e.target.value))}
                    />
                    <p className="slider-desc">{desc}</p>
                </div>
            ))}
        </section>
    );
}

/** Preset poses */
function PresetPanel() {
    const applyPreset = useStore((s) => s.applyPreset);

    return (
        <section className="panel">
            <h2>Preset Poses</h2>
            <div className="btn-group">
                {Object.entries(PRESETS).map(([key, preset]) => (
                    <button key={key} className="btn" onClick={() => applyPreset(key)}>
                        {preset.name}
                    </button>
                ))}
            </div>
        </section>
    );
}

/** All-legs editor: compact sliders for every leg + copy/mirror tools */
function AllLegsEditor() {
    const legs = useStore((s) => s.legs);
    const setLegAngle = useStore((s) => s.setLegAngle);
    const selectedLeg = useStore((s) => s.selectedLeg);
    const copyLegToAll = useStore((s) => s.copyLegToAll);
    const mirrorLeftRight = useStore((s) => s.mirrorLeftRight);
    const mirrorFrontBack = useStore((s) => s.mirrorFrontBack);
    const [expanded, setExpanded] = React.useState(false);

    return (
        <section className="panel">
            <div className="panel-header-row">
                <h2>All Legs (Group Edit)</h2>
                <button
                    className="btn btn-xs"
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? 'Collapse' : 'Expand'}
                </button>
            </div>

            {/* Quick copy/mirror actions */}
            <div className="btn-group" style={{ marginBottom: 6 }}>
                <button
                    className="btn btn-xs"
                    onClick={() => copyLegToAll(selectedLeg)}
                    title={`Copy ${selectedLeg}'s shoulder & knee to all legs`}
                >
                    Copy {selectedLeg} to All
                </button>
                <button className="btn btn-xs" onClick={mirrorLeftRight} title="Mirror left ↔ right shoulder & knee">
                    Mirror L↔R
                </button>
                <button className="btn btn-xs" onClick={mirrorFrontBack} title="Copy front legs' shoulder & knee to back">
                    Front→Back
                </button>
            </div>

            {/* Compact overview (always visible) */}
            <table className="angle-table">
                <thead>
                    <tr>
                        <th>Leg</th>
                        <th>Hip</th>
                        <th>Shldr</th>
                        <th>Knee</th>
                    </tr>
                </thead>
                <tbody>
                    {LEG_IDS.map((id) => (
                        <tr key={id}>
                            <td style={{ color: LEG_CONFIG[id].color, fontWeight: 'bold' }}>{id}</td>
                            <td>{legs[id].hip}&deg;</td>
                            <td>{legs[id].shoulder}&deg;</td>
                            <td>{legs[id].knee}&deg;</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Expanded: inline sliders for all 4 legs */}
            {expanded && (
                <div className="all-legs-sliders">
                    {LEG_IDS.map((id) => (
                        <div key={id} className="all-legs-leg">
                            <h3 style={{ color: LEG_CONFIG[id].color }}>{id} — {LEG_CONFIG[id].name}</h3>
                            {['hip', 'shoulder', 'knee'].map((joint) => (
                                <div className="mini-slider" key={joint}>
                                    <span className="mini-label">{joint.slice(0, 3)}</span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={180}
                                        step={1}
                                        value={legs[id][joint]}
                                        onChange={(e) => setLegAngle(id, joint, Number(e.target.value))}
                                    />
                                    <span className="mini-val">{legs[id][joint]}&deg;</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export function Sidebar() {
    const mode = useStore((s) => s.mode);

    return (
        <aside id="sidebar">
            <Esp32Panel />
            <ModeSelector />
            <CalibratePanel />
            <LegSelector />
            {mode === 'fk' ? <FKControls /> : <IKControls />}
            <AllLegsEditor />
            <PresetPanel />
        </aside>
    );
}
