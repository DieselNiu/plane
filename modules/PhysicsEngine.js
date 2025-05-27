// 物理引擎和飞行控制模块

import { clamp, calculateGForce } from '../utils/MathUtils.js';

export class PhysicsEngine {
    constructor(simulator) {
        this.simulator = simulator;
        this.pitchAngle = 0;
        this.yawAngle = 0;
        this.rollAngle = 0;
        this.elevatorDeflection = 0; // 升降舵偏转角度
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
        const controls = this.simulator.controlsManager.controls;

        // 检查起飞条件
        this.checkTakeoffConditions(currentSpeed, controls);

        // 根据2.md文档的模式切换逻辑，但增加起飞条件检查
        this.simulator.previousMode = this.simulator.flightMode;

        if (currentSpeed < 40 && currentAltitude < 3) {
            this.simulator.flightMode = 'ground';
        } else if (currentSpeed >= 40 || currentAltitude >= 3) {
            // 只有满足起飞条件才能切换到空中模式
            if (this.simulator.canTakeoff || currentAltitude >= 3) {
                this.simulator.flightMode = 'air';
            } else {
                // 不满足起飞条件，保持地面模式
                this.simulator.flightMode = 'ground';
            }
        }

        // 平滑过渡处理
        if (this.simulator.previousMode !== this.simulator.flightMode) {
            this.simulator.modeTransitionSmoothing = 0; // 开始新的过渡
        } else {
            this.simulator.modeTransitionSmoothing = Math.min(this.simulator.modeTransitionSmoothing + deltaTime * 2, 1.0);
        }
    }

    // 检查起飞条件
    checkTakeoffConditions(currentSpeed, controls) {
        // 起飞条件：速度达到300km/h 且 用户按住向下箭头键
        const speedCondition = currentSpeed >= this.simulator.takeoffSpeed;
        const controlCondition = controls.ArrowDown;

        // 只有在地面模式下才检查起飞条件
        if (this.simulator.flightMode === 'ground') {
            this.simulator.canTakeoff = speedCondition && controlCondition;
        } else {
            // 一旦起飞，保持可起飞状态直到重新着陆
            this.simulator.canTakeoff = true;
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

        // W/S键控制 - 降低加速度让控制更平滑
        if (controls.KeyW) {
            // 地面模式下加速更慢，避免过快达到高速
            const accelerationRate = this.simulator.flightMode === 'ground' ? 0.6 : 1.0;
            this.simulator.throttle = Math.min(this.simulator.throttle + deltaTime * accelerationRate, 1.0);
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

        // 降低最小转向速度阈值，让低速时也能转向
        if (currentSpeed < 2) {
            return 0;
        }

        const minSpeed = 2;
        const maxSpeed = 80;
        const speedFactor = Math.min((currentSpeed - minSpeed) / (maxSpeed - minSpeed), 1.0);

        // 提高基础转向速率，让转向更加敏感
        const baseYawRate = 4.0; // 从2.5提高到4.0

        // 确保即使在低速时也有足够的转向能力
        const minYawRate = 1.5;
        const effectiveYawRate = Math.max(baseYawRate * speedFactor, minYawRate);

        return turnInput * deltaTime * effectiveYawRate;
    }

    // 计算空中模式的偏航速率
    calculateAirYawRate(turnInput, deltaTime) {
        const currentSpeed = this.simulator.velocity.length() * 3.6;
        const altitude = this.simulator.airplane.position.y;

        // 空气密度因子
        const densityFactor = Math.max(0.3, Math.exp(-altitude / 1000));

        // 速度因子 - 调整为更敏感的转向
        const minEffectiveSpeed = 40;
        const optimalSpeed = 150;
        const maxSpeed = 400;

        let speedFactor;
        if (currentSpeed < minEffectiveSpeed) {
            speedFactor = (currentSpeed / minEffectiveSpeed) * 0.5; // 提高低速转向能力
        } else if (currentSpeed <= optimalSpeed) {
            speedFactor = 0.5 + (currentSpeed - minEffectiveSpeed) / (optimalSpeed - minEffectiveSpeed) * 0.5;
        } else if (currentSpeed <= maxSpeed) {
            speedFactor = 1.0;
        } else {
            speedFactor = Math.max(0.8, 1.0 - (currentSpeed - maxSpeed) / 200 * 0.2); // 高速时保持更好的转向
        }

        // 飞行姿态影响 - 减少姿态对转向的负面影响
        const rollEffect = Math.max(0.7, Math.cos(this.rollAngle)); // 最小保持70%效果
        const pitchEffect = Math.max(0.8, Math.cos(this.pitchAngle)); // 最小保持80%效果

        // 大幅提高基础转向速率，缩小转向半径
        const baseYawRate = 2.5; // 从0.8提高到2.5

        return turnInput * deltaTime * baseYawRate * speedFactor * densityFactor * rollEffect * pitchEffect;
    }

    // 应用升降舵效果
    applyElevatorEffect(deltaTime) {
        const currentSpeed = this.simulator.velocity.length() * 3.6;

        if (this.simulator.flightMode === 'ground') {
            // 地面模式：升降舵偏转只在有足够速度时才产生俯仰力矩
            if (currentSpeed > 20) {
                // 速度越高，升降舵效果越明显
                const speedFactor = Math.min(currentSpeed / 80, 1.0);
                // 修正俯仰力矩方向：升降舵向下偏转（负值）产生向上俯仰力矩（正值）
                const pitchMoment = -this.elevatorDeflection * speedFactor * deltaTime * 2.0;
                this.pitchAngle += pitchMoment;

                // 地面模式下的俯仰角度限制
                // 如果不满足起飞条件，严格限制向上俯仰
                if (!this.simulator.canTakeoff) {
                    // 不允许起飞时，限制向上俯仰角度更严格
                    this.pitchAngle = Math.max(-Math.PI / 6, Math.min(Math.PI / 12, this.pitchAngle));
                } else {
                    // 满足起飞条件时，允许更大的俯仰角度
                    this.pitchAngle = Math.max(-Math.PI / 6, Math.min(Math.PI / 6, this.pitchAngle));
                }
            }
        } else {
            // 空中模式：升降舵直接影响俯仰角度
            const airspeedFactor = Math.min(currentSpeed / 100, 1.5);
            // 修正俯仰力矩方向：升降舵向下偏转（负值）产生向上俯仰力矩（正值）
            const pitchMoment = -this.elevatorDeflection * airspeedFactor * deltaTime * 3.0;
            this.pitchAngle += pitchMoment;

            // 限制俯仰角度
            this.pitchAngle = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, this.pitchAngle));
        }
    }

    // 精确控制处理
    processPrecisionControls(deltaTime, leftJoy) {
        const controls = this.simulator.controlsManager.controls;
        const controlSpeed = 1.8;

        // 上/下箭头控制升降舵偏转角度（修正控制方向）
        if (controls.ArrowUp) {
            // 上箭头（推杆）：升降舵向上偏转，飞机俯冲
            this.elevatorDeflection = Math.min(this.elevatorDeflection + deltaTime * controlSpeed, Math.PI / 6);
        } else if (controls.ArrowDown) {
            // 下箭头（拉杆）：升降舵向下偏转，飞机抬升
            this.elevatorDeflection = Math.max(this.elevatorDeflection - deltaTime * controlSpeed, -Math.PI / 6);
        } else {
            // 没有输入时，升降舵回中
            this.elevatorDeflection *= (1 - deltaTime * 3.0);
        }

        // 移动端左摇杆Y轴控制升降舵偏转
        if (leftJoy.active && Math.abs(leftJoy.y) > 0.1) {
            // 摇杆向上推（负值）= 升降舵向上偏转，飞机俯冲
            // 摇杆向下拉（正值）= 升降舵向下偏转，飞机抬升
            this.elevatorDeflection = -leftJoy.y * Math.PI / 6;
        }

        // 根据升降舵偏转和飞行状态计算俯仰力矩
        this.applyElevatorEffect(deltaTime);

        // 左/右箭头控制简单直接的Roll操作（仅在空中生效）
        if (this.simulator.flightMode === 'air') {
            const rollInput = this.getRollInput(controls, leftJoy);
            this.processRollControl(rollInput, deltaTime);
        } else {
            // 地面模式：左右箭头控制地面转向
            let groundTurnInput = 0;
            if (controls.ArrowLeft) {
                groundTurnInput = 1;
            }
            if (controls.ArrowRight) {
                groundTurnInput = -1;
            }
            
            // 移动端左摇杆X轴控制地面转向
            if (leftJoy.active && Math.abs(leftJoy.x) > 0.1) {
                groundTurnInput = -leftJoy.x;
            }
            
            if (Math.abs(groundTurnInput) > 0.1) {
                const groundYawRate = this.calculateGroundYawRate(groundTurnInput, deltaTime);
                this.yawAngle += groundYawRate;
            }
            
            // 地面模式强制roll角度为0（立即重置，不使用插值）
            this.rollAngle = 0;
        }
    }

    // 获取roll输入值
    getRollInput(controls, leftJoy) {
        let rollInput = 0;
        
        // 键盘输入（修正方向）
        if (controls.ArrowLeft) {
            rollInput = -1; // 向左翻滚为负值（向左倾斜）
        }
        if (controls.ArrowRight) {
            rollInput = 1; // 向右翻滚为正值（向右倾斜）
        }
        
        // 移动端摇杆输入
        if (leftJoy.active && Math.abs(leftJoy.x) > 0.1) {
            rollInput = leftJoy.x; // 摇杆向左为负值，向右为正值
        }
        
        return rollInput;
    }

    // 处理真实的飞行转弯控制
    processRollControl(rollInput, deltaTime) {
        if (Math.abs(rollInput) > 0.1) {
            // 有输入时：执行转弯操作
            const maxRollAngle = 45 * Math.PI / 180; // 最大45度翻滚
            const rollSpeed = 120 * Math.PI / 180; // 120度/秒的翻滚速度
            
            // 计算目标roll角度
            const targetRollAngle = rollInput * maxRollAngle;
            
            // 平滑过渡到目标角度
            const rollRate = rollSpeed * deltaTime;
            
            if (Math.abs(this.rollAngle - targetRollAngle) > rollRate) {
                // 如果距离目标角度较远，以恒定速度移动
                const direction = targetRollAngle > this.rollAngle ? 1 : -1;
                this.rollAngle += direction * rollRate;
            } else {
                // 接近目标时直接设置
                this.rollAngle = targetRollAngle;
            }
            
            // === 真实转弯物理：Roll + Yaw组合 ===
            this.executeBankingTurn(rollInput, deltaTime);
            
        } else {
            // 无输入时：让机翼保持倾斜，仅施加轻微阻尼而非强制回中
            // 模拟真实飞机的滚转惯性：机翼会慢慢回正，而不是瞬间复原

            const dampingFactor = 0.15; // 每秒 15% 的滚转衰减
            const decay = 1 - dampingFactor * deltaTime;
            this.rollAngle *= decay;
        }
        
        // 限制roll角度范围
        const maxAbsoluteRoll = 60 * Math.PI / 180; // 绝对最大60度
        this.rollAngle = Math.max(-maxAbsoluteRoll, Math.min(maxAbsoluteRoll, this.rollAngle));
    }

    // 执行银行转弯（Banking Turn）- 真实的飞行转弯
    executeBankingTurn(rollInput, deltaTime) {
        const currentSpeed = this.simulator.velocity.length() * 3.6; // km/h
        
        if (currentSpeed < 20) return; // 速度太低时不产生转弯效果
        
        // === 增强的真实飞行转弯机制 ===
        // 主要：Roll倾斜产生向心力和升力分量，使飞机实际转向
        // 增强：更多Yaw协调转弯，实现更自然的空中转向
        
        const rollAngleAbs = Math.abs(this.rollAngle);
        const rollDirection = Math.sign(this.rollAngle);
        
        // 1. 通过roll倾斜产生实际的转向力（主要机制）
        // 这是通过修改升力方向和速度方向来实现的，在applyAirPhysics中处理
        
        // 2. 增强的yaw协调转弯（主要改进点）
        if (rollAngleAbs > 2 * Math.PI / 180) { // 降低yaw启动阈值，让转向更早开始
            // 进一步提高到120%，增强yaw
            const baseYawFactor = 1.2; // 进一步提高到120%，增强yaw
            const speedYawBonus = Math.min(currentSpeed / 150, 1.2); // 速度越快，yaw效果越强
            // 根据俯仰角动态衰减 yaw 协调量：俯仰越大(机头越朝上/下)，垂直向量越偏离世界竖直，yaw 效果应减弱
            const pitchAttenuation = Math.max(0.2, Math.cos(this.pitchAngle)); // 保留 20% 最低效果，避免完全失效
            const yawAssistFactor = baseYawFactor * speedYawBonus * pitchAttenuation;
            
            const maxYawAssist = 15 * Math.PI / 180; // 最大每秒15度的yaw辅助
            
            const yawAssist = rollAngleAbs * yawAssistFactor * (currentSpeed / 60);
            const effectiveYawAssist = Math.min(yawAssist, maxYawAssist);
            
            // 应用增强的yaw辅助（同方向：向左roll配合向左yaw）
            this.yawAngle += -rollDirection * effectiveYawAssist * deltaTime;
        }
        
        // 3. 智能俯仰补偿（防止转弯时高度损失，但避免过度抬升）
        if (rollAngleAbs > 5 * Math.PI / 180) { // 降低补偿启动阈值
            const pitchCompensation = rollAngleAbs * 0.25; // 稍微增加补偿强度
            const maxCompensation = 6 * Math.PI / 180; // 从5度提高到6度补偿
            const effectiveCompensation = Math.min(pitchCompensation, maxCompensation);
            
            // 根据当前俯仰角度调整补偿强度，避免过度抬升
            const currentPitchFactor = Math.max(0.3, 1.0 - Math.abs(this.pitchAngle) / (Math.PI / 6));
            const adjustedCompensation = effectiveCompensation * currentPitchFactor;
            
            // 轻微上升俯仰
            const currentPitchCompensation = adjustedCompensation * deltaTime * 1.8;
            this.pitchAngle += currentPitchCompensation;
        }
        
        // 4. 限制俯仰角度
        this.pitchAngle = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, this.pitchAngle));
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

        // Roll控制现在在processRollControl方法中处理，这里不需要额外的回中逻辑

        // 俯仰稳定（但在执行转弯时减少干扰）
        const isRolling = this.simulator.controlsManager.controls.ArrowLeft || 
                         this.simulator.controlsManager.controls.ArrowRight ||
                         (this.simulator.controlsManager.mobileControls.leftJoystick.active && 
                          Math.abs(this.simulator.controlsManager.mobileControls.leftJoystick.x) > 0.1);
                          
        if (!this.simulator.controlsManager.controls.ArrowUp &&
            !this.simulator.controlsManager.controls.ArrowDown &&
            !this.simulator.controlsManager.mobileControls.leftJoystick.active &&
            !isRolling) { // 转弯时不进行俯仰稳定

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
            !this.simulator.controlsManager.mobileControls.rightJoystick.active) {

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

        // 应用旋转到飞机（修正轴向映射）
        // 根据THREE.js坐标系和飞机模型朝向，重新映射轴向：
        // X轴：翻滚（roll）- 左右箭头控制副翼，使飞机左右倾斜
        // Y轴：偏航（yaw）- A/D键控制垂直尾翼，使飞机机头左右
        // Z轴：俯仰（pitch）- 上下键控制水平尾翼，使飞机机头上下
        
        // 地面模式：禁用roll，只允许yaw和pitch
        if (this.simulator.flightMode === 'ground') {
            this.simulator.airplane.rotation.set(0, this.yawAngle, this.pitchAngle);
        } else {
            // 空中模式：允许所有轴向旋转
            this.simulator.airplane.rotation.set(this.rollAngle, this.yawAngle, this.pitchAngle);
        }

        // 计算推力 - 增加推力以支持更高速度，但保持平缓加速
        let thrustForce = baseSpeed * this.simulator.throttle * 2.5; // 增加推力倍数以支持更高速度

        // 后燃器增强
        if (this.simulator.afterburnerActive && this.simulator.throttle > 0) {
            thrustForce *= 1.8; // 进一步降低后燃器倍数
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

        // 螺旋桨转速 - 考虑配平系统和飞行模式
        let effectiveThrottle = this.simulator.throttle;

        // 在空中模式时，即使用户没有操作，配平系统也会维持基础推力
        if (this.simulator.flightMode === 'air') {
            // 空中最小转速对应的油门值（维持飞行状态的基础推力）
            const minAirThrottle = 0.3;
            effectiveThrottle = Math.max(this.simulator.throttle, minAirThrottle);
        }

        this.simulator.airplaneModel.propeller.rotation.x += deltaTime * 30 * effectiveThrottle;

        // 计算推力方向（修正轴向映射）
        const forwardDirection = new THREE.Vector3(1, 0, 0);
        // 地面模式：不应用roll角度到推力方向
        if (this.simulator.flightMode === 'ground') {
            forwardDirection.applyEuler(new THREE.Euler(0, this.yawAngle, this.pitchAngle, 'XYZ'));
        } else {
            forwardDirection.applyEuler(new THREE.Euler(this.rollAngle, this.yawAngle, this.pitchAngle, 'XYZ'));
        }

        // 应用推力
        force.add(forwardDirection.clone().multiplyScalar(thrustForce));

        // 升力系统 - 只有满足起飞条件或已在空中才产生升力
        const forwardSpeed = this.simulator.velocity.dot(forwardDirection);
        if (forwardSpeed > 5) {
            // 检查是否允许产生升力
            const canGenerateLift = this.simulator.flightMode === 'air' || this.simulator.canTakeoff;

            if (canGenerateLift) {
                const cruiseSpeed = 80;
                const liftCoefficient = Math.min(forwardSpeed / cruiseSpeed, 2.5);
                const baseLiftForce = 15.2;
                const liftMagnitude = baseLiftForce * liftCoefficient;

                let liftDirection;
                if (Math.abs(this.pitchAngle) < 0.2) {
                    liftDirection = new THREE.Vector3(0, 1, 0);
                } else {
                    liftDirection = new THREE.Vector3(0, 1, 0);
                    // 地面模式：升力方向不受roll角度影响
                    if (this.simulator.flightMode === 'ground') {
                        liftDirection.applyEuler(new THREE.Euler(0, this.yawAngle, this.pitchAngle, 'XYZ'));
                    } else {
                        liftDirection.applyEuler(new THREE.Euler(this.rollAngle, this.yawAngle, this.pitchAngle, 'XYZ'));
                    }
                }

                force.add(liftDirection.multiplyScalar(liftMagnitude));
            }
        }

        // 重力
        force.y -= 15;

        // 空气阻力和地面摩擦
        if (this.simulator.flightMode === 'ground') {
            this.applyGroundCarPhysics(deltaTime, force);
        } else {
            this.applyAirPhysics(deltaTime, force);
        }

        // 应用力到速度
        this.simulator.velocity.add(force.clone().multiplyScalar(deltaTime));

        // 应用速度限制
        this.applySpeedLimit();

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

        if (currentSpeed > 0.5) {
            const forwardDirection = new THREE.Vector3(1, 0, 0);
            // 地面模式：前进方向不受roll角度影响
            forwardDirection.applyEuler(new THREE.Euler(0, this.yawAngle, this.pitchAngle, 'XYZ'));

            const currentSpeedMagnitude = this.simulator.velocity.length();
            const targetVelocity = forwardDirection.clone().multiplyScalar(currentSpeedMagnitude);

            // 检查是否有转向输入
            const controls = this.simulator.controlsManager.controls;
            const rightJoy = this.simulator.controlsManager.mobileControls.rightJoystick;
            const hasTurnInput = controls.KeyA || controls.KeyD ||
                               (rightJoy.active && Math.abs(rightJoy.x) > 0.1);

            if (hasTurnInput) {
                // 检查是否是W+A或W+D的组合输入（前进+转向）
                const hasForwardInput = controls.KeyW || (rightJoy.active && rightJoy.y > 0.1);

                if (hasForwardInput) {
                    // W+A/D组合：直接强制速度方向对齐机头方向，消除侧滑
                    // 保持速度大小，但立即改变方向
                    this.simulator.velocity.copy(targetVelocity);
                } else {
                    // 只有转向输入：使用高响应性插值
                    const turnResponsiveness = 35.0;
                    this.simulator.velocity.lerp(targetVelocity, deltaTime * turnResponsiveness);
                }
            } else {
                // 没有转向输入时，使用较低的响应性保持稳定
                const turnResponsiveness = Math.min(currentSpeed / 8, 8.0);
                const finalResponsiveness = Math.max(turnResponsiveness, 3.0);
                this.simulator.velocity.lerp(targetVelocity, deltaTime * finalResponsiveness);
            }
        }

        // 地面阻力 - 调整为支持更高速度但保持平缓加速
        const currentSpeedMs = this.simulator.velocity.length();
        const currentSpeedKmh = currentSpeedMs * 3.6;

        // 分段阻力系统：低速时较高阻力，高速时较低阻力
        let dragCoefficient;
        if (currentSpeedKmh < 100) {
            // 低速段：较高阻力，让加速平缓
            dragCoefficient = 0.4 + currentSpeedMs * 0.015;
        } else if (currentSpeedKmh < 300) {
            // 中速段：中等阻力
            dragCoefficient = 0.3 + currentSpeedMs * 0.008;
        } else {
            // 高速段：较低阻力，允许达到更高速度
            dragCoefficient = 0.2 + currentSpeedMs * 0.005;
        }

        const groundDrag = this.simulator.velocity.clone().multiplyScalar(-dragCoefficient);
        force.add(groundDrag);

        // 强化侧向摩擦力，彻底消除任何残余侧滑
        const forwardDirection = new THREE.Vector3(1, 0, 0);
        // 地面模式：摩擦力方向不受roll角度影响
        forwardDirection.applyEuler(new THREE.Euler(0, this.yawAngle, this.pitchAngle, 'XYZ'));

        const rightDirection = new THREE.Vector3(0, 0, -1);
        rightDirection.applyEuler(new THREE.Euler(0, this.yawAngle, this.pitchAngle, 'XYZ'));

        const lateralVelocity = this.simulator.velocity.dot(rightDirection);
        // 极强的侧向摩擦力，确保没有侧滑
        const lateralFriction = rightDirection.clone().multiplyScalar(-lateralVelocity * 80);
        force.add(lateralFriction);
    }

    // 应用空中物理
    applyAirPhysics(deltaTime, force) {
        const currentSpeed = this.simulator.velocity.length() * 3.6;

        // 基础空气阻力
        const drag = this.simulator.velocity.clone().multiplyScalar(-0.02);
        force.add(drag);

        // === Roll转弯的主要物理机制 ===
        // 当飞机roll倾斜时，升力分量会产生向心力，使飞机转向
        if (Math.abs(this.rollAngle) > 2 * Math.PI / 180 && currentSpeed > 20) {
            // 计算飞机的方向向量
            const forwardDirection = new THREE.Vector3(1, 0, 0);
            const upDirection = new THREE.Vector3(0, 1, 0);
            const rightDirection = new THREE.Vector3(0, 0, -1);
            
            // 应用飞机当前姿态
            forwardDirection.applyEuler(new THREE.Euler(this.rollAngle, this.yawAngle, this.pitchAngle, 'XYZ'));
            upDirection.applyEuler(new THREE.Euler(this.rollAngle, this.yawAngle, this.pitchAngle, 'XYZ'));
            rightDirection.applyEuler(new THREE.Euler(this.rollAngle, this.yawAngle, this.pitchAngle, 'XYZ'));

            // 计算倾斜产生的向心力
            const rollAngleAbs = Math.abs(this.rollAngle);
            const rollDirection = Math.sign(this.rollAngle);
            
            // 向心力也随着俯仰角度进行衰减，避免俯仰较大时出现奇怪的水平漂移
            const centripitalForceStrength = rollAngleAbs * (currentSpeed / 50) * 12.0 * Math.max(0.2, Math.cos(this.pitchAngle)); // 增强向心力并考虑俯仰
            const maxCentripidalForce = 40.0; // 提高最大向心力
            const effectiveForce = Math.min(centripitalForceStrength, maxCentripidalForce);
            
            // 应用向心力（向roll方向）
            const centripetalForce = rightDirection.clone().multiplyScalar(rollDirection * effectiveForce);
            force.add(centripetalForce);
            
            // 同时修正速度方向，让飞机朝新的前进方向飞行
            const currentSpeedMagnitude = this.simulator.velocity.length();
            const targetVelocity = forwardDirection.clone().multiplyScalar(currentSpeedMagnitude);
            
            // 转向时的速度方向修正强度
            const turnCorrectionStrength = rollAngleAbs * 3.0 + 2.0;
            this.simulator.velocity.lerp(targetVelocity, deltaTime * turnCorrectionStrength);
        }

        // 检查是否有A/D转向输入（方向舵控制）
        const controls = this.simulator.controlsManager.controls;
        const rightJoy = this.simulator.controlsManager.mobileControls.rightJoystick;
        const hasYawInput = controls.KeyA || controls.KeyD ||
                           (rightJoy.active && Math.abs(rightJoy.x) > 0.1);

        if (hasYawInput && currentSpeed > 10) {
            // 计算飞机当前的前进方向
            const forwardDirection = new THREE.Vector3(1, 0, 0);
            forwardDirection.applyEuler(new THREE.Euler(this.rollAngle, this.yawAngle, this.pitchAngle, 'XYZ'));

            const currentSpeedMagnitude = this.simulator.velocity.length();
            const targetVelocity = forwardDirection.clone().multiplyScalar(currentSpeedMagnitude);

            // 增强A/D键的yaw控制（方向舵）- 配合roll转向使用
            let correctionStrength;
            if (currentSpeed < 50) {
                correctionStrength = 12.0; // 提高低速响应
            } else if (currentSpeed < 150) {
                correctionStrength = 8.0;  // 提高中速响应
            } else {
                correctionStrength = 5.0;  // 提高高速响应
            }

            this.simulator.velocity.lerp(targetVelocity, deltaTime * correctionStrength);
        }

        // 空中侧向阻力（防止侧滑，但不干扰roll转弯）
        if (currentSpeed > 5) {
            const forwardDirection = new THREE.Vector3(1, 0, 0);
            forwardDirection.applyEuler(new THREE.Euler(this.rollAngle, this.yawAngle, this.pitchAngle, 'XYZ'));

            const rightDirection = new THREE.Vector3(0, 0, -1);
            rightDirection.applyEuler(new THREE.Euler(this.rollAngle, this.yawAngle, this.pitchAngle, 'XYZ'));

            // 计算侧向速度分量
            const lateralVelocity = this.simulator.velocity.dot(rightDirection);

            // 减少侧向阻力强度，避免干扰roll转弯
            const isRolling = Math.abs(this.rollAngle) > 5 * Math.PI / 180;
            const lateralDragStrength = isRolling ? 
                Math.min(currentSpeed / 100, 0.5) * 8 :  // roll时减少侧向阻力
                Math.min(currentSpeed / 50, 1.0) * 15;   // 正常飞行时正常侧向阻力
                
            const lateralDrag = rightDirection.clone().multiplyScalar(-lateralVelocity * lateralDragStrength);
            force.add(lateralDrag);
        }
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

            // 只有在空中模式时才显示副翼偏转
            if (this.simulator.flightMode === 'air') {
                if (this.simulator.controlsManager.controls.ArrowLeft || this.simulator.controlsManager.controls.ArrowRight) {
                    // 修正副翼偏转方向：左转时左副翼上偏，右副翼下偏
                    if (this.simulator.controlsManager.controls.ArrowLeft) aileronDeflection = -Math.PI / 12;
                    if (this.simulator.controlsManager.controls.ArrowRight) aileronDeflection = Math.PI / 12;
                }
            }

            this.simulator.airplaneModel.wingGroup.rotation.x = aileronDeflection;
        }

        // 更新升降舵视觉效果（控制水平尾翼的偏转）
        if (this.simulator.airplaneModel.elevatorGroup) {
            // 使用实际的升降舵偏转角度控制水平尾翼
            // Z轴旋转控制水平尾翼的上下偏转
            this.simulator.airplaneModel.elevatorGroup.rotation.z = this.elevatorDeflection;
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

    // 应用速度限制
    applySpeedLimit() {
        const currentSpeed = this.simulator.velocity.length() * 3.6; // km/h
        const maxSpeedMs = this.simulator.maxSpeed / 3.6; // 转换为 m/s

        // 如果超过最高速度限制，限制速度
        if (currentSpeed > this.simulator.maxSpeed) {
            // 保持方向，但限制速度大小
            this.simulator.velocity.normalize().multiplyScalar(maxSpeedMs);
        }
    }
}
