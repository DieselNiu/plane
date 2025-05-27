// 物理引擎和飞行控制模块

import { clamp, calculateGForce } from '../utils/MathUtils.js';

export class PhysicsEngine {
    constructor(simulator) {
        this.simulator = simulator;
        this.pitchAngle = 0;
        this.yawAngle = 0;
        this.rollAngle = 0;
        this.previousVelocity = null;
    }

    updatePhysics(deltaTime) {
        // === 第一步：检测飞行模式 ===
        this.updateFlightMode(deltaTime);

        // === 第二步：处理智能控制输入 ===
        this.processControlInputs(deltaTime);

        // === 第三步：应用物理和配平系统 ===
        this.applyPhysicsAndTrim(deltaTime);

        // === 第四步：更新相关系统 ===
        this.updateControlSurfaces();
    }

    // 检测和更新飞行模式
    updateFlightMode(deltaTime) {
        const currentSpeed = this.simulator.velocity.length() * 3.6; // km/h
        const currentAltitude = this.simulator.airplane.position.y;

        // 根据2.md文档的模式切换逻辑
        this.simulator.previousMode = this.simulator.flightMode;

        if (currentSpeed < 40 && currentAltitude < 3) {
            this.simulator.flightMode = 'ground';
        } else if (currentSpeed >= 40 || currentAltitude >= 3) {
            this.simulator.flightMode = 'air';
        }

        // 平滑过渡处理
        if (this.simulator.previousMode !== this.simulator.flightMode) {
            this.simulator.modeTransitionSmoothing = 0; // 开始新的过渡
        } else {
            this.simulator.modeTransitionSmoothing = Math.min(this.simulator.modeTransitionSmoothing + deltaTime * 2, 1.0);
        }
    }

    // 处理智能控制输入
    processControlInputs(deltaTime) {
        // 移动端摇杆状态
        const leftJoy = this.simulator.controlsManager.mobileControls.leftJoystick;
        const rightJoy = this.simulator.controlsManager.mobileControls.rightJoystick;

        // 油门控制
        this.processThrottleControl(deltaTime, rightJoy);

        // A/D键纯YAW控制系统
        this.processPureYawControls(deltaTime, rightJoy);

        // 精确控制 - 方向键的直接控制
        this.processPrecisionControls(deltaTime, leftJoy);

        // 应用配平系统
        this.applyTrimSystem(deltaTime);
    }

    // 油门控制处理
    processThrottleControl(deltaTime, rightJoy) {
        const controls = this.simulator.controlsManager.controls;

        this.simulator.afterburnerActive = controls.ShiftLeft || controls.ShiftRight;

        // W/S键控制
        if (controls.KeyW) {
            this.simulator.throttle = Math.min(this.simulator.throttle + deltaTime * 1.2, 1.0);
        }
        if (controls.KeyS) {
            if (this.simulator.flightMode === 'ground') {
                this.simulator.throttle = Math.max(this.simulator.throttle - deltaTime * 1.5, -0.8);
            } else {
                this.simulator.throttle = Math.max(this.simulator.throttle - deltaTime * 1.0, 0);
            }
        }

        // 移动端右摇杆Y轴控制推力
        if (rightJoy.active && Math.abs(rightJoy.y) > 0.1) {
            const targetThrottle = rightJoy.y;
            if (this.simulator.flightMode === 'ground') {
                this.simulator.throttle = Math.max(-0.8, Math.min(1.0, targetThrottle));
            } else {
                this.simulator.throttle = Math.max(0, Math.min(1.0, targetThrottle));
            }
        }

        // 移动端后燃器控制
        if (rightJoy.active && rightJoy.y > 0.9) {
            this.simulator.afterburnerActive = true;
        }

        // 自动配平油门
        if (!controls.KeyW && !controls.KeyS && !rightJoy.active) {
            const targetThrottle = this.calculateTargetThrottle();
            const trimRate = this.getTrimStrength('speed') * deltaTime;
            this.simulator.throttle = THREE.MathUtils.lerp(this.simulator.throttle, targetThrottle, trimRate);
        }
    }

    // A/D键纯YAW控制系统
    processPureYawControls(deltaTime, rightJoy) {
        const controls = this.simulator.controlsManager.controls;

        if (controls.KeyA) {
            if (this.simulator.flightMode === 'ground') {
                const groundYawRate = this.calculateGroundYawRate(1, deltaTime);
                this.yawAngle += groundYawRate;
            } else {
                const airYawRate = this.calculateAirYawRate(1, deltaTime);
                this.yawAngle += airYawRate;
            }
        }

        if (controls.KeyD) {
            if (this.simulator.flightMode === 'ground') {
                const groundYawRate = this.calculateGroundYawRate(-1, deltaTime);
                this.yawAngle += groundYawRate;
            } else {
                const airYawRate = this.calculateAirYawRate(-1, deltaTime);
                this.yawAngle += airYawRate;
            }
        }

        // 移动端右摇杆X轴输入
        if (rightJoy.active && Math.abs(rightJoy.x) > 0.1) {
            if (this.simulator.flightMode === 'ground') {
                const groundYawRate = this.calculateGroundYawRate(-rightJoy.x, deltaTime);
                this.yawAngle += groundYawRate;
            } else {
                const airYawRate = this.calculateAirYawRate(-rightJoy.x, deltaTime);
                this.yawAngle += airYawRate;
            }
        }
    }

    // 计算地面模式的偏航速率
    calculateGroundYawRate(turnInput, deltaTime) {
        const currentSpeed = this.simulator.velocity.length() * 3.6;

        if (currentSpeed < 5) {
            return 0;
        }

        const minSpeed = 5;
        const maxSpeed = 80;
        const speedFactor = Math.min((currentSpeed - minSpeed) / (maxSpeed - minSpeed), 1.0);
        const baseYawRate = 2.5;

        return turnInput * deltaTime * baseYawRate * speedFactor;
    }

    // 计算空中模式的偏航速率
    calculateAirYawRate(turnInput, deltaTime) {
        const currentSpeed = this.simulator.velocity.length() * 3.6;
        const altitude = this.simulator.airplane.position.y;

        // 空气密度因子
        const densityFactor = Math.max(0.3, Math.exp(-altitude / 1000));

        // 速度因子
        const minEffectiveSpeed = 40;
        const optimalSpeed = 150;
        const maxSpeed = 400;

        let speedFactor;
        if (currentSpeed < minEffectiveSpeed) {
            speedFactor = (currentSpeed / minEffectiveSpeed) * 0.3;
        } else if (currentSpeed <= optimalSpeed) {
            speedFactor = 0.3 + (currentSpeed - minEffectiveSpeed) / (optimalSpeed - minEffectiveSpeed) * 0.7;
        } else if (currentSpeed <= maxSpeed) {
            speedFactor = 1.0;
        } else {
            speedFactor = Math.max(0.7, 1.0 - (currentSpeed - maxSpeed) / 200 * 0.3);
        }

        // 飞行姿态影响
        const rollEffect = Math.cos(this.rollAngle);
        const pitchEffect = Math.cos(this.pitchAngle);

        const baseYawRate = 0.8;

        return turnInput * deltaTime * baseYawRate * speedFactor * densityFactor * rollEffect * pitchEffect;
    }

    // 精确控制处理
    processPrecisionControls(deltaTime, leftJoy) {
        const controls = this.simulator.controlsManager.controls;
        const controlSpeed = 1.8;

        // 上/下箭头控制俯仰
        if (controls.ArrowUp) {
            this.pitchAngle = Math.max(this.pitchAngle - deltaTime * controlSpeed, -Math.PI / 4);
        }
        if (controls.ArrowDown) {
            this.pitchAngle = Math.min(this.pitchAngle + deltaTime * controlSpeed, Math.PI / 4);
        }

        // 移动端左摇杆Y轴控制俯仰
        if (leftJoy.active && Math.abs(leftJoy.y) > 0.1) {
            const targetPitch = leftJoy.y * Math.PI / 4;
            this.pitchAngle = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, targetPitch));
        }

        // 左/右箭头控制智能协调转弯
        let coordinatedTurnInput = 0;

        if (controls.ArrowLeft) {
            coordinatedTurnInput = 1;
        }
        if (controls.ArrowRight) {
            coordinatedTurnInput = -1;
        }

        // 移动端左摇杆X轴控制协调转弯
        if (leftJoy.active && Math.abs(leftJoy.x) > 0.1) {
            coordinatedTurnInput = -leftJoy.x;
        }

        if (Math.abs(coordinatedTurnInput) > 0.1) {
            this.simulator.coordinatedTurnActive = true;

            if (this.simulator.flightMode === 'ground') {
                const groundYawRate = this.calculateGroundYawRate(coordinatedTurnInput, deltaTime);
                this.yawAngle += groundYawRate;
                this.simulator.targetRollAngle = 0;
            } else {
                this.executeCoordinatedTurn(coordinatedTurnInput, deltaTime);
            }
        } else {
            this.simulator.coordinatedTurnActive = false;
            this.simulator.targetRollAngle = 0;
        }

        // 平滑应用目标翻滚角度
        const rollRate = deltaTime * 3.5;
        this.rollAngle = THREE.MathUtils.lerp(this.rollAngle, this.simulator.targetRollAngle, rollRate);
    }

    // 执行空中协调转弯
    executeCoordinatedTurn(turnInput, deltaTime) {
        const currentSpeed = this.simulator.velocity.length() * 3.6;

        // 主要动作：Roll（翻滚倾斜）
        const rollAngle = this.calculateOptimalRollAngle(turnInput, currentSpeed);
        this.simulator.targetRollAngle = rollAngle;

        // 辅助动作：Yaw（方向舵修正）
        const yawCorrection = this.calculateYawCorrection(turnInput, rollAngle, currentSpeed, deltaTime);
        this.yawAngle += yawCorrection;

        // 补偿动作：轻微Pitch调整
        const pitchCompensation = this.calculatePitchCompensation(rollAngle, deltaTime);
        this.pitchAngle += pitchCompensation;

        // 限制俯仰角度
        this.pitchAngle = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, this.pitchAngle));
    }

    // 计算最佳翻滚角度
    calculateOptimalRollAngle(turnInput, currentSpeed) {
        const minRoll = 10 * Math.PI / 180;
        const maxRoll = 60 * Math.PI / 180;

        // 失速保护
        const stallSpeed = 80;
        if (currentSpeed < stallSpeed) {
            const stallProtectionFactor = Math.max(currentSpeed / stallSpeed, 0.3);
            const protectedMaxRoll = minRoll + (maxRoll - minRoll) * stallProtectionFactor;
            return turnInput * Math.min(protectedMaxRoll, minRoll + Math.abs(turnInput) * (protectedMaxRoll - minRoll));
        }

        // 速度因子
        const speedFactor = Math.min(Math.max((currentSpeed - 100) / 300, 0), 1);

        // 载荷因子限制
        const gForceLimit = 4.0;
        const currentGForce = this.calculateGForce();

        if (currentGForce > gForceLimit * 0.8) {
            const gForceFactor = Math.max(1 - (currentGForce - gForceLimit * 0.8) / (gForceLimit * 0.2), 0.5);
            const limitedMaxRoll = maxRoll * gForceFactor;
            return turnInput * (minRoll + Math.abs(turnInput) * (limitedMaxRoll - minRoll));
        }

        const optimalMaxRoll = maxRoll - speedFactor * (maxRoll - minRoll) * 0.3;

        return turnInput * (minRoll + Math.abs(turnInput) * (optimalMaxRoll - minRoll));
    }

    // 计算偏航修正量
    calculateYawCorrection(turnInput, rollAngle, currentSpeed, deltaTime) {
        const desiredTurnRate = 3 * Math.PI / 180;
        const actualTurnRate = Math.sin(rollAngle) * 9.81 / (currentSpeed * 0.277);

        const yawError = (desiredTurnRate - actualTurnRate) * turnInput;
        const compensationStrength = 0.8;

        return yawError * compensationStrength * deltaTime;
    }

    // 计算俯仰补偿
    calculatePitchCompensation(rollAngle, deltaTime) {
        const compensationFactor = 0.25;
        const maxCompensation = 5 * Math.PI / 180;

        const compensation = Math.abs(rollAngle) * compensationFactor;
        return Math.min(compensation, maxCompensation) * deltaTime;
    }

    // 应用配平系统
    applyTrimSystem(deltaTime) {
        const trimStrength = this.getTrimStrength('attitude');

        // 翻滚角自动回中
        if (!this.simulator.coordinatedTurnActive &&
            !this.simulator.controlsManager.controls.ArrowLeft &&
            !this.simulator.controlsManager.controls.ArrowRight &&
            !this.simulator.controlsManager.mobileControls.leftJoystick.active) {

            const rollTrimRate = this.simulator.flightMode === 'ground' ?
                this.simulator.trimSystem.rollDamping * 2.0 :
                this.simulator.trimSystem.rollDamping;

            this.rollAngle = THREE.MathUtils.lerp(
                this.rollAngle,
                0,
                deltaTime * rollTrimRate * trimStrength
            );
        }

        // 俯仰稳定
        if (!this.simulator.controlsManager.controls.ArrowUp &&
            !this.simulator.controlsManager.controls.ArrowDown &&
            !this.simulator.controlsManager.mobileControls.leftJoystick.active) {

            let targetPitch = 0;

            if (this.simulator.flightMode === 'ground') {
                targetPitch = 0;
            } else {
                const currentSpeed = this.simulator.velocity.length() * 3.6;
                const cruiseSpeed = this.simulator.trimSystem.targetSpeed;

                if (currentSpeed < cruiseSpeed * 0.8) {
                    targetPitch = Math.min(this.pitchAngle * 0.9 + 0.05, Math.PI / 12);
                } else if (currentSpeed > cruiseSpeed * 1.2) {
                    targetPitch = Math.max(this.pitchAngle * 0.9 - 0.02, -Math.PI / 20);
                } else {
                    targetPitch = this.pitchAngle * 0.98;
                }
            }

            const pitchTrimRate = this.simulator.trimSystem.pitchStability * trimStrength *
                (this.simulator.flightMode === 'ground' ? 0.5 : 0.1);

            this.pitchAngle = THREE.MathUtils.lerp(
                this.pitchAngle,
                targetPitch,
                deltaTime * pitchTrimRate
            );
        }

        // 偏航阻尼
        if (!this.simulator.controlsManager.controls.KeyA &&
            !this.simulator.controlsManager.controls.KeyD &&
            !this.simulator.controlsManager.mobileControls.rightJoystick.active &&
            !this.simulator.coordinatedTurnActive) {

            const yawDampingRate = this.simulator.flightMode === 'ground' ?
                this.simulator.trimSystem.yawDamping * 0.3 :
                this.simulator.trimSystem.yawDamping * 0.05;

            this.yawAngle *= (1 - deltaTime * yawDampingRate);
        }
    }

    // 计算目标配平油门
    calculateTargetThrottle() {
        const currentSpeed = this.simulator.velocity.length() * 3.6;
        const targetSpeed = this.simulator.trimSystem.targetSpeed;

        if (this.simulator.flightMode === 'ground') {
            return 0;
        }

        const speedError = (targetSpeed - currentSpeed) / targetSpeed;
        return Math.max(0, Math.min(1, 0.5 + speedError * 0.5));
    }

    // 获取配平强度
    getTrimStrength(type) {
        const strengthMap = {
            'arcade': 1.0,
            'simulation': 0.6,
            'expert': 0.2
        };

        const setting = type === 'speed' ?
            this.simulator.trimSystem.speedTrimStrength :
            this.simulator.trimSystem.attitudeTrimStrength;

        return strengthMap[setting] || 1.0;
    }

    // 应用物理和升力系统
    applyPhysicsAndTrim(deltaTime) {
        const force = new THREE.Vector3();
        const baseSpeed = 120;

        // 应用旋转到飞机
        this.simulator.airplane.rotation.set(this.pitchAngle, this.yawAngle, this.rollAngle);

        // 计算推力
        let currentSpeed = baseSpeed * this.simulator.throttle;

        // 后燃器增强
        if (this.simulator.afterburnerActive && this.simulator.throttle > 0) {
            currentSpeed *= 5.0;
            this.simulator.airplaneModel.afterburner.material.opacity = Math.min(
                this.simulator.airplaneModel.afterburner.material.opacity + deltaTime * 10, 1
            );
            this.simulator.airplaneModel.afterburner.scale.set(
                1 + this.simulator.rng() * 0.3,
                1 + this.simulator.rng() * 0.3,
                1 + this.simulator.rng() * 0.5
            );
        } else {
            this.simulator.airplaneModel.afterburner.material.opacity = Math.max(
                this.simulator.airplaneModel.afterburner.material.opacity - deltaTime * 5, 0
            );
            this.simulator.airplaneModel.afterburner.scale.set(1, 1, 1);
        }

        // 螺旋桨转速
        this.simulator.airplaneModel.propeller.rotation.x += deltaTime * 30 * this.simulator.throttle;

        // 计算推力方向
        const forwardDirection = new THREE.Vector3(1, 0, 0);
        forwardDirection.applyEuler(new THREE.Euler(this.pitchAngle, this.yawAngle, this.rollAngle, 'XYZ'));

        // 应用推力
        force.add(forwardDirection.clone().multiplyScalar(currentSpeed));

        // 升力系统
        const forwardSpeed = this.simulator.velocity.dot(forwardDirection);
        if (forwardSpeed > 5) {
            const cruiseSpeed = 80;
            const liftCoefficient = Math.min(forwardSpeed / cruiseSpeed, 2.5);
            const baseLiftForce = 15.2;
            const liftMagnitude = baseLiftForce * liftCoefficient;

            let liftDirection;
            if (Math.abs(this.pitchAngle) < 0.2) {
                liftDirection = new THREE.Vector3(0, 1, 0);
            } else {
                liftDirection = new THREE.Vector3(0, 1, 0);
                liftDirection.applyEuler(new THREE.Euler(this.pitchAngle, this.yawAngle, this.rollAngle, 'XYZ'));
            }

            force.add(liftDirection.multiplyScalar(liftMagnitude));
        }

        // 重力
        force.y -= 15;

        // 空气阻力和地面摩擦
        if (this.simulator.flightMode === 'ground') {
            this.applyGroundCarPhysics(deltaTime, force);
        } else {
            const drag = this.simulator.velocity.clone().multiplyScalar(-0.02);
            force.add(drag);
        }

        // 应用力到速度
        this.simulator.velocity.add(force.clone().multiplyScalar(deltaTime));

        // 更新位置
        this.simulator.airplane.position.add(this.simulator.velocity.clone().multiplyScalar(deltaTime));

        // 地面碰撞检测
        if (this.simulator.airplane.position.y < 2) {
            this.simulator.airplane.position.y = 2;
            this.simulator.velocity.y = Math.max(0, this.simulator.velocity.y);
            this.rollAngle *= 0.8;
            this.pitchAngle = Math.max(this.pitchAngle * 0.8, 0);
            this.simulator.velocity.x *= 0.98;
            this.simulator.velocity.z *= 0.85;
        }
    }

    // 应用地面汽车物理
    applyGroundCarPhysics(deltaTime, force) {
        const currentSpeed = this.simulator.velocity.length() * 3.6;

        if (currentSpeed > 1) {
            const forwardDirection = new THREE.Vector3(1, 0, 0);
            forwardDirection.applyEuler(new THREE.Euler(this.pitchAngle, this.yawAngle, this.rollAngle, 'XYZ'));

            const currentSpeedMagnitude = this.simulator.velocity.length();
            const targetVelocity = forwardDirection.clone().multiplyScalar(currentSpeedMagnitude);

            const turnResponsiveness = Math.min(currentSpeed / 20, 8.0);
            this.simulator.velocity.lerp(targetVelocity, deltaTime * turnResponsiveness);
        }

        // 地面阻力
        const groundDrag = this.simulator.velocity.clone().multiplyScalar(-0.8);
        force.add(groundDrag);

        // 侧向摩擦
        const forwardDirection = new THREE.Vector3(1, 0, 0);
        forwardDirection.applyEuler(new THREE.Euler(this.pitchAngle, this.yawAngle, this.rollAngle, 'XYZ'));

        const rightDirection = new THREE.Vector3(0, 0, -1);
        rightDirection.applyEuler(new THREE.Euler(this.pitchAngle, this.yawAngle, this.rollAngle, 'XYZ'));

        const lateralVelocity = this.simulator.velocity.dot(rightDirection);
        const lateralFriction = rightDirection.clone().multiplyScalar(-lateralVelocity * 20);
        force.add(lateralFriction);
    }

    updateControlSurfaces() {
        // 更新方向舵视觉效果
        if (this.simulator.airplaneModel.rudderGroup) {
            let rudderDeflection = 0;

            if (this.simulator.controlsManager.controls.KeyA) {
                rudderDeflection = this.simulator.flightMode === 'ground' ? Math.PI / 6 : Math.PI / 8;
            }
            if (this.simulator.controlsManager.controls.KeyD) {
                rudderDeflection = this.simulator.flightMode === 'ground' ? -Math.PI / 6 : -Math.PI / 8;
            }

            if (this.simulator.coordinatedTurnActive) {
                if (this.simulator.controlsManager.controls.ArrowLeft) {
                    rudderDeflection += this.simulator.flightMode === 'ground' ? Math.PI / 8 : Math.PI / 12;
                }
                if (this.simulator.controlsManager.controls.ArrowRight) {
                    rudderDeflection -= this.simulator.flightMode === 'ground' ? Math.PI / 8 : Math.PI / 12;
                }
            }

            this.simulator.airplaneModel.rudderGroup.rotation.y = rudderDeflection;
        }

        // 更新机翼视觉效果
        if (this.simulator.airplaneModel.wingGroup) {
            let aileronDeflection = 0;

            if (this.simulator.coordinatedTurnActive && this.simulator.flightMode === 'air') {
                aileronDeflection = -this.rollAngle * 0.3;
            } else if (this.simulator.controlsManager.controls.ArrowLeft || this.simulator.controlsManager.controls.ArrowRight) {
                if (this.simulator.controlsManager.controls.ArrowLeft) aileronDeflection = Math.PI / 12;
                if (this.simulator.controlsManager.controls.ArrowRight) aileronDeflection = -Math.PI / 12;
            }

            this.simulator.airplaneModel.wingGroup.rotation.x = aileronDeflection;
        }

        // 更新升降舵视觉效果
        if (this.simulator.airplaneModel.rudderGroup?.parent) {
            const elevatorDeflection = this.pitchAngle * 0.2;
            this.simulator.airplaneModel.rudderGroup.rotation.x = elevatorDeflection;
        }
    }

    // 计算G力
    calculateGForce() {
        return calculateGForce(this.simulator.velocity, this.previousVelocity);
    }

    // 获取当前姿态角度
    getAttitude() {
        return {
            pitch: this.pitchAngle,
            yaw: this.yawAngle,
            roll: this.rollAngle
        };
    }
}
