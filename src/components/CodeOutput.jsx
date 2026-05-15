import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { generateArduinoCode } from '../code-generator';

export function CodeOutput() {
    const poses = useStore((s) => s.poses);
    const methods = useStore((s) => s.methods);
    const [showCode, setShowCode] = useState(false);
    const [copied, setCopied] = useState(false);

    const code = useMemo(() => {
        if (!showCode) return '';
        return generateArduinoCode(poses, methods);
    }, [showCode, poses, methods]);

    const handleGenerate = () => {
        setShowCode(true);
        setCopied(false);
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = code;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const hasPoses = poses.length > 0 || methods.length > 0;

    return (
        <div className="bottom-panel code-panel">
            <div className="code-header">
                <h2>Generated Arduino Code</h2>
                <div className="code-actions">
                    {showCode && (
                        <button className="btn btn-sm" onClick={handleCopy}>
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    )}
                    <button
                        className="btn btn-sm btn-accent"
                        onClick={handleGenerate}
                    >
                        {showCode ? 'Regenerate' : 'Generate Code'}
                    </button>
                </div>
            </div>

            <div className="code-content">
                {!showCode && (
                    <div className="code-placeholder">
                        <p>
                            <strong>How to generate Arduino code:</strong>
                        </p>
                        <ol>
                            <li>Position the robot using FK sliders or IK targets</li>
                            <li>Click <strong>"Record Current Pose"</strong> to capture each position</li>
                            <li>Set the <strong>transition time</strong> for smooth movement between poses</li>
                            <li>Optionally group poses into <strong>Methods</strong> (reusable functions)</li>
                            <li>Click <strong>"Generate Code"</strong> to create the Arduino sketch</li>
                        </ol>
                        {hasPoses && (
                            <p className="code-ready">
                                You have {poses.length} pose{poses.length !== 1 ? 's' : ''} and{' '}
                                {methods.length} method{methods.length !== 1 ? 's' : ''} ready.
                                Click Generate!
                            </p>
                        )}
                    </div>
                )}

                {showCode && (
                    <pre className="code-block">
                        <code>{code}</code>
                    </pre>
                )}
            </div>
        </div>
    );
}
