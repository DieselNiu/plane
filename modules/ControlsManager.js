// 输入控制管理模块

export class ControlsManager {
    constructor(simulator) {
        this.simulator = simulator;
        this.controls = {};

        // 移动端控制器状态
        this.mobileControls = {
            leftJoystick: { x: 0, y: 0, active: false },
            rightJoystick: { x: 0, y: 0, active: false },
            directionalControls: {
                up: false,
                down: false,
                left: false,
                right: false
            }
        };

        this.setupControls();
    }

    setupControls() {
        document.addEventListener('keydown', (event) => {
            this.controls[event.code] = true;
        });

        document.addEventListener('keyup', (event) => {
            this.controls[event.code] = false;
        });

        // 设置移动端触摸控制器
        this.setupMobileControls();
    }

    setupMobileControls() {
        const leftJoystick = document.getElementById('leftJoystick');
        const leftKnob = document.getElementById('leftKnob');

        if (!leftJoystick) return;

        // 设置四方向推杆控制
        this.setupDirectionalControls();

        // 处理触摸事件的通用函数（仅用于油门推杆）
        const handleTouch = (joystick, knob, controlKey, event) => {
            event.preventDefault();

            const rect = joystick.getBoundingClientRect();
            const touch = event.touches ? event.touches[0] : event;
            if (event.type.includes('end') || event.type.includes('cancel')) {
                // 释放控制器
                this.mobileControls[controlKey] = { x: 0, y: 0, active: false };

                // 根据控制器类型重置位置
                if (controlKey === 'leftJoystick') {
                    // 油门推杆回到中性位置（40px对应0油门）
                    knob.style.bottom = '40px';
                    // 移除激活状态
                    joystick.classList.remove('active');
                } else {
                    // 右摇杆回到中心
                    knob.style.transform = 'translate(-50%, -50%)';
                }
                return;
            }

            if (controlKey === 'leftJoystick') {
                // 油门推杆：只允许垂直移动
                const touchYFromBottom = rect.height - (touch.clientY - rect.top);

                // 限制在推杆范围内（15px到165px）- 扩大向前推的范围
                const clampedY = Math.max(15, Math.min(165, touchYFromBottom));

                // 更新推杆手柄位置
                knob.style.bottom = `${clampedY}px`;

                // 计算油门值，以40px为中性位置（0油门）- 降低中性位置，增加前进范围
                // 底部15px为最大倒车(-1)，中间40px为怠速(0)，顶部165px为最大推力(1)
                let throttleValue;
                if (clampedY <= 40) {
                    // 下半段：从倒车到怠速 (-1 到 0)
                    throttleValue = (clampedY - 15) / 25 - 1;
                } else {
                    // 上半段：从怠速到最大推力 (0 到 1) - 现在有125px的前进范围
                    throttleValue = (clampedY - 40) / 125;
                }

                // 添加激活状态的视觉效果
                joystick.classList.add('active');

                // 更新控制状态
                this.mobileControls[controlKey] = {
                    x: 0, // 油门推杆不支持X轴
                    y: throttleValue,
                    active: true
                };
            } else {
                // 右侧控制器现在由四方向推杆处理，这里不需要处理
                // 四方向推杆的逻辑在 setupDirectionalControls 中处理
            }
        };

        // 左摇杆事件（推力控制：前进/后退，类似W/S键）
        for (const eventType of ['touchstart', 'touchmove', 'mousedown', 'mousemove']) {
            leftJoystick.addEventListener(eventType, (event) => {
                if ((eventType.includes('mouse') && event.buttons === 1) || eventType.includes('touch')) {
                    handleTouch(leftJoystick, leftKnob, 'leftJoystick', event);
                }
            });
        }

        for (const eventType of ['touchend', 'touchcancel', 'mouseup', 'mouseleave']) {
            leftJoystick.addEventListener(eventType, (event) => {
                handleTouch(leftJoystick, leftKnob, 'leftJoystick', event);
            });
        }

        // 右侧控制器现在由四方向推杆处理，不需要这里的事件监听器

        // 禁用移动端滚动和缩放
        document.addEventListener('touchmove', (event) => {
            if (event.target.closest('.joystick')) {
                event.preventDefault();
            }
        }, { passive: false });

        document.addEventListener('gesturestart', (event) => {
            event.preventDefault();
        });

        document.addEventListener('gesturechange', (event) => {
            event.preventDefault();
        });

        document.addEventListener('gestureend', (event) => {
            event.preventDefault();
        });
    }

    // 设置四方向推杆控制
    setupDirectionalControls() {
        const leverUp = document.getElementById('leverUp');
        const leverDown = document.getElementById('leverDown');
        const leverLeft = document.getElementById('leverLeft');
        const leverRight = document.getElementById('leverRight');

        if (!leverUp || !leverDown || !leverLeft || !leverRight) return;

        // 处理推杆按下事件
        const handleLeverPress = (direction, event) => {
            event.preventDefault();

            // 设置对应方向的控制状态
            switch (direction) {
                case 'up':
                    this.mobileControls.rightJoystick = { x: 0, y: 1, active: true };
                    console.log('推杆控制: 上推杆按下');
                    break;
                case 'down':
                    this.mobileControls.rightJoystick = { x: 0, y: -1, active: true };
                    console.log('推杆控制: 下推杆按下');
                    break;
                case 'left':
                    this.mobileControls.rightJoystick = { x: -1, y: 0, active: true };
                    console.log('推杆控制: 左推杆按下');
                    break;
                case 'right':
                    this.mobileControls.rightJoystick = { x: 1, y: 0, active: true };
                    console.log('推杆控制: 右推杆按下');
                    break;
            }
        };

        // 处理推杆释放事件
        const handleLeverRelease = (event) => {
            event.preventDefault();
            this.mobileControls.rightJoystick = { x: 0, y: 0, active: false };
            console.log('推杆控制: 推杆释放');
        };

        // 为每个推杆添加事件监听器
        const levers = [
            { element: leverUp, direction: 'up' },
            { element: leverDown, direction: 'down' },
            { element: leverLeft, direction: 'left' },
            { element: leverRight, direction: 'right' }
        ];

        levers.forEach(({ element, direction }) => {
            // 按下事件
            for (const eventType of ['touchstart', 'mousedown']) {
                element.addEventListener(eventType, (event) => {
                    handleLeverPress(direction, event);
                });
            }

            // 释放事件
            for (const eventType of ['touchend', 'touchcancel', 'mouseup', 'mouseleave']) {
                element.addEventListener(eventType, handleLeverRelease);
            }
        });

        // 防止推杆区域的滚动
        document.addEventListener('touchmove', (event) => {
            if (event.target.closest('.directional-controls')) {
                event.preventDefault();
            }
        }, { passive: false });
    }

    // 更新精确控制指示器
    updatePrecisionControlIndicator() {
        const precisionElement = document.getElementById('precisionMode');
        if (precisionElement) {
            const arrowKeysActive = this.controls.ArrowLeft || this.controls.ArrowRight ||
                                   this.controls.ArrowUp || this.controls.ArrowDown;

            if (arrowKeysActive) {
                if (this.controls.ArrowLeft || this.controls.ArrowRight) {
                    // 左右箭头现在是简单roll控制（仅空中）
                    precisionElement.textContent = '方向键: Roll翻滚控制 (仅空中)';
                    precisionElement.style.color = '#FF9800';
                } else {
                    // 上下箭头是俯仰控制
                    precisionElement.textContent = '方向键: 俯仰控制';
                    precisionElement.style.color = '#3F51B5';
                }
            } else if (this.controls.KeyA || this.controls.KeyD) {
                // A/D键是纯YAW控制
                precisionElement.textContent = 'A/D键: 纯YAW转向';
                precisionElement.style.color = '#9C27B0';
            } else {
                precisionElement.textContent = '';
            }
        }
    }

    // 检查是否有控制输入
    hasInput() {
        // 检查键盘输入
        const keyboardActive = Object.values(this.controls).some(pressed => pressed);

        // 检查移动端输入
        const mobileActive = this.mobileControls.leftJoystick.active ||
                           this.mobileControls.rightJoystick.active;

        return keyboardActive || mobileActive;
    }

    // 获取当前控制状态
    getControlState() {
        return {
            keyboard: this.controls,
            mobile: this.mobileControls
        };
    }

    // 重置所有控制状态
    resetControls() {
        this.controls = {};
        this.mobileControls = {
            leftJoystick: { x: 0, y: 0, active: false },
            rightJoystick: { x: 0, y: 0, active: false }
        };
    }
}
