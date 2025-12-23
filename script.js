// 设备检测与性能分级模块
class DeviceDetector {
    static getDeviceInfo() {
        const userAgent = navigator.userAgent.toLowerCase();
        const platform = navigator.platform.toLowerCase();
        
        return {
            // 设备类型检测
            isMobile: /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent),
            isTablet: /ipad|android(?!.*mobile)/i.test(userAgent),
            isDesktop: !/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent),
            isIOS: /ipad|iphone|ipod/.test(platform),
            isAndroid: /android/.test(userAgent),
            isChrome: /chrome/.test(userAgent),
            isFirefox: /firefox/.test(userAgent),
            isSafari: /safari/.test(userAgent) && !/chrome/.test(userAgent),
            
            // 触摸设备检测
            isTouchDevice: 'ontouchstart' in window || 
                          navigator.maxTouchPoints > 0 || 
                          navigator.msMaxTouchPoints > 0,
            
            // 性能分级
            getPerformanceLevel() {
                const memory = navigator.deviceMemory || 4;
                const cores = navigator.hardwareConcurrency || 4;
                const isLowPower = navigator.hardwareConcurrency <= 2 || memory <= 2;
                const isHighEnd = memory >= 8 && cores >= 8 && !this.isMobile;
                
                if (this.isMobile && isLowPower) return 'low';
                if (this.isMobile && !isLowPower) return 'medium';
                if (isHighEnd) return 'high';
                return 'medium';
            },
            
            // WebGL 能力检测
            getWebGLCapabilities() {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                
                if (!gl) return null;
                
                const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
                const maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
                const maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
                
                return {
                    maxTextureSize,
                    maxRenderBufferSize,
                    maxTextureUnits,
                    hasHighp: gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision > 0,
                    hasOESTextureFloat: !!gl.getExtension('OES_texture_float'),
                    hasOESTextureFloatLinear: !!gl.getExtension('OES_texture_float_linear'),
                    hasOESStandardDerivatives: !!gl.getExtension('OES_standard_derivatives'),
                };
            },
            
            // 电池状态检测
            async getBatteryInfo() {
                if ('getBattery' in navigator) {
                    try {
                        const battery = await navigator.getBattery();
                        return {
                            charging: battery.charging,
                            level: battery.level,
                            chargingTime: battery.chargingTime,
                            dischargingTime: battery.dischargingTime,
                        };
                    } catch (error) {
                        console.warn('Battery API not available:', error);
                        return null;
                    }
                }
                return null;
            },
            
            // 内存警告检测
            getMemoryInfo() {
                if ('deviceMemory' in navigator) {
                    return {
                        deviceMemory: navigator.deviceMemory,
                        totalJSHeapSize: performance.memory?.totalJSHeapSize,
                        usedJSHeapSize: performance.memory?.usedJSHeapSize,
                        jsHeapSizeLimit: performance.memory?.jsHeapSizeLimit,
                    };
                }
                return null;
            }
        };
    }
    
    // 获取推荐设置
    static getRecommendedSettings() {
        const info = this.getDeviceInfo();
        const perfLevel = info.getPerformanceLevel();
        
        const settings = {
            low: {
                // 低性能设置
                particleCount: 800,
                mainParticleCount: 300,
                dustParticleCount: 500,
                textureQuality: 'low',
                enableBloom: false,
                enableShadows: false,
                antialias: false,
                pixelRatio: 1.0,
                renderScale: 0.8,
                maxFPS: 30,
                lodEnabled: true,
                maxPhotos: 5,
                geometryDetail: 'low',
                physicsQuality: 'low'
            },
            medium: {
                // 中性能设置
                particleCount: 1500,
                mainParticleCount: 500,
                dustParticleCount: 1000,
                textureQuality: 'medium',
                enableBloom: info.isMobile ? false : true,
                enableShadows: info.isMobile ? false : true,
                antialias: false,
                pixelRatio: info.isMobile ? 1.0 : 1.5,
                renderScale: info.isMobile ? 0.9 : 1.0,
                maxFPS: info.isMobile ? 45 : 60,
                lodEnabled: true,
                maxPhotos: 8,
                geometryDetail: info.isMobile ? 'medium' : 'high',
                physicsQuality: 'medium'
            },
            high: {
                // 高性能设置
                particleCount: 4000,
                mainParticleCount: 1500,
                dustParticleCount: 2500,
                textureQuality: 'high',
                enableBloom: true,
                enableShadows: true,
                antialias: true,
                pixelRatio: Math.min(2.0, window.devicePixelRatio),
                renderScale: 1.0,
                maxFPS: 60,
                lodEnabled: false,
                maxPhotos: 15,
                geometryDetail: 'high',
                physicsQuality: 'high'
            }
        };
        
        return {
            ...settings[perfLevel],
            isMobile: info.isMobile,
            isTablet: info.isTablet,
            performanceLevel: perfLevel,
            isTouchDevice: info.isTouchDevice
        };
    }
}

// 性能监控器
class PerformanceMonitor {
    constructor() {
        this.fps = 60;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fpsHistory = [];
        this.maxHistoryLength = 60;
        this.lowFPSThreshold = 30;
        this.warnings = [];
    }
    
    update() {
        this.frameCount++;
        const currentTime = performance.now();
        
        if (currentTime - this.lastTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
            this.frameCount = 0;
            this.lastTime = currentTime;
            
            this.fpsHistory.push(this.fps);
            if (this.fpsHistory.length > this.maxHistoryLength) {
                this.fpsHistory.shift();
            }
            
            this.checkPerformance();
        }
    }
    
    checkPerformance() {
        const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
        
        if (avgFPS < this.lowFPSThreshold && this.fpsHistory.length >= 10) {
            if (!this.warnings.includes('low_fps')) {
                this.warnings.push('low_fps');
                console.warn(`Low FPS detected: ${avgFPS.toFixed(1)} FPS`);
                return 'low_fps';
            }
        }
        
        return null;
    }
    
    getAverageFPS() {
        if (this.fpsHistory.length === 0) return this.fps;
        return this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
    }
    
    reset() {
        this.fpsHistory = [];
        this.warnings = [];
    }
}

// 触摸控制器
class TouchController {
    constructor(app) {
        this.app = app;
        this.isEnabled = false;
        this.touchStartPos = { x: 0, y: 0 };
        this.touchRotation = { x: 0, y: 0 };
        this.lastTapTime = 0;
        this.longPressTimer = null;
        this.pinchStartDistance = 0;
        this.touchCount = 0;
        
        // 触摸灵敏度（根据设备调整）
        this.sensitivity = this.app.isMobile ? 0.005 : 0.01;
        this.rotationSpeed = 0.15;
    }
    
    enable() {
        if (this.isEnabled) return;
        
        const canvas = this.app.renderer.domElement;
        
        // 单指触摸 - 旋转控制
        canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        
        // 防止页面滚动
        document.addEventListener('touchmove', this.preventDefault, { passive: false });
        
        this.isEnabled = true;
        this.showTouchHint();
    }
    
    disable() {
        if (!this.isEnabled) return;
        
        const canvas = this.app.renderer.domElement;
        canvas.removeEventListener('touchstart', this.handleTouchStart);
        canvas.removeEventListener('touchmove', this.handleTouchMove);
        canvas.removeEventListener('touchend', this.handleTouchEnd);
        
        document.removeEventListener('touchmove', this.preventDefault);
        
        this.isEnabled = false;
    }
    
    handleTouchStart(event) {
        event.preventDefault();
        this.touchCount = event.touches.length;
        
        if (this.touchCount === 1) {
            // 单指触摸 - 开始旋转
            const touch = event.touches[0];
            this.touchStartPos = {
                x: touch.clientX,
                y: touch.clientY,
                time: Date.now()
            };
            
            // 长按检测
            this.longPressTimer = setTimeout(() => {
                this.handleLongPress();
            }, 800);
            
        } else if (this.touchCount === 2) {
            // 双指触摸 - 开始捏合
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            this.pinchStartDistance = this.getTouchDistance(touch1, touch2);
            
            // 清除长按计时器
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        }
    }
    
    handleTouchMove(event) {
        event.preventDefault();
        this.touchCount = event.touches.length;
        
        if (this.touchCount === 1 && this.touchStartPos.x !== 0) {
            // 单指移动 - 旋转场景
            const touch = event.touches[0];
            const deltaX = touch.clientX - this.touchStartPos.x;
            const deltaY = touch.clientY - this.touchStartPos.y;
            
            // 更新旋转
            this.touchRotation.y += deltaX * this.sensitivity;
            this.touchRotation.x += deltaY * this.sensitivity;
            
            // 限制X轴旋转角度
            this.touchRotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.touchRotation.x));
            
            // 更新起始位置
            this.touchStartPos.x = touch.clientX;
            this.touchStartPos.y = touch.clientY;
            
            // 清除长按计时器
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
            
        } else if (this.touchCount === 2 && this.pinchStartDistance > 0) {
            // 双指移动 - 捏合检测
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            const currentDistance = this.getTouchDistance(touch1, touch2);
            const pinchRatio = currentDistance / this.pinchStartDistance;
            
            // 捏合检测（缩放比例小于0.7）
            if (pinchRatio < 0.7 && this.app.STATE.mode !== 'FOCUS') {
                this.app.setMode('FOCUS');
                this.pinchStartDistance = 0;
            }
        }
    }
    
    handleTouchEnd(event) {
        event.preventDefault();
        
        // 清除长按计时器
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
        
        // 点击/双击检测
        const now = Date.now();
        const timeDiff = now - this.lastTapTime;
        
        if (timeDiff < 300 && timeDiff > 50 && this.touchCount === 0) {
            // 双击 - 隐藏/显示UI
            this.handleDoubleTap();
        }
        
        this.lastTapTime = now;
        this.touchCount = 0;
        this.pinchStartDistance = 0;
    }
    
    handleLongPress() {
        // 长按 - 切换模式
        const modes = ['TREE', 'SCATTER', 'FOCUS'];
        const currentIndex = modes.indexOf(this.app.STATE.mode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.app.setMode(modes[nextIndex]);
        
        // 提供触觉反馈（如果可用）
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }
    
    handleDoubleTap() {
        // 双击 - 切换UI显示
        this.app.uiContainer.classList.toggle('ui-hidden');
        
        // 提供触觉反馈
        if (navigator.vibrate) {
            navigator.vibrate(30);
        }
    }
    
    getTouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    preventDefault(event) {
        if (event.target.id !== 'canvas3d') {
            event.preventDefault();
        }
    }
    
    showTouchHint() {
        // 显示触摸提示（首次使用时）
        const touchHint = document.getElementById('touchHint');
        if (touchHint && !localStorage.getItem('touchHintShown')) {
            touchHint.style.display = 'block';
            
            // 10秒后自动隐藏
            setTimeout(() => {
                touchHint.style.opacity = '0';
                setTimeout(() => {
                    touchHint.style.display = 'none';
                }, 500);
            }, 10000);
            
            // 点击后立即隐藏
            touchHint.addEventListener('click', () => {
                touchHint.style.opacity = '0';
                setTimeout(() => {
                    touchHint.style.display = 'none';
                }, 500);
            });
            
            localStorage.setItem('touchHintShown', 'true');
        }
    }
    
    update() {
        // 平滑更新旋转
        if (this.app.mainGroup) {
            this.app.mainGroup.rotation.y = THREE.MathUtils.lerp(
                this.app.mainGroup.rotation.y,
                this.touchRotation.y,
                this.rotationSpeed
            );
            this.app.mainGroup.rotation.x = THREE.MathUtils.lerp(
                this.app.mainGroup.rotation.x,
                this.touchRotation.x,
                this.rotationSpeed
            );
        }
    }
}

// 手势识别器（MediaPipe降级版）
class GestureRecognizer {
    constructor(app) {
        this.app = app;
        this.handLandmarker = null;
        this.lastVideoTime = -1;
        this.isAvailable = false;
        this.gestureHistory = [];
        this.gestureConfidence = 0;
        this.debounceTime = 500;
        this.lastGestureTime = 0;
    }
    
    async initialize() {
        try {
            // 仅在非移动端或高性能移动端尝试MediaPipe
            if (this.app.isMobile && this.app.settings.performanceLevel === 'low') {
                console.log('Skipping MediaPipe on low-performance mobile device');
                return false;
            }
            
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
            );
            
            // 根据设备选择委托
            const delegate = this.app.isMobile ? "CPU" : "GPU";
            
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: delegate
                },
                runningMode: "VIDEO",
                numHands: 1,
                minHandDetectionConfidence: 0.5,
                minHandPresenceConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            
            // 设置摄像头
            await this.setupWebcam();
            
            this.isAvailable = true;
            console.log('MediaPipe initialized successfully');
            return true;
            
        } catch (error) {
            console.warn('MediaPipe initialization failed:', error);
            this.isAvailable = false;
            return false;
        }
    }
    
    async setupWebcam() {
        const video = document.getElementById('webcam');
        const canvas = document.getElementById('outputCanvas');
        const statusEl = document.getElementById('webcamStatus');
        
        if (!navigator.mediaDevices.getUserMedia) {
            throw new Error('getUserMedia not supported');
        }
        
        // 移动端摄像头约束
        const constraints = this.app.isMobile ? {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user',
                frameRate: { ideal: 24, max: 30 }
            },
            audio: false
        } : {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 60 }
            },
            audio: false
        };
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            
            await new Promise((resolve) => {
                video.addEventListener('loadeddata', resolve);
            });
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // 更新状态指示器
            if (statusEl) {
                statusEl.querySelector('.status-indicator').style.background = '#44ff44';
                statusEl.querySelector('.status-text').textContent = '摄像头已就绪';
            }
            
            // 开始预测
            this.predictWebcam();
            
        } catch (error) {
            console.error('Webcam setup failed:', error);
            if (statusEl) {
                statusEl.querySelector('.status-text').textContent = '摄像头不可用';
            }
            throw error;
        }
    }
    
    predictWebcam = async () => {
        if (!this.isAvailable) return;
        
        const video = document.getElementById('webcam');
        
        if (video.currentTime === this.lastVideoTime) {
            requestAnimationFrame(this.predictWebcam);
            return;
        }
        
        this.lastVideoTime = video.currentTime;
        
        try {
            const results = this.handLandmarker.detectForVideo(video, Date.now());
            
            if (results.landmarks && results.landmarks.length > 0) {
                const landmarks = results.landmarks[0];
                
                // 处理手势
                this.processGestures(landmarks);
                
                // 映射手部位置到3D旋转
                this.mapHandToRotation(landmarks);
            }
        } catch (error) {
            console.warn('Hand detection error:', error);
        }
        
        requestAnimationFrame(this.predictWebcam);
    };
    
    processGestures(landmarks) {
        const now = Date.now();
        if (now - this.lastGestureTime < this.debounceTime) {
            return;
        }
        
        // 获取关键点
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const wrist = landmarks[0];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];
        
        // 计算捏合距离
        const pinchDistance = Math.hypot(
            thumbTip.x - indexTip.x,
            thumbTip.y - indexTip.y,
            thumbTip.z - indexTip.z
        );
        
        // 计算指尖到手腕的平均距离
        const distances = [
            Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y, indexTip.z - wrist.z),
            Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y, middleTip.z - wrist.z),
            Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y, ringTip.z - wrist.z),
            Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y, pinkyTip.z - wrist.z)
        ];
        
        const avgDistance = distances.reduce((a, b) => a + b) / distances.length;
        
        // 根据设备调整阈值
        const pinchThreshold = this.app.isMobile ? 0.08 : 0.05;
        const fistThreshold = this.app.isMobile ? 0.3 : 0.25;
        const openThreshold = this.app.isMobile ? 0.35 : 0.4;
        
        // 手势识别
        if (pinchDistance < pinchThreshold && this.app.STATE.mode !== 'FOCUS') {
            this.app.setMode('FOCUS');
            this.lastGestureTime = now;
        } else if (avgDistance < fistThreshold && this.app.STATE.mode !== 'TREE') {
            this.app.setMode('TREE');
            this.lastGestureTime = now;
        } else if (avgDistance > openThreshold && this.app.STATE.mode !== 'SCATTER') {
            this.app.setMode('SCATTER');
            this.lastGestureTime = now;
        }
    }
    
    mapHandToRotation(landmarks) {
        // 使用手掌中心（地标9）进行旋转控制
        const palmCenter = landmarks[9];
        
        // 将标准化坐标映射到旋转值
        const rotationY = (palmCenter.x - 0.5) * 2;
        const rotationX = (0.5 - palmCenter.y) * (this.app.isMobile ? 1.0 : 1.5);
        
        // 平滑处理
        this.app.STATE.gestureData.rotationY = THREE.MathUtils.lerp(
            this.app.STATE.gestureData.rotationY,
            rotationY,
            0.1
        );
        this.app.STATE.gestureData.rotationX = THREE.MathUtils.lerp(
            this.app.STATE.gestureData.rotationX,
            rotationX,
            0.1
        );
    }
    
    dispose() {
        if (this.handLandmarker) {
            this.handLandmarker.close();
            this.handLandmarker = null;
        }
    }
}

// 主应用类
class ChristmasTreeApp {
    constructor() {
        // 设备检测
        this.deviceInfo = DeviceDetector.getDeviceInfo();
        this.settings = DeviceDetector.getRecommendedSettings();
        this.isMobile = this.settings.isMobile;
        this.isTouchDevice = this.settings.isTouchDevice;
        
        // Three.js 核心对象
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.controls = null;
        this.clock = new THREE.Clock();
        
        // 性能监控
        this.performanceMonitor = new PerformanceMonitor();
        this.frameSkip = 0;
        this.frameCounter = 0;
        
        // 粒子系统
        this.mainGroup = new THREE.Group();
        this.particles = [];
        this.photos = [];
        this.mixers = [];
        
        // 状态管理
        this.STATE = {
            mode: 'TREE', // TREE, SCATTER, FOCUS
            targetPositions: [],
            gestureData: {
                rotationX: 0,
                rotationY: 0
            },
            isAnimating: true,
            quality: this.settings.quality
        };
        
        // 控制器
        this.touchController = new TouchController(this);
        this.gestureRecognizer = new GestureRecognizer(this);
        
        // UI 元素
        this.uiElements = {};
        this.cacheUIElements();
        
        // 初始化
        this.init();
    }
    
    cacheUIElements() {
        this.uiElements = {
            loader: document.getElementById('loader'),
            loaderProgress: document.getElementById('loaderProgress'),
            performanceWarning: document.getElementById('performanceWarning'),
            continueBtn: document.getElementById('continueBtn'),
            lightweightBtn: document.getElementById('lightweightBtn'),
            deviceHint: document.getElementById('deviceHint'),
            closeHint: document.getElementById('closeHint'),
            uiContainer: document.getElementById('uiContainer'),
            modeIndicator: document.getElementById('modeIndicator'),
            modeIcon: document.getElementById('modeIcon'),
            modeText: document.getElementById('modeText'),
            modeSubtext: document.getElementById('modeSubtext'),
            desktopInstruction: document.getElementById('desktopInstruction'),
            mobileInstruction: document.getElementById('mobileInstruction'),
            uploadBtn: document.getElementById('uploadBtn'),
            fileInput: document.getElementById('fileInput'),
            modeControls: document.getElementById('modeControls'),
            qualitySelect: document.getElementById('qualitySelect'),
            enableBloom: document.getElementById('enableBloom'),
            enableShadows: document.getElementById('enableShadows'),
            settingsToggle: document.getElementById('settingsToggle'),
            settingsContent: document.getElementById('settingsContent'),
            quickHide: document.getElementById('quickHide'),
            quickPhoto: document.getElementById('quickPhoto'),
            quickReset: document.getElementById('quickReset'),
            mobileQuickbar: document.getElementById('mobileQuickbar'),
            photoCounter: document.getElementById('photoCounter'),
            photoCount: document.getElementById('photoCount'),
            webcamContainer: document.getElementById('webcamContainer'),
            toggleFullscreen: document.getElementById('toggleFullscreen'),
            toggleMute: document.getElementById('toggleMute'),
            showHelp: document.getElementById('showHelp'),
            touchHint: document.getElementById('touchHint')
        };
    }
    
    async init() {
        try {
            // 更新加载进度
            this.updateLoaderProgress(10);
            
            // 初始化Three.js
            await this.initThreeJS();
            this.updateLoaderProgress(30);
            
            // 初始化手势识别（降级处理）
            await this.initGestureRecognition();
            this.updateLoaderProgress(50);
            
            // 创建粒子
            this.createParticles();
            this.updateLoaderProgress(70);
            
            // 创建默认照片
            this.createDefaultPhoto();
            this.updateLoaderProgress(85);
            
            // 设置事件监听器
            this.setupEventListeners();
            this.updateLoaderProgress(95);
            
            // 开始动画循环
            this.animate();
            this.updateLoaderProgress(100);
            
            // 隐藏加载器
            setTimeout(() => {
                this.uiElements.loader.classList.add('hidden');
                
                // 显示设备提示（如果是移动端）
                if (this.isMobile && !this.gestureRecognizer.isAvailable) {
                    this.showDeviceHint();
                }
                
                // 显示性能警告（如果是低性能设备）
                if (this.settings.performanceLevel === 'low') {
                    setTimeout(() => {
                        this.uiElements.performanceWarning.style.display = 'block';
                    }, 1000);
                }
                
            }, 500);
            
        } catch (error) {
            console.error('Initialization failed:', error);
            this.handleInitializationError(error);
        }
    }
    
    updateLoaderProgress(percent) {
        const progressBar = this.uiElements.loaderProgress?.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
    }
    
    async initThreeJS() {
        // 场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.Fog(0x000000, 50, 150);
        
        // 相机 - 根据设备调整
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        
        if (this.isMobile) {
            this.camera.position.set(0, 3, 35);
            this.camera.fov = 65; // 更宽的视野适合移动端
        } else {
            this.camera.position.set(0, 2, 50);
        }
        
        // 渲染器
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('canvas3d'),
            antialias: this.settings.antialias,
            alpha: false,
            powerPreference: this.settings.performanceLevel === 'low' ? 'low-power' : 'high-performance',
            preserveDrawingBuffer: this.isMobile // 移动端优化
        });
        
        // 性能优化设置
        this.renderer.setPixelRatio(this.settings.pixelRatio);
        this.renderer.setSize(
            window.innerWidth * this.settings.renderScale,
            window.innerHeight * this.settings.renderScale
        );
        
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        this.renderer.toneMappingExposure = this.isMobile ? 1.8 : 2.2;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = this.settings.enableShadows;
        this.renderer.shadowMap.type = this.settings.performanceLevel === 'low' ? 
            THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
        
        // 环境
        const environment = new RoomEnvironment();
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pmremGenerator.fromScene(environment).texture;
        
        // 灯光系统
        this.setupLights();
        
        // 添加主组到场景
        this.scene.add(this.mainGroup);
        
        // 后期处理
        this.setupPostProcessing();
        
        // 轨道控制器
        this.setupOrbitControls();
    }
    
    setupLights() {
        // 环境光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // 点光源
        const pointLight = new THREE.PointLight(0xff6600, this.settings.performanceLevel === 'low' ? 1 : 2, 100);
        pointLight.position.set(5, 10, 5);
        this.scene.add(pointLight);
        
        // 聚光灯1（金色）
        const spotLight1 = new THREE.SpotLight(
            0xd4af37,
            this.settings.performanceLevel === 'low' ? 800 : 1200,
            100,
            Math.PI / 6,
            0.5,
            1
        );
        spotLight1.position.set(30, 40, 40);
        spotLight1.castShadow = this.settings.enableShadows;
        if (spotLight1.castShadow) {
            spotLight1.shadow.mapSize.width = this.isMobile ? 256 : 512;
            spotLight1.shadow.mapSize.height = this.isMobile ? 256 : 512;
        }
        this.scene.add(spotLight1);
        
        // 聚光灯2（蓝色）
        const spotLight2 = new THREE.SpotLight(
            0x3399ff,
            this.settings.performanceLevel === 'low' ? 400 : 600,
            100,
            Math.PI / 6,
            0.5,
            1
        );
        spotLight2.position.set(-30, 20, -30);
        this.scene.add(spotLight2);
    }
    
    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
        
        // 辉光效果（根据设置启用）
        if (this.settings.enableBloom) {
            const bloomPass = new UnrealBloomPass(
                new THREE.Vector2(
                    window.innerWidth * this.settings.renderScale,
                    window.innerHeight * this.settings.renderScale
                ),
                this.isMobile ? 0.3 : 0.45,
                this.isMobile ? 0.25 : 0.4,
                this.isMobile ? 0.9 : 0.7
            );
            this.composer.addPass(bloomPass);
        }
    }
    
    setupOrbitControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = this.isMobile ? 0.1 : 0.05;
        this.controls.maxPolarAngle = Math.PI / 1.5;
        this.controls.minDistance = this.isMobile ? 5 : 10;
        this.controls.maxDistance = this.isMobile ? 60 : 100;
        this.controls.enableZoom = !this.isMobile;
        this.controls.enablePan = !this.isMobile;
        this.controls.enableRotate = !this.isMobile; // 移动端禁用轨道控制，使用触摸控制
    }
    
    async initGestureRecognition() {
        // 尝试初始化MediaPipe手势识别
        const gestureAvailable = await this.gestureRecognizer.initialize();
        
        if (!gestureAvailable && this.isTouchDevice) {
            // 如果手势识别不可用，启用触摸控制
            this.touchController.enable();
            
            // 隐藏摄像头容器
            if (this.uiElements.webcamContainer) {
                this.uiElements.webcamContainer.style.display = 'none';
            }
        }
    }
    
    createParticles() {
        const totalParticles = this.settings.particleCount;
        const mainParticles = this.settings.mainParticleCount;
        const dustParticles = this.settings.dustParticleCount;
        
        // 根据质量设置材质
        const materials = this.createMaterials();
        
        // 创建糖果棒纹理
        const candyCaneTexture = this.createCandyCaneTexture();
        
        // 创建主粒子
        for (let i = 0; i < totalParticles; i++) {
            // 低性能设备跳过部分粒子
            if (this.settings.performanceLevel === 'low' && i % 3 === 0) continue;
            
            let geometry, material, type;
            
            if (i < mainParticles) {
                // 主粒子
                const shapeType = i % (this.isMobile ? 4 : 5);
                
                switch (shapeType) {
                    case 0: // 金色盒子
                        geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8, 1);
                        material = materials.gold;
                        type = 'BOX_GOLD';
                        break;
                    case 1: // 绿色盒子
                        geometry = new THREE.BoxGeometry(0.7, 0.7, 0.7, 1);
                        material = materials.green;
                        type = 'BOX_GREEN';
                        break;
                    case 2: // 金色球体
                        geometry = new THREE.SphereGeometry(
                            0.5,
                            this.settings.geometryDetail === 'low' ? 8 : 16,
                            this.settings.geometryDetail === 'low' ? 6 : 16
                        );
                        material = materials.gold;
                        type = 'SPHERE_GOLD';
                        break;
                    case 3: // 红色球体
                        geometry = new THREE.SphereGeometry(
                            0.6,
                            this.settings.geometryDetail === 'low' ? 8 : 16,
                            this.settings.geometryDetail === 'low' ? 6 : 16
                        );
                        material = materials.red;
                        type = 'SPHERE_RED';
                        break;
                    case 4: // 糖果棒（非移动端或高性能移动端）
                        if (this.settings.performanceLevel !== 'low') {
                            geometry = this.createCandyCaneGeometry();
                            material = new THREE.MeshStandardMaterial({
                                map: candyCaneTexture,
                                metalness: 0.2,
                                roughness: 0.5
                            });
                            type = 'CANDY';
                        } else {
                            continue;
                        }
                        break;
                }
            } else if (i < mainParticles + dustParticles) {
                // 尘埃粒子
                geometry = new THREE.SphereGeometry(
                    0.1 + Math.random() * 0.2,
                    this.settings.geometryDetail === 'low' ? 6 : 8,
                    this.settings.geometryDetail === 'low' ? 4 : 8
                );
                material = materials.dust;
                type = 'DUST';
            } else {
                continue;
            }
            
            if (!geometry) continue;
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = this.settings.enableShadows;
            mesh.receiveShadow = this.settings.enableShadows;
            
            const particle = {
                mesh,
                type,
                basePosition: new THREE.Vector3(),
                targetPosition: new THREE.Vector3(),
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02
                ),
                rotationSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02
                ),
                scale: 1,
                isPhoto: false
            };
            
            this.particles.push(particle);
            this.mainGroup.add(mesh);
        }
        
        // 根据当前模式更新位置
        this.updateParticlePositions();
    }
    
    createMaterials() {
        const flatShading = this.settings.performanceLevel === 'low';
        
        return {
            gold: new THREE.MeshStandardMaterial({
                color: 0xd4af37,
                metalness: this.isMobile ? 0.7 : 0.9,
                roughness: this.isMobile ? 0.4 : 0.2,
                flatShading
            }),
            green: new THREE.MeshStandardMaterial({
                color: 0x1a5f1a,
                metalness: 0.3,
                roughness: 0.8,
                flatShading
            }),
            red: new THREE.MeshPhysicalMaterial({
                color: 0xff0000,
                metalness: 0.5,
                roughness: 0.3,
                clearcoat: this.isMobile ? 0.5 : 0.8,
                clearcoatRoughness: 0.1,
                flatShading
            }),
            dust: new THREE.MeshStandardMaterial({
                color: 0xfceea7,
                emissive: 0xfceea7,
                emissiveIntensity: 0.2,
                flatShading
            })
        };
    }
    
    createCandyCaneTexture() {
        const canvas = document.createElement('canvas');
        const size = this.settings.textureQuality === 'high' ? 256 : 128;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // 白色背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 红色条纹
        ctx.fillStyle = '#ff0000';
        const stripeWidth = this.settings.textureQuality === 'high' ? 20 : 10;
        
        for (let i = -stripeWidth; i < canvas.width + stripeWidth; i += stripeWidth * 2) {
            ctx.fillRect(i, 0, stripeWidth, canvas.height);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 5);
        
        return texture;
    }
    
    createCandyCaneGeometry() {
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(1, 1, 0),
            new THREE.Vector3(0, 2, 0.5),
            new THREE.Vector3(-1, 3, 0)
        ]);
        
        const tubularSegments = this.settings.geometryDetail === 'high' ? 64 : 32;
        const radialSegments = this.settings.geometryDetail === 'high' ? 8 : 6;
        
        return new THREE.TubeGeometry(curve, tubularSegments, 0.2, radialSegments, false);
    }
    
    createDefaultPhoto() {
        const canvas = document.createElement('canvas');
        const size = this.settings.textureQuality === 'high' ? 512 : 256;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // 金色背景
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 内部白色区域
        ctx.fillStyle = '#fceea7';
        const margin = this.isMobile ? 15 : 20;
        ctx.fillRect(margin, margin, canvas.width - margin * 2, canvas.height - margin * 2);
        
        // 文字
        ctx.fillStyle = '#1a5f1a';
        const fontSize = this.isMobile ? 30 : 60;
        ctx.font = `bold ${fontSize}px Cinzel`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('JOYEUX NOEL', canvas.width / 2, canvas.height / 2);
        
        // 装饰元素
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 3, this.isMobile ? 20 : 30, 0, Math.PI * 2);
        ctx.fill();
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        
        this.addPhotoToScene(texture);
    }
    
    addPhotoToScene(texture) {
        // 检查照片数量限制
        if (this.photos.length >= this.settings.maxPhotos) {
            // 移除最旧的照片
            const oldPhoto = this.photos.shift();
            this.mainGroup.remove(oldPhoto.mesh);
            this.particles = this.particles.filter(p => p !== oldPhoto);
        }
        
        const frameScale = this.isMobile ? 0.7 : 1.0;
        
        // 创建相框
        const frameGeometry = new THREE.BoxGeometry(3.5 * frameScale, 4.5 * frameScale, 0.3 * frameScale);
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0xd4af37,
            metalness: 0.9,
            roughness: 0.2
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        
        // 创建照片
        const photoGeometry = new THREE.PlaneGeometry(3 * frameScale, 4 * frameScale);
        const photoMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            side: THREE.DoubleSide
        });
        const photo = new THREE.Mesh(photoGeometry, photoMaterial);
        photo.position.z = 0.16 * frameScale;
        
        // 组合相框和照片
        const photoGroup = new THREE.Group();
        photoGroup.add(frame);
        photoGroup.add(photo);
        
        // 随机位置
        const angle = Math.random() * Math.PI * 2;
        const radius = (this.isMobile ? 10 : 15) + Math.random() * (this.isMobile ? 5 : 10);
        photoGroup.position.set(
            Math.cos(angle) * radius,
            (Math.random() - 0.5) * (this.isMobile ? 10 : 15),
            Math.sin(angle) * radius
        );
        
        // 随机旋转
        photoGroup.rotation.y = Math.random() * Math.PI * 2;
        
        // 存储照片数据
        const photoParticle = {
            mesh: photoGroup,
            type: 'PHOTO',
            basePosition: photoGroup.position.clone(),
            targetPosition: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            rotationSpeed: new THREE.Vector3(),
            scale: 1,
            isPhoto: true
        };
        
        this.particles.push(photoParticle);
        this.photos.push(photoParticle);
        this.mainGroup.add(photoGroup);
        
        // 更新照片计数器
        this.updatePhotoCounter();
    }
    
    updatePhotoCounter() {
        if (this.uiElements.photoCount) {
            this.uiElements.photoCount.textContent = this.photos.length;
        }
    }
    
    updateParticlePositions() {
        const mode = this.STATE.mode;
        
        if (mode === 'TREE') {
            // 圣诞树模式 - 螺旋圆锥体
            const maxRadius = this.isMobile ? 8 : 12;
            const height = this.isMobile ? 18 : 25;
            
            this.particles.forEach((particle, i) => {
                if (particle.isPhoto) return;
                
                const t = i / this.particles.length;
                const radius = maxRadius * (1 - t * 0.8);
                const angle = t * 50 * Math.PI;
                const y = t * height - height / 2;
                
                particle.targetPosition.set(
                    Math.cos(angle) * radius,
                    y,
                    Math.sin(angle) * radius
                );
                particle.scale = this.isMobile ? 0.8 : 1;
            });
            
        } else if (mode === 'SCATTER') {
            // 散落模式 - 球体分布
            const minRadius = this.isMobile ? 6 : 8;
            const maxRadius = this.isMobile ? 15 : 20;
            
            this.particles.forEach((particle) => {
                if (particle.isPhoto) return;
                
                const radius = minRadius + Math.random() * (maxRadius - minRadius);
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                
                particle.targetPosition.set(
                    radius * Math.sin(phi) * Math.cos(theta),
                    (Math.random() - 0.5) * maxRadius * (this.isMobile ? 1.2 : 1.5),
                    radius * Math.sin(phi) * Math.sin(theta)
                );
                particle.scale = (this.isMobile ? 0.6 : 0.8) + Math.random() * (this.isMobile ? 0.3 : 0.4);
            });
            
        } else if (mode === 'FOCUS') {
            // 聚焦模式 - 突出显示一张照片
            if (this.photos.length > 0) {
                const targetPhoto = this.photos[Math.floor(Math.random() * this.photos.length)];
                
                targetPhoto.targetPosition.set(0, 2, this.isMobile ? 25 : 35);
                targetPhoto.scale = this.isMobile ? 3.5 : 4.5;
                
                const minRadius = this.isMobile ? 8 : 10;
                const maxRadius = this.isMobile ? 20 : 25;
                
                this.particles.forEach((particle) => {
                    if (particle === targetPhoto) return;
                    
                    if (particle.isPhoto) {
                        // 其他照片移到外围
                        const angle = Math.random() * Math.PI * 2;
                        const radius = (this.isMobile ? 15 : 20) + Math.random() * 10;
                        particle.targetPosition.set(
                            Math.cos(angle) * radius,
                            (Math.random() - 0.5) * (this.isMobile ? 8 : 10),
                            Math.sin(angle) * radius
                        );
                        particle.scale = this.isMobile ? 0.8 : 1;
                    } else {
                        // 粒子散开作为背景
                        const radius = minRadius + Math.random() * (maxRadius - minRadius);
                        const theta = Math.random() * Math.PI * 2;
                        const phi = Math.acos(2 * Math.random() - 1);
                        
                        particle.targetPosition.set(
                            radius * Math.sin(phi) * Math.cos(theta),
                            (Math.random() - 0.5) * maxRadius,
                            radius * Math.sin(phi) * Math.sin(theta)
                        );
                        particle.scale = (this.isMobile ? 0.4 : 0.5) + Math.random() * (this.isMobile ? 0.3 : 0.5);
                    }
                });
            }
        }
    }
    
    setMode(mode) {
        this.STATE.mode = mode;
        
        // 更新UI
        switch (mode) {
            case 'TREE':
                this.uiElements.modeText.textContent = '圣诞树模式';
                this.uiElements.modeSubtext.textContent = '粒子排列为圣诞树形状';
                this.uiElements.modeIcon.textContent = '🎄';
                break;
            case 'SCATTER':
                this.uiElements.modeText.textContent = '散落模式';
                this.uiElements.modeSubtext.textContent = '粒子随机散布在空中';
                this.uiElements.modeIcon.textContent = '❄️';
                break;
            case 'FOCUS':
                this.uiElements.modeText.textContent = '聚焦模式';
                this.uiElements.modeSubtext.textContent = '突出显示一张回忆照片';
                this.uiElements.modeIcon.textContent = '✨';
                break;
        }
        
        // 更新模式按钮状态
        if (this.uiElements.modeControls) {
            Array.from(this.uiElements.modeControls.children).forEach(btn => {
                btn.dataset.active = (btn.dataset.mode === mode).toString();
            });
        }
        
        // 更新粒子位置
        this.updateParticlePositions();
    }
    
    setupEventListeners() {
        // 窗口大小调整
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // 横竖屏切换
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.onWindowResize(), 200);
        });
        
        // 键盘控制
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // 文件上传
        this.uiElements.uploadBtn?.addEventListener('click', () => {
            this.uiElements.fileInput.click();
        });
        
        this.uiElements.fileInput?.addEventListener('change', this.handleFileUpload.bind(this));
        
        // 模式切换按钮
        if (this.uiElements.modeControls) {
            Array.from(this.uiElements.modeControls.children).forEach(btn => {
                btn.addEventListener('click', () => {
                    const mode = btn.dataset.mode;
                    if (mode) this.setMode(mode);
                });
            });
        }
        
        // 设置面板
        this.uiElements.settingsToggle?.addEventListener('click', () => {
            const content = this.uiElements.settingsContent;
            content.style.display = content.style.display === 'block' ? 'none' : 'block';
        });
        
        // 性能警告按钮
        this.uiElements.continueBtn?.addEventListener('click', () => {
            this.uiElements.performanceWarning.style.display = 'none';
        });
        
        this.uiElements.lightweightBtn?.addEventListener('click', () => {
            this.enableLightweightMode();
            this.uiElements.performanceWarning.style.display = 'none';
        });
        
        // 设备提示关闭
        this.uiElements.closeHint?.addEventListener('click', () => {
            this.uiElements.deviceHint.style.display = 'none';
        });
        
        // 移动端快捷按钮
        this.uiElements.quickHide?.addEventListener('click', () => {
            this.uiContainer.classList.toggle('ui-hidden');
        });
        
        this.uiElements.quickPhoto?.addEventListener('click', () => {
            this.uiElements.fileInput.click();
        });
        
        this.uiElements.quickReset?.addEventListener('click', () => {
            this.resetView();
        });
        
        // 底部按钮
        this.uiElements.toggleFullscreen?.addEventListener('click', this.toggleFullscreen.bind(this));
        this.uiElements.toggleMute?.addEventListener('click', this.toggleMute.bind(this));
        this.uiElements.showHelp?.addEventListener('click', this.showHelp.bind(this));
        
        // 防止手势缩放
        document.addEventListener('gesturestart', e => e.preventDefault());
        document.addEventListener('gesturechange', e => e.preventDefault());
        document.addEventListener('gestureend', e => e.preventDefault());
        
        // 页面可见性
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        });
    }
    
    handleKeyDown(event) {
        switch (event.key.toLowerCase()) {
            case 'h':
                // 隐藏/显示UI
                this.uiElements.uiContainer.classList.toggle('ui-hidden');
                break;
            case ' ':
                // 空格键切换模式
                event.preventDefault();
                const modes = ['TREE', 'SCATTER', 'FOCUS'];
                const currentIndex = modes.indexOf(this.STATE.mode);
                const nextIndex = (currentIndex + 1) % modes.length;
                this.setMode(modes[nextIndex]);
                break;
            case 'escape':
                // ESC重置视图
                this.resetView();
                break;
        }
    }
    
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // 检查文件大小（移动端限制）
        if (this.isMobile && file.size > 5 * 1024 * 1024) {
            alert('文件大小超过5MB，请选择较小的图片。');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            new THREE.TextureLoader().load(ev.target.result, (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                this.addPhotoToScene(texture);
            });
        };
        reader.readAsDataURL(file);
        
        // 重置文件输入
        event.target.value = '';
    }
    
    onWindowResize() {
        // 更新相机
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        // 更新渲染器大小
        this.renderer.setSize(
            window.innerWidth * this.settings.renderScale,
            window.innerHeight * this.settings.renderScale
        );
        
        // 更新后期处理
        this.composer.setSize(
            window.innerWidth * this.settings.renderScale,
            window.innerHeight * this.settings.renderScale
        );
        
        // 更新Bloom Pass分辨率
        if (this.composer.passes[1] instanceof UnrealBloomPass) {
            this.composer.passes[1].resolution = new THREE.Vector2(
                window.innerWidth * this.settings.renderScale,
                window.innerHeight * this.settings.renderScale
            );
        }
    }
    
    resetView() {
        // 重置相机位置
        if (this.isMobile) {
            this.camera.position.set(0, 3, 35);
        } else {
            this.camera.position.set(0, 2, 50);
        }
        
        // 重置控制器
        if (this.controls) {
            this.controls.reset();
        }
        
        // 重置触摸旋转
        if (this.touchController) {
            this.touchController.touchRotation = { x: 0, y: 0 };
        }
        
        // 重置手势数据
        this.STATE.gestureData = { rotationX: 0, rotationY: 0 };
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(console.error);
        } else {
            document.exitFullscreen().catch(console.error);
        }
    }
    
    toggleMute() {
        const video = document.getElementById('webcam');
        if (video) {
            video.muted = !video.muted;
        }
    }
    
    showHelp() {
        alert(`使用说明：
🎄 桌面端：
   - 鼠标拖动旋转场景
   - 滚轮缩放
   - H键：隐藏/显示UI
   - 空格键：切换模式
   - ESC键：重置视图

📱 移动端：
   - 单指拖动旋转场景
   - 双指捏合：聚焦模式
   - 长按：切换模式
   - 双击：隐藏/显示UI

✨ 手势识别（需摄像头）：
   - 捏合手指：聚焦模式
   - 握拳：圣诞树模式
   - 张开手掌：散落模式`);
    }
    
    showDeviceHint() {
        if (this.uiElements.deviceHint) {
            this.uiElements.deviceHint.style.display = 'block';
            setTimeout(() => {
                this.uiElements.deviceHint.style.opacity = '0';
                setTimeout(() => {
                    this.uiElements.deviceHint.style.display = 'none';
                }, 500);
            }, 5000);
        }
    }
    
    enableLightweightMode() {
        // 启用轻量模式
        this.settings = {
            ...this.settings,
            particleCount: 500,
            mainParticleCount: 200,
            dustParticleCount: 300,
            enableBloom: false,
            enableShadows: false,
            antialias: false,
            pixelRatio: 1.0,
            renderScale: 0.7
        };
        
        // 重新初始化
        this.reinitialize();
    }
    
    reinitialize() {
        // 清理现有资源
        this.particles.forEach(particle => {
            this.mainGroup.remove(particle.mesh);
            particle.mesh.geometry.dispose();
            particle.mesh.material.dispose();
        });
        this.particles = [];
        this.photos = [];
        
        // 重新创建粒子
        this.createParticles();
        
        // 更新UI
        this.updatePhotoCounter();
    }
    
    pause() {
        this.STATE.isAnimating = false;
        this.clock.stop();
    }
    
    resume() {
        this.STATE.isAnimating = true;
        this.clock.start();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // 性能监控
        this.performanceMonitor.update();
        
        // 低性能设备跳帧渲染
        if (this.settings.performanceLevel === 'low') {
            this.frameCounter++;
            if (this.frameCounter % 2 === 0) return;
        }
        
        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();
        
        // 更新FPS显示
        this.updateFPSDisplay();
        
        // 应用手势控制的旋转
        if (this.gestureRecognizer.isAvailable) {
            const { rotationX, rotationY } = this.STATE.gestureData;
            this.mainGroup.rotation.y += rotationY * 0.05;
            this.mainGroup.rotation.x += rotationX * 0.05;
        }
        
        // 应用触摸控制
        if (this.touchController.isEnabled) {
            this.touchController.update();
        }
        
        // 动画粒子到目标位置
        const animationSpeed = this.isMobile ? 0.03 : 0.05;
        
        this.particles.forEach((particle, index) => {
            // 低性能设备跳过部分粒子
            if (this.settings.performanceLevel === 'low' && index % 3 === 0) return;
            
            // 位置插值
            particle.mesh.position.lerp(particle.targetPosition, animationSpeed);
            
            // 缩放插值
            particle.mesh.scale.lerp(
                new THREE.Vector3(particle.scale, particle.scale, particle.scale),
                0.05
            );
            
            // 散落模式下的自转
            if (this.STATE.mode === 'SCATTER' && !particle.isPhoto) {
                particle.mesh.rotation.x += particle.rotationSpeed.x;
                particle.mesh.rotation.y += particle.rotationSpeed.y;
                particle.mesh.rotation.z += particle.rotationSpeed.z;
            }
            
            // 轻微浮动效果
            if (!particle.isPhoto) {
                particle.mesh.position.y += Math.sin(time + particle.mesh.id) * 0.005;
            }
        });
        
        // 更新控制器
        if (this.controls) {
            this.controls.update();
        }
        
        // 渲染
        if (this.settings.performanceLevel === 'low' && time % 2 < 1) {
            this.renderer.render(this.scene, this.camera);
        } else {
            this.composer.render();
        }
    }
    
    updateFPSDisplay() {
        const fpsCounter = document.querySelector('#fpsCounter');
        if (fpsCounter) {
            fpsCounter.textContent = `${this.performanceMonitor.fps} FPS`;
            
            // 根据FPS改变颜色
            if (this.performanceMonitor.fps < 30) {
                fpsCounter.style.color = '#ff4444';
            } else if (this.performanceMonitor.fps < 45) {
                fpsCounter.style.color = '#ffaa00';
            } else {
                fpsCounter.style.color = '#44ff44';
            }
        }
    }
    
    handleInitializationError(error) {
        console.error('Application initialization error:', error);
        
        // 显示错误信息
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: #ff4444;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            max-width: 80%;
            z-index: 10000;
            border: 2px solid #ff4444;
        `;
        
        errorMsg.innerHTML = `
            <h3>初始化失败</h3>
            <p>${error.message || '未知错误'}</p>
            <p>请尝试以下解决方案：</p>
            <ul style="text-align: left; margin: 15px 0;">
                <li>更新浏览器到最新版本</li>
                <li>检查WebGL支持：<a href="https://get.webgl.org" target="_blank">get.webgl.org</a></li>
                <li>禁用浏览器扩展程序</li>
                <li>清理浏览器缓存</li>
            </ul>
            <button onclick="location.reload()" style="
                background: #d4af37;
                color: #000;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                margin-top: 15px;
            ">重新加载</button>
        `;
        
        document.body.appendChild(errorMsg);
    }
    
    dispose() {
        // 清理粒子
        this.particles.forEach(particle => {
            particle.mesh.geometry.dispose();
            if (particle.mesh.material.map) {
                particle.mesh.material.map.dispose();
            }
            particle.mesh.material.dispose();
        });
        
        // 清理混合器
        this.mixers.forEach(mixer => mixer.stopAllActions());
        
        // 清理手势识别
        this.gestureRecognizer.dispose();
        
        // 清理渲染器
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        // 清理后期处理
        if (this.composer) {
            this.composer.passes.forEach(pass => {
                if (pass.dispose) pass.dispose();
            });
        }
    }
}

// 页面加载时初始化应用
async function initApp() {
    try {
        // 检查WebGL支持
        if (!window.WebGLRenderingContext) {
            throw new Error('您的浏览器不支持WebGL');
        }
        
        // 检查Three.js支持
        if (!window.THREE) {
            throw new Error('Three.js库加载失败');
        }
        
        // 创建应用实例
        const app = new ChristmasTreeApp();
        
        // 全局访问（调试用）
        window.app = app;
        
        // 页面卸载时清理
        window.addEventListener('beforeunload', () => {
            app.dispose();
        });
        
        // 错误处理
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
        });
        
    } catch (error) {
        console.error('Failed to initialize app:', error);
        
        // 显示错误页面
        document.body.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #000;
                color: #fceea7;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
                padding: 20px;
            ">
                <h1 style="color: #d4af37; margin-bottom: 20px;">🎄 圣诞快乐 🎅</h1>
                <p style="margin-bottom: 30px; max-width: 600px;">
                    很抱歉，应用无法正常加载。<br>
                    错误信息：${error.message}
                </p>
                <div style="margin-bottom: 30px;">
                    <h3>可能的原因：</h3>
                    <ul style="text-align: left; margin: 15px 0;">
                        <li>浏览器不支持WebGL或Three.js</li>
                        <li>网络连接问题导致资源加载失败</li>
                        <li>浏览器安全设置阻止了某些功能</li>
                        <li>设备性能不足</li>
                    </ul>
                </div>
                <div>
                    <button onclick="location.reload()" style="
                        background: #d4af37;
                        color: #000;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 16px;
                        margin: 10px;
                    ">重新加载</button>
                    <button onclick="window.history.back()" style="
                        background: transparent;
                        color: #fceea7;
                        border: 1px solid #d4af37;
                        padding: 12px 24px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 16px;
                        margin: 10px;
                    ">返回</button>
                </div>
            </div>
        `;
    }
}

// 启动应用
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// 导出模块
export { ChristmasTreeApp, DeviceDetector, PerformanceMonitor };