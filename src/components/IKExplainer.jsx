import React from 'react';
import { useStore } from '../store';

export function IKExplainer() {
    const mode = useStore((s) => s.mode);
    const explanation = useStore((s) => s.ikExplanation);

    return (
        <div className="bottom-panel ik-panel">
            <h2>How It Works (Inverse Kinematics)</h2>
            <div className="ik-content">
                {mode !== 'ik' && (
                    <p className="placeholder">
                        Switch to <strong>IK mode</strong> and move a foot target to see the
                        inverse kinematics math explained step by step.
                    </p>
                )}

                {mode === 'ik' && !explanation && (
                    <p className="placeholder">
                        Move the foot target sliders to see how inverse kinematics
                        computes the servo angles.
                    </p>
                )}

                {explanation && (
                    <div className="ik-steps">
                        {/* Overview */}
                        <div className="ik-overview">
                            <h3>What is Inverse Kinematics?</h3>
                            <p>
                                <strong>Forward Kinematics (FK):</strong> You set servo angles
                                &rarr; the foot ends up somewhere.
                            </p>
                            <p>
                                <strong>Inverse Kinematics (IK):</strong> You choose WHERE the
                                foot should be &rarr; the math figures out the servo angles.
                            </p>
                            <p>
                                Each leg has 3 joints (hip, shoulder, knee) forming a 3-DOF
                                kinematic chain. Here's how IK solves for each angle:
                            </p>
                        </div>

                        {/* Steps */}
                        {explanation.map((step, i) => (
                            <div
                                key={i}
                                className={`ik-step ${step.error ? 'ik-step-error' : ''}`}
                            >
                                <h3>{step.title}</h3>
                                <div className="ik-formula">
                                    <code>{step.formula}</code>
                                </div>
                                <p className="ik-explanation">{step.explanation}</p>
                                <div className={`ik-result ${step.error ? 'error' : ''}`}>
                                    {step.result}
                                </div>
                            </div>
                        ))}

                        {/* Final summary */}
                        <div className="ik-step ik-summary">
                            <h3>Summary</h3>
                            <p>
                                The IK solver uses <strong>trigonometry</strong> (atan2) for the
                                hip angle, <strong>Pythagorean theorem</strong> for reach distance,
                                and the <strong>law of cosines</strong> for the knee and shoulder.
                                This is called <em>analytical IK</em> because we solve it with
                                direct math formulas instead of iterating.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
