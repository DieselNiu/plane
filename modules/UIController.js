// 用户界面控制模块

import { radiansToDegrees } from '../utils/MathUtils.js';

export class UIController {
    constructor(simulator) {
        this.simulator = simulator;
    }
    
    updateUI() {
        const speed = this.simulator.velocity.length() * 3.6;
        const altitude = Math.max(0, this.simulator.airplane.position.y);
        
        this.updateBasicInfo(speed, altitude);
        this.updateFlightModeDisplay();
        this.updateThrottleDisplay();
        this.updateAttitudeDisplay();
        this.updateWarningSystem();
        this.updatePrecisionControlIndicator();
    }
    
    updateBasicInfo(speed, altitude) {
        const speedElement = document.getElementById('speed');
        const altitudeElement = document.getElementById('altitude');
        const playerCountElement = document.getElementById('playerCount');
        
        if (speedElement) speedElement.textContent = Math.round(speed);
        if (altitudeElement) altitudeElement.textContent = Math.round(altitude);
        if (playerCountElement) {
            playerCountElement.textContent = this.simulator.multiplayerManager.connections.size + 1;
        }
    }
    
    // 更新飞行模式显示
    updateFlightModeDisplay() {
        const modeElement = document.getElementById('flightMode');
        if (modeElement) {
            const modeText = this.simulator.flightMode === 'ground' ? '地面模式' : '空中模式';
            const transitionText = this.simulator.modeTransitionSmoothing < 1.0 ? ' (切换中...)' : '';
            modeElement.textContent = modeText + transitionText;
            
            // 根据模式改变颜色
            modeElement.style.color = this.simulator.flightMode === 'ground' ? '#4CAF50' : '#2196F3';
        }
    }
    
    // 更新油门显示
    updateThrottleDisplay() {
        const throttleElement = document.getElementById('throttle');
        if (!throttleElement) return;
        
        const throttlePercent = Math.round(this.simulator.throttle * 100);
        let throttleStatus = '';
        
        if (this.simulator.throttle > 0.1) {
            const boostText = this.simulator.afterburnerActive ? ' (后燃器)' : '';
            throttleStatus = `前进 ${throttlePercent}%${boostText}`;
        } else if (this.simulator.throttle < -0.1) {
            throttleStatus = `倒退 ${Math.abs(throttlePercent)}%`;
        } else {
            // 显示配平状态
            const targetThrottle = this.simulator.physicsEngine.calculateTargetThrottle();
            const trimActive = Math.abs(targetThrottle) > 0.1;
            
            if (trimActive) {
                throttleStatus = `配平中 (目标: ${Math.round(targetThrottle * 100)}%)`;
            } else {
                throttleStatus = '怠速';
            }
        }
        
        throttleElement.textContent = throttleStatus;
    }
    
    // 更新姿态指示器
    updateAttitudeDisplay() {
        const attitude = this.simulator.physicsEngine.getAttitude();
        
        const rollElement = document.getElementById('rollAngle');
        const pitchElement = document.getElementById('pitchAngle');
        const yawElement = document.getElementById('heading');
        
        if (rollElement) {
            const rollDegrees = Math.round(radiansToDegrees(attitude.roll));
            rollElement.textContent = `${rollDegrees}°`;
        }
        
        if (pitchElement) {
            const pitchDegrees = Math.round(radiansToDegrees(attitude.pitch));
            pitchElement.textContent = `${pitchDegrees}°`;
        }
        
        if (yawElement) {
            const headingDegrees = Math.round(((radiansToDegrees(attitude.yaw)) + 360) % 360);
            yawElement.textContent = `${headingDegrees}°`;
        }
        
        // 更新转弯指示
        this.updateTurnIndicator(attitude);
    }
    
    updateTurnIndicator(attitude) {
        const turnElement = document.getElementById('turnIndicator');
        if (turnElement) {
            if (this.simulator.coordinatedTurnActive) {
                const turnDirection = this.simulator.targetRollAngle > 0 ? '右转' : '左转';
                const turnAngle = Math.round(Math.abs(radiansToDegrees(this.simulator.targetRollAngle)));
                turnElement.textContent = `${turnDirection} ${turnAngle}°`;
                turnElement.style.color = '#FF9800';
            } else {
                turnElement.textContent = '直飞';
                turnElement.style.color = '#4CAF50';
            }
        }
    }
    
    // 更新警告系统
    updateWarningSystem() {
        const warningElement = document.getElementById('warnings');
        if (!warningElement) return;
        
        const warnings = [];
        const speed = this.simulator.velocity.length() * 3.6;
        const altitude = this.simulator.airplane.position.y;
        
        // 失速警告
        if (this.simulator.flightMode === 'air' && speed < 60) {
            warnings.push('⚠️ 失速警告');
        }
        
        // 过载警告
        const gForce = this.simulator.physicsEngine.calculateGForce();
        if (gForce > 3) {
            warnings.push('⚠️ 过载警告');
        }
        
        // 低空警告
        if (this.simulator.flightMode === 'air' && altitude < 10) {
            warnings.push('⚠️ 低空警告');
        }
        
        // 高速警告
        if (speed > 500) {
            warnings.push('⚠️ 超速警告');
        }
        
        warningElement.textContent = warnings.join(' | ') || '';
        warningElement.style.color = warnings.length > 0 ? '#F44336' : '#4CAF50';
    }
    
    // 更新精确控制指示器
    updatePrecisionControlIndicator() {
        this.simulator.controlsManager.updatePrecisionControlIndicator();
    }
    
    // 显示连接状态
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = status;
        }
    }
    
    // 显示加载进度
    showLoadingProgress(message, progress = null) {
        const loadingElement = document.getElementById('loadingStatus');
        if (loadingElement) {
            let text = message;
            if (progress !== null) {
                text += ` ${Math.round(progress)}%`;
            }
            loadingElement.textContent = text;
        }
    }
    
    // 隐藏加载状态
    hideLoadingStatus() {
        const loadingElement = document.getElementById('loadingStatus');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
    
    // 显示错误消息
    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            // 5秒后自动隐藏
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
    }
    
    // 更新性能指标
    updatePerformanceMetrics(fps, frameTime) {
        const fpsElement = document.getElementById('fps');
        const frameTimeElement = document.getElementById('frameTime');
        
        if (fpsElement) {
            fpsElement.textContent = `FPS: ${Math.round(fps)}`;
        }
        
        if (frameTimeElement) {
            frameTimeElement.textContent = `Frame: ${frameTime.toFixed(2)}ms`;
        }
    }
}
