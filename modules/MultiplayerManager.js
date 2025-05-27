// 多人游戏管理模块

export class MultiplayerManager {
    constructor(simulator) {
        this.simulator = simulator;
        this.otherPlayers = new Map();
        this.peer = null;
        this.connections = new Map();
        this.globalRoomId = 'flight-simulator-global-room';
        this.isHost = false;
        
        this.initMultiplayer();
    }
    
    initMultiplayer() {
        // 自动初始化P2P连接，所有用户进入同一个全局房间
        this.peer = new Peer();
        
        this.peer.on('open', (id) => {
            console.log('我的PeerJS ID:', id);
            this.simulator.uiController.updateConnectionStatus('正在加入全局房间...');
            this.setupPeerListeners();
            // 延迟一下尝试连接到全局房间，给其他用户时间初始化
            setTimeout(() => this.tryConnectToGlobalRoom(), 1000);
        });
        
        this.peer.on('error', (error) => {
            console.log('PeerJS连接错误:', error);
            this.simulator.uiController.showError('网络连接失败');
        });
    }
    
    tryConnectToGlobalRoom() {
        // 尝试连接到全局房间ID
        const conn = this.peer.connect(this.globalRoomId);
        
        conn.on('open', () => {
            console.log('成功连接到全局房间');
            this.simulator.uiController.updateConnectionStatus('已连接到全局房间');
            this.connections.set(this.globalRoomId, conn);
            this.setupConnectionListeners(conn, this.globalRoomId);
        });
        
        conn.on('error', (error) => {
            console.log('连接全局房间失败，可能是第一个进入的用户:', error);
            // 如果连接失败，说明我们是第一个用户，成为房间主机
            this.becomeHost();
        });
    }
    
    becomeHost() {
        // 成为房间主机，等待其他用户连接
        this.isHost = true;
        this.peer.destroy();
        
        // 使用固定的房间ID重新创建peer
        this.peer = new Peer(this.globalRoomId);
        
        this.peer.on('open', (id) => {
            console.log('成为房间主机，房间ID:', id);
            this.simulator.uiController.updateConnectionStatus('房间主机 - 等待其他玩家');
            this.setupPeerListeners();
        });
        
        this.peer.on('error', (error) => {
            console.log('主机创建错误:', error);
            this.simulator.uiController.showError('无法创建房间');
        });
    }
    
    setupPeerListeners() {
        this.peer.on('connection', (conn) => {
            console.log('新玩家加入:', conn.peer);
            this.connections.set(conn.peer, conn);
            this.setupConnectionListeners(conn, conn.peer);
            // 更新连接状态显示
            if (this.isHost) {
                this.simulator.uiController.updateConnectionStatus(`房间主机 - ${this.connections.size + 1}名玩家`);
            }
        });
    }
    
    setupConnectionListeners(conn, peerId) {
        conn.on('data', (data) => {
            if (data.type === 'position') {
                this.updateOtherPlayer(peerId, data);
            }
        });
        
        conn.on('close', () => {
            console.log('玩家离开:', peerId);
            this.connections.delete(peerId);
            this.removeOtherPlayer(peerId);
            // 更新连接状态显示
            if (this.isHost) {
                this.simulator.uiController.updateConnectionStatus(`房间主机 - ${this.connections.size + 1}名玩家`);
            }
        });
        
        conn.on('error', (error) => {
            console.log('连接错误:', peerId, error);
            this.connections.delete(peerId);
            this.removeOtherPlayer(peerId);
        });
    }
    
    broadcastPosition() {
        if (!this.peer?.open) return;
        
        const data = {
            type: 'position',
            position: this.simulator.airplane.position,
            rotation: this.simulator.airplane.rotation,
            timestamp: Date.now()
        };
        
        for (const conn of this.connections.values()) {
            if (conn.open) {
                try {
                    conn.send(data);
                } catch (error) {
                    console.log('发送数据失败:', error);
                }
            }
        }
    }
    
    updateOtherPlayer(peerId, data) {
        if (!this.otherPlayers.has(peerId)) {
            // 创建其他玩家的飞机模型
            const otherAirplane = this.simulator.airplane.clone();
            
            // 遍历所有子对象，改变颜色
            otherAirplane.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material = child.material.clone();
                    child.material.color.setHex(0xff6600); // 橙色标识其他玩家
                }
            });
            
            this.simulator.scene.add(otherAirplane);
            this.otherPlayers.set(peerId, otherAirplane);
            
            console.log('添加其他玩家:', peerId);
        }
        
        const otherAirplane = this.otherPlayers.get(peerId);
        if (otherAirplane) {
            // 平滑更新位置和旋转
            otherAirplane.position.lerp(data.position, 0.1);
            otherAirplane.rotation.x = THREE.MathUtils.lerp(otherAirplane.rotation.x, data.rotation.x, 0.1);
            otherAirplane.rotation.y = THREE.MathUtils.lerp(otherAirplane.rotation.y, data.rotation.y, 0.1);
            otherAirplane.rotation.z = THREE.MathUtils.lerp(otherAirplane.rotation.z, data.rotation.z, 0.1);
        }
    }
    
    removeOtherPlayer(peerId) {
        const otherAirplane = this.otherPlayers.get(peerId);
        if (otherAirplane) {
            this.simulator.scene.remove(otherAirplane);
            this.otherPlayers.delete(peerId);
            console.log('移除其他玩家:', peerId);
        }
    }
    
    // 断开连接
    disconnect() {
        // 清理所有连接
        for (const conn of this.connections.values()) {
            if (conn.open) {
                conn.close();
            }
        }
        this.connections.clear();
        
        // 移除所有其他玩家
        for (const peerId of this.otherPlayers.keys()) {
            this.removeOtherPlayer(peerId);
        }
        
        // 销毁peer连接
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        this.simulator.uiController.updateConnectionStatus('已断开连接');
        console.log('多人游戏连接已断开');
    }
    
    // 重新连接
    reconnect() {
        this.disconnect();
        setTimeout(() => {
            this.initMultiplayer();
        }, 1000);
    }
    
    // 获取连接状态
    getConnectionStatus() {
        return {
            isConnected: this.peer?.open || false,
            isHost: this.isHost,
            playerCount: this.connections.size + 1,
            peerId: this.peer?.id || null
        };
    }
    
    // 发送自定义消息
    sendMessage(messageType, data) {
        const message = {
            type: messageType,
            data: data,
            timestamp: Date.now()
        };
        
        for (const conn of this.connections.values()) {
            if (conn.open) {
                try {
                    conn.send(message);
                } catch (error) {
                    console.log('发送消息失败:', error);
                }
            }
        }
    }
}
