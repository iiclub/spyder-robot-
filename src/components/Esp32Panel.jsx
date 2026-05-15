import React, { useState } from 'react';
import { useStore } from '../store';
import { LEG_IDS, LEG_CONFIG } from '../constants';
import {
    testConnection,
    sendAllTo,
    sendSingleServo,
    startLiveLink,
    stopLiveLink,
} from '../esp32-link';

export function Esp32Panel() {
    const esp32Ip = useStore((s) => s.esp32Ip);
    const liveMode = useStore((s) => s.liveMode);
    const esp32Connected = useStore((s) => s.esp32Connected);
    const esp32Error = useStore((s) => s.esp32Error);

    const setEsp32Ip = useStore((s) => s.setEsp32Ip);
    const setLiveMode = useStore((s) => s.setLiveMode);
    const setEsp32Connected = useStore((s) => s.setEsp32Connected);
    const setEsp32Error = useStore((s) => s.setEsp32Error);

    const [testing, setTesting] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [singleLeg, setSingleLeg] = useState('FL');
    const [singleJoint, setSingleJoint] = useState('hip');

    // ── Connect / test ─────────────────────────────────────────────────
    const handleTest = async () => {
        setTesting(true);
        setEsp32Error(null);
        try {
            await testConnection(esp32Ip);
            setEsp32Connected(true);
        } catch (err) {
            setEsp32Connected(false);
            setEsp32Error(err.message);
        } finally {
            setTesting(false);
        }
    };

    // ── Toggle live mode ───────────────────────────────────────────────
    const handleToggleLive = () => {
        if (liveMode) {
            stopLiveLink();
            setLiveMode(false);
        } else {
            startLiveLink();
            setLiveMode(true);
        }
    };

    // ── Quick all-servo commands ───────────────────────────────────────
    const handleAllTo = async (angle) => {
        try {
            await sendAllTo(esp32Ip, angle);
            setEsp32Error(null);
        } catch (err) {
            setEsp32Error(err.message);
        }
    };

    // ── Single servo command ───────────────────────────────────────────
    const handleSingle = async (angle) => {
        try {
            await sendSingleServo(esp32Ip, singleLeg, singleJoint, angle);
            setEsp32Error(null);
        } catch (err) {
            setEsp32Error(err.message);
        }
    };

    // ── Status dot ─────────────────────────────────────────────────────
    const dotClass = esp32Error
        ? 'esp32-dot error'
        : esp32Connected
        ? 'esp32-dot connected'
        : 'esp32-dot disconnected';

    const statusText = esp32Error
        ? 'Error'
        : esp32Connected
        ? 'Connected'
        : 'Not connected';

    return (
        <section className="panel esp32-panel">
            <div className="panel-header-row">
                <h2>ESP32 Live Link</h2>
                <div className="esp32-status">
                    <span className={dotClass} />
                    <span className="esp32-status-text">{statusText}</span>
                </div>
            </div>

            {/* IP + Connect */}
            <div className="esp32-ip-row">
                <input
                    type="text"
                    value={esp32Ip}
                    onChange={(e) => setEsp32Ip(e.target.value)}
                    placeholder="192.168.4.1"
                />
                <button className="btn btn-sm" onClick={handleTest} disabled={testing}>
                    {testing ? '...' : 'Test'}
                </button>
            </div>

            {/* Live mode toggle */}
            <button
                className={`btn btn-full ${liveMode ? 'btn-danger' : 'btn-accent'}`}
                onClick={handleToggleLive}
            >
                {liveMode ? 'Stop Live Mode' : 'Start Live Mode'}
            </button>
            {liveMode && (
                <p className="hint">
                    Moving sliders or dragging feet now sends angles to ESP32 in real-time.
                </p>
            )}

            {/* Quick commands */}
            <div className="esp32-actions">
                <button className="btn btn-xs" onClick={() => handleAllTo(90)}>
                    All → 90&deg;
                </button>
                <button className="btn btn-xs" onClick={() => handleAllTo(0)}>
                    All → 0&deg;
                </button>
                <button
                    className="btn btn-xs"
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? 'Less' : 'Individual'}
                </button>
            </div>

            {/* Individual servo control (expanded) */}
            {expanded && (
                <div className="esp32-individual">
                    <div className="esp32-select-row">
                        <select value={singleLeg} onChange={(e) => setSingleLeg(e.target.value)}>
                            {LEG_IDS.map((id) => (
                                <option key={id} value={id}>
                                    {id}
                                </option>
                            ))}
                        </select>
                        <select value={singleJoint} onChange={(e) => setSingleJoint(e.target.value)}>
                            <option value="hip">Hip</option>
                            <option value="shoulder">Shoulder</option>
                            <option value="knee">Knee</option>
                        </select>
                    </div>
                    <div className="btn-group">
                        <button className="btn btn-xs" onClick={() => handleSingle(0)}>
                            0&deg;
                        </button>
                        <button className="btn btn-xs" onClick={() => handleSingle(90)}>
                            90&deg;
                        </button>
                        <button className="btn btn-xs" onClick={() => handleSingle(180)}>
                            180&deg;
                        </button>
                    </div>
                </div>
            )}

            {/* Error display */}
            {esp32Error && <p className="esp32-error">{esp32Error}</p>}
        </section>
    );
}
