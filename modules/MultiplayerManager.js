// 多人游戏管理模块 - 重新设计

export class MultiplayerManager {
    constructor(simulator) {
        this.simulator = simulator;
        this.otherPlayers = new Map();
        this.peer = null;
        this.connections = new Map();
        this.isHost = false;
        this.myPeerId = null;
        this.hostPeerId = 'flight-sim-host-2024'; // 固定的主机ID
        this.isMobile = this.detectMobile();
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
        this.heartbeatInterval = null;
        
        console.log(`多人游戏初始化 - 设备: ${this.isMobile ? '移动端' : 'PC端'}`);
        this.initMultiplayer();
    }
    
    // 检测是否为移动设备
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    }
    
    initMultiplayer() {
        // 创建随机的peer ID
        this.peer = new Peer({
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });
        
        this.peer.on('open', (id) => {
            this.myPeerId = id;
            console.log('我的Peer ID:', id);
            this.simulator.uiController.updateConnectionStatus('尝试连接主机...');
            
            // 延迟后尝试连接主机
            setTimeout(() => {
                this.tryConnectToHost();
            }, 1000);
        });
        
        this.peer.on('error', (error) => {
            console.log('Peer错误:', error);
            this.handlePeerError(error);
        });
        
        this.peer.on('connection', (conn) => {
            console.log('收到连接请求:', conn.peer);
            this.handleIncomingConnection(conn);
        });
        
        this.peer.on('disconnected', () => {
            console.log('Peer连接断开');
            this.simulator.uiController.updateConnectionStatus('连接断开');
        });
    }
    
    tryConnectToHost() {
        this.connectionAttempts++;
        console.log(`尝试连接主机 (${this.connectionAttempts}/${this.maxConnectionAttempts})`);
        
        const conn = this.peer.connect(this.hostPeerId, {
            reliable: true,
            serialization: 'json'
        });
        
        const connectionTimeout = setTimeout(() => {
            console.log('连接主机超时');
            conn.close();
            this.handleConnectionFailure();
        }, 5000);
        
        conn.on('open', () => {
            clearTimeout(connectionTimeout);
            console.log('成功连接到主机');
            this.isHost = false;
            this.connections.set(this.hostPeerId, conn);
            this.setupConnectionListeners(conn, this.hostPeerId);
            this.simulator.uiController.updateConnectionStatus('已连接到主机');
            this.startHeartbeat();
            
            // 发送加入消息
            this.sendToHost({
                type: 'player_join',
                peerId: this.myPeerId,
                timestamp: Date.now()
            });
        });
        
        conn.on('error', (error) => {
            clearTimeout(connectionTimeout);
            console.log('连接主机失败:', error);
            this.handleConnectionFailure();
        });
    }
    
    handleConnectionFailure() {
        if (this.connectionAttempts < this.maxConnectionAttempts) {
            // 重试连接
            setTimeout(() => {
                this.tryConnectToHost();
            }, 2000);
        } else {
            // 成为主机
            console.log('无法连接到主机，成为新主机');
            this.becomeHost();
        }
    }
    
    becomeHost() {
        this.isHost = true;
        this.peer.destroy();
        
        // 使用固定ID创建主机
        this.peer = new Peer(this.hostPeerId, {
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });
        
        this.peer.on('open', (id) => {
            console.log('成为主机，ID:', id);
            this.myPeerId = id;
            this.simulator.uiController.updateConnectionStatus('主机 - 等待玩家加入');
            this.startHeartbeat();
            this.setupHostListeners();
        });
        
        this.peer.on('error', (error) => {
            console.log('主机创建失败:', error);
            if (error.type === 'unavailable-id') {
                // ID被占用，说明已有主机，重新尝试连接
                console.log('主机ID被占用，重新尝试连接');
                this.isHost = false;
                this.connectionAttempts = 0;
                setTimeout(() => {
                    this.initMultiplayer();
                }, 2000);
            } else {
                this.simulator.uiController.updateConnectionStatus('创建主机失败');
            }
        });
    }
    
    setupHostListeners() {
        this.peer.on('connection', (conn) => {
            console.log('新玩家连接:', conn.peer);
            this.handleIncomingConnection(conn);
        });
    }
    
    handleIncomingConnection(conn) {
        // 避免重复连接
        if (this.connections.has(conn.peer)) {
            console.log('重复连接，忽略:', conn.peer);
            conn.close();
            return;
        }
        
        this.connections.set(conn.peer, conn);
        this.setupConnectionListeners(conn, conn.peer);
        this.updatePlayerCount();
        
        // 如果是主机，广播新玩家加入消息
        if (this.isHost) {
            this.broadcastToAll({
                type: 'player_list_update',
                players: Array.from(this.connections.keys()).concat([this.myPeerId]),
                timestamp: Date.now()
            });
        }
    }
    
    setupConnectionListeners(conn, peerId) {
        conn.on('data', (data) => {
            this.handleMessage(data, peerId);
        });
        
        conn.on('close', () => {
            console.log('玩家断开连接:', peerId);
            this.connections.delete(peerId);
            this.removeOtherPlayer(peerId);
            this.updatePlayerCount();
            
            // 如果是主机，广播玩家离开消息
            if (this.isHost) {
                this.broadcastToAll({
                    type: 'player_list_update',
                    players: Array.from(this.connections.keys()).concat([this.myPeerId]),
                    timestamp: Date.now()
                });
            }
        });
        
        conn.on('error', (error) => {
            console.log('连接错误:', peerId, error);
            this.connections.delete(peerId);
            this.removeOtherPlayer(peerId);
            this.updatePlayerCount();
        });
    }
    
    handleMessage(data, fromPeerId) {
        switch (data.type) {
            case 'position':
                this.updateOtherPlayer(fromPeerId, data);
                break;
                
            case 'player_join':
                if (this.isHost) {
                    console.log('玩家加入:', data.peerId);
                    // 发送当前玩家列表
                    this.sendToPeer(fromPeerId, {
                        type: 'player_list_update',
                        players: Array.from(this.connections.keys()).concat([this.myPeerId]),
                        timestamp: Date.now()
                    });
                }
                break;
                
            case 'player_list_update':
                console.log('收到玩家列表更新:', data.players);
                this.updatePlayerList(data.players);
                break;
                
            case 'heartbeat':
                // 回应心跳
                this.sendToPeer(fromPeerId, {
                    type: 'heartbeat_response',
                    timestamp: Date.now()
                });
                break;
                
            case 'heartbeat_response':
                // 心跳响应，连接正常
                break;
        }
    }
    
    updatePlayerList(playerList) {
        // 更新UI显示的玩家数量
        const playerCount = playerList.length;
        this.simulator.uiController.updateConnectionStatus(
            this.isHost ? `主机 - ${playerCount}名玩家在线` : `已连接 - ${playerCount}名玩家在线`
        );
    }
    
    updatePlayerCount() {
        const playerCount = this.connections.size + 1; // +1 包括自己
        this.simulator.uiController.updateConnectionStatus(
            this.isHost ? `主机 - ${playerCount}名玩家在线` : `已连接 - ${playerCount}名玩家在线`
        );
    }
    
    broadcastPosition() {
        if (!this.peer?.open) return;
        
        const data = {
            type: 'position',
            position: this.simulator.airplane.position,
            rotation: this.simulator.airplane.rotation,
            timestamp: Date.now()
        };
        
        // 发送给所有连接的玩家
        for (const [peerId, conn] of this.connections.entries()) {
            if (conn.open) {
                try {
                    conn.send(data);
                } catch (error) {
                    console.log('发送位置数据失败:', peerId, error);
                    this.connections.delete(peerId);
                    this.removeOtherPlayer(peerId);
                }
            }
        }
    }
    
    updateOtherPlayer(peerId, data) {
        if (!this.otherPlayers.has(peerId)) {
            // 创建其他玩家的飞机模型
            const otherAirplane = this.simulator.airplane.clone();
            
            // 改变颜色以区分其他玩家
            otherAirplane.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material = child.material.clone();
                    child.material.color.setHex(0xff6600); // 橙色
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
    
    sendToHost(data) {
        if (!this.isHost && this.connections.has(this.hostPeerId)) {
            const conn = this.connections.get(this.hostPeerId);
            if (conn?.open) {
                try {
                    conn.send(data);
                } catch (error) {
                    console.log('发送到主机失败:', error);
                }
            }
        }
    }
    
    sendToPeer(peerId, data) {
        const conn = this.connections.get(peerId);
        if (conn && conn.open) {
            try {
                conn.send(data);
            } catch (error) {
                console.log('发送到玩家失败:', peerId, error);
            }
        }
    }
    
    broadcastToAll(data) {
        for (const [peerId, conn] of this.connections.entries()) {
            if (conn.open) {
                try {
                    conn.send(data);
                } catch (error) {
                    console.log('广播失败:', peerId, error);
                    this.connections.delete(peerId);
                    this.removeOtherPlayer(peerId);
                }
            }
        }
    }
    
    startHeartbeat() {
        // 清除之前的心跳
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        // 每10秒发送一次心跳
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, 10000);
    }
    
    sendHeartbeat() {
        const heartbeatData = {
            type: 'heartbeat',
            timestamp: Date.now()
        };
        
        for (const [peerId, conn] of this.connections.entries()) {
            if (conn.open) {
                try {
                    conn.send(heartbeatData);
                } catch (error) {
                    console.log('心跳发送失败:', peerId, error);
                    this.connections.delete(peerId);
                    this.removeOtherPlayer(peerId);
                    this.updatePlayerCount();
                }
            }
        }
    }
    
    handlePeerError(error) {
        console.log('处理Peer错误:', error.type, error.message);
        this.simulator.uiController.updateConnectionStatus('连接错误');
        
        // 重新初始化
        setTimeout(() => {
            this.reconnect();
        }, 3000);
    }
    
    // 重新连接
    reconnect() {
        console.log('重新连接...');
        this.disconnect();
        this.connectionAttempts = 0;
        setTimeout(() => {
            this.initMultiplayer();
        }, 1000);
    }
    
    // 断开连接
    disconnect() {
        // 清除心跳
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        // 关闭所有连接
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
        
        // 销毁peer
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        this.simulator.uiController.updateConnectionStatus('已断开连接');
        console.log('多人游戏连接已断开');
    }
    
    // 获取连接状态
    getConnectionStatus() {
        return {
            isConnected: this.peer?.open || false,
            isHost: this.isHost,
            playerCount: this.connections.size + 1,
            peerId: this.myPeerId,
            isMobile: this.isMobile,
            connections: this.connections.size
        };
    }
}
