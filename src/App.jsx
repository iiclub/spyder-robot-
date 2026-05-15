import React from 'react';
import { Scene3D } from './components/Scene3D';
import { Sidebar } from './components/Sidebar';
import { Recorder } from './components/Recorder';
import { IKExplainer } from './components/IKExplainer';
import { CodeOutput } from './components/CodeOutput';
import './App.css';

export default function App() {
    return (
        <div id="app">
            <header id="header">
                <h1>Spider Robot Simulator</h1>
                <span className="subtitle">
                    12-Servo Quadruped &middot; Inverse Kinematics &middot; Code Generator
                </span>
            </header>

            <div id="main">
                <div id="viewport">
                    <Scene3D />
                    <div id="viewport-hint">
                        Drag foot sphere: move leg (IK) &middot; Left-drag: rotate &middot; Right-drag: pan &middot; Scroll: zoom
                    </div>
                </div>

                <div id="sidebar-wrapper">
                    <Sidebar />
                    <Recorder />
                </div>
            </div>

            <div id="bottom">
                <IKExplainer />
                <CodeOutput />
            </div>
        </div>
    );
}
