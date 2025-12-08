const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Simülasyon durumu
let isRunning = false;
let simTime = 0;
let lastTime = 0;
let vehicles = [];
let passedVehicles = 0;
let vehicleIdCounter = 0;
let smartMode = true;

// Yol ve kavşak sabitleri
const ROAD_WIDTH = 80;
const LANE_WIDTH = 40;
const CENTER_X = 450;
const CENTER_Y = 350;

// Kavşak bölgesi tanımı
const INTERSECTION = {
  left: CENTER_X - ROAD_WIDTH,
  right: CENTER_X + ROAD_WIDTH,
  top: CENTER_Y - ROAD_WIDTH,
  bottom: CENTER_Y + ROAD_WIDTH
};

// Akıllı trafik ışığı sistemi
const SMART_LIGHT = {
  currentGreen: 'NS', // 'NS' veya 'EW'
  timeInCurrentState: 0,
  minGreenTime: 8, // Minimum yeşil ışık süresi (daha kısa)
  maxGreenTime: 25, // Maximum yeşil ışık süresi (daha kısa)
  yellowTime: 3,
  isYellow: false,
  yellowStartTime: 0
};

// Klasik trafik ışığı döngüsü (saniye)
const CLASSIC_CYCLE = {
  NS_GREEN: 25,
  NS_YELLOW: 3,
  EW_GREEN: 25,
  EW_YELLOW: 3
};
const CYCLE_TOTAL = CLASSIC_CYCLE.NS_GREEN + CLASSIC_CYCLE.NS_YELLOW + 
                    CLASSIC_CYCLE.EW_GREEN + CLASSIC_CYCLE.EW_YELLOW;

// Gerçek trafik verileri
const TRAFFIC_DATA = [
  { time: 1, direction: 'N', count: 10   },
  { time: 5, direction: 'N', count: 2 },
  { time: 10, direction: 'E', count: 3 },
  { time: 26, direction: 'N', count: 2 },
  { time: 27, direction: 'E', count: 2 },
  { time: 29, direction: 'E', count: 1 },
  { time: 31, direction: 'E', count: 2 },
  { time: 45, direction: 'N', count: 1 },
  { time: 56, direction: 'N', count: 1 },
  { time: 78, direction: 'S', count: 1 },
  { time: 80, direction: 'W', count: 1 },
  { time: 91, direction: 'N', count: 1 },
  { time: 96, direction: 'N', count: 4 },
  { time: 98, direction: 'N', count: 3 },
  { time: 104, direction: 'E', count: 3 },
  { time: 107, direction: 'E', count: 2 },
  { time: 109, direction: 'E', count: 3 },
  { time: 115, direction: 'E', count: 2 },
  { time: 118, direction: 'N', count: 2 },
  { time: 126, direction: 'E', count: 1 }
];

let dataIndex = 0;
let nextSpawnTime = TRAFFIC_DATA[0].time;

// Yoğunluk analizi
function analyzeTrafficDensity() {
  let nsWaiting = 0;
  let ewWaiting = 0;
  
  vehicles.forEach(v => {
    if (!v.hasEnteredIntersection && !v.checkPassedIntersection()) {
      if (v.direction === 'N' || v.direction === 'S') {
        nsWaiting++;
      } else {
        ewWaiting++;
      }
    }
  });
  
  return { nsWaiting, ewWaiting };
}

// Akıllı trafik ışığı kontrolü
function updateSmartLights(dt) {
  const density = analyzeTrafficDensity();
  
  // Sarı ışık durumu
  if (SMART_LIGHT.isYellow) {
    SMART_LIGHT.yellowStartTime += dt;
    if (SMART_LIGHT.yellowStartTime >= SMART_LIGHT.yellowTime) {
      // Sarı ışık bitti, geç
      SMART_LIGHT.isYellow = false;
      SMART_LIGHT.yellowStartTime = 0;
      SMART_LIGHT.currentGreen = SMART_LIGHT.currentGreen === 'NS' ? 'EW' : 'NS';
      SMART_LIGHT.timeInCurrentState = 0;
    }
  } else {
    // Yeşil ışık durumu
    SMART_LIGHT.timeInCurrentState += dt;
    
    const currentIsNS = SMART_LIGHT.currentGreen === 'NS';
    const currentWaiting = currentIsNS ? density.nsWaiting : density.ewWaiting;
    const otherWaiting = currentIsNS ? density.ewWaiting : density.nsWaiting;
    
    // Işık değiştirme kararı
    let shouldSwitch = false;
    
    // Minimum süre geçtiyse değerlendirmeye başla
    if (SMART_LIGHT.timeInCurrentState >= SMART_LIGHT.minGreenTime) {
      // ÖNCELIK 1: Karşı tarafta 2+ araç varsa ve bu tarafta 0-1 araç varsa HEMEN değiştir
      if (otherWaiting >= 2 && currentWaiting <= 1) {
        shouldSwitch = true;
      }
      // ÖNCELIK 2: Karşı tarafta çok daha fazla yoğunluk varsa değiştir
      else if (otherWaiting >= currentWaiting + 2 && otherWaiting >= 2) {
        shouldSwitch = true;
      }
      // ÖNCELIK 3: Bu tarafta hiç araç yok, karşıda var
      else if (currentWaiting === 0 && otherWaiting > 0) {
        shouldSwitch = true;
      }
      // ÖNCELIK 4: Bu tarafta tek araç var, karşıda daha fazla var
      else if (currentWaiting === 1 && otherWaiting >= 3) {
        shouldSwitch = true;
      }
      // ÖNCELIK 5: Maximum süreye ulaşıldıysa değiştir (adalet için)
      else if (SMART_LIGHT.timeInCurrentState >= SMART_LIGHT.maxGreenTime) {
        shouldSwitch = true;
      }
    }
    
    if (shouldSwitch) {
      SMART_LIGHT.isYellow = true;
      SMART_LIGHT.yellowStartTime = 0;
    }
  }
  
  // Işık durumunu döndür
  if (SMART_LIGHT.isYellow) {
    return {
      NS: SMART_LIGHT.currentGreen === 'NS' ? 'yellow' : 'red',
      EW: SMART_LIGHT.currentGreen === 'EW' ? 'yellow' : 'red'
    };
  } else {
    return {
      NS: SMART_LIGHT.currentGreen === 'NS' ? 'green' : 'red',
      EW: SMART_LIGHT.currentGreen === 'EW' ? 'green' : 'red'
    };
  }
}

// Klasik trafik ışığı durumunu hesapla
function getClassicLightState(time) {
  const cyclePos = time % CYCLE_TOTAL;
  
  if (cyclePos < CLASSIC_CYCLE.NS_GREEN) {
    return { NS: 'green', EW: 'red' };
  } else if (cyclePos < CLASSIC_CYCLE.NS_GREEN + CLASSIC_CYCLE.NS_YELLOW) {
    return { NS: 'yellow', EW: 'red' };
  } else if (cyclePos < CLASSIC_CYCLE.NS_GREEN + CLASSIC_CYCLE.NS_YELLOW + CLASSIC_CYCLE.EW_GREEN) {
    return { NS: 'red', EW: 'green' };
  } else {
    return { NS: 'red', EW: 'yellow' };
  }
}

// Araç sınıfı
class Vehicle {
  constructor(direction) {
    this.id = vehicleIdCounter++;
    this.direction = direction;
    this.width = direction === 'N' || direction === 'S' ? 28 : 45;
    this.height = direction === 'N' || direction === 'S' ? 45 : 28;
    this.speed = 100;
    this.maxSpeed = 100;
    this.color = this.getRandomColor();
    this.state = 'moving';
    this.inIntersection = false;
    this.hasEnteredIntersection = false;
    
    this.setInitialPosition();
  }
  
  setInitialPosition() {
    const stopMargin = 2;
    
    switch(this.direction) {
      case 'N':
        this.x = CENTER_X - LANE_WIDTH - this.width / 2;
        this.y = -80; // Ekranın hemen üstünden başla
        this.stopLine = CENTER_Y - ROAD_WIDTH - stopMargin;
        this.exitLine = CENTER_Y + ROAD_WIDTH + 100;
        break;
      case 'S':
        this.x = CENTER_X + LANE_WIDTH - this.width / 2;
        this.y = canvas.height + 80; // Ekranın hemen altından başla
        this.stopLine = CENTER_Y + ROAD_WIDTH + this.height + stopMargin;
        this.exitLine = CENTER_Y - ROAD_WIDTH - 100;
        break;
      case 'E':
        this.x = canvas.width + 80; // Ekranın hemen sağından başla
        this.y = CENTER_Y - LANE_WIDTH - this.height / 2;
        this.stopLine = CENTER_X + ROAD_WIDTH + this.width + stopMargin;
        this.exitLine = CENTER_X - ROAD_WIDTH - 100;
        break;
      case 'W':
        this.x = -80; // Ekranın hemen solundan başla
        this.y = CENTER_Y + LANE_WIDTH - this.height / 2;
        this.stopLine = CENTER_X - ROAD_WIDTH - stopMargin;
        this.exitLine = CENTER_X + ROAD_WIDTH + 100;
        break;
    }
  }
  
  getRandomColor() {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  checkInIntersection() {
    switch(this.direction) {
      case 'N':
        return this.y + this.height >= INTERSECTION.top && this.y <= INTERSECTION.bottom;
      case 'S':
        return this.y <= INTERSECTION.bottom && this.y + this.height >= INTERSECTION.top;
      case 'E':
        return this.x <= INTERSECTION.right && this.x + this.width >= INTERSECTION.left;
      case 'W':
        return this.x + this.width >= INTERSECTION.left && this.x <= INTERSECTION.right;
    }
    return false;
  }
  
  update(dt, lights, otherVehicles) {
    const isNS = this.direction === 'N' || this.direction === 'S';
    const myLight = isNS ? lights.NS : lights.EW;
    
    this.inIntersection = this.checkInIntersection();
    
    if (this.inIntersection && !this.hasEnteredIntersection) {
      this.hasEnteredIntersection = true;
    }
    
    const passedIntersection = this.checkPassedIntersection();
    const vehicleAhead = this.getVehicleAhead(otherVehicles);
    const safeDistance = 40;
    
    if (this.hasEnteredIntersection || passedIntersection) {
      if (vehicleAhead && vehicleAhead.distance < safeDistance) {
        if (vehicleAhead.distance < 3) {
          this.speed = 0;
          this.state = 'stopped';
        } else {
          this.speed = Math.max(30, this.maxSpeed * (vehicleAhead.distance / safeDistance));
          this.state = 'following';
          this.move(dt);
        }
      } else {
        this.speed = this.maxSpeed;
        this.state = 'moving';
        this.move(dt);
      }
    } else {
      const distanceToStop = this.getDistanceToStopLine();
      
      if (vehicleAhead && vehicleAhead.distance < safeDistance) {
        if (vehicleAhead.distance < 3) {
          this.speed = 0;
          this.state = 'stopped';
        } else {
          this.speed = Math.max(20, this.maxSpeed * (vehicleAhead.distance / safeDistance));
          this.state = 'following';
          this.move(dt);
        }
      } else {
        if (myLight === 'red') {
          if (distanceToStop > 3) {
            this.state = 'stopping';
            this.speed = Math.max(15, this.maxSpeed * Math.min(1, distanceToStop / 80));
            this.move(dt);
          } else {
            this.state = 'stopped';
            this.speed = 0;
          }
        } else if (myLight === 'yellow') {
          if (distanceToStop < 50) {
            this.state = 'moving';
            this.speed = this.maxSpeed;
            this.move(dt);
          } else {
            this.state = 'stopping';
            this.speed = Math.max(20, this.maxSpeed * 0.4);
            this.move(dt);
          }
        } else {
          this.state = 'moving';
          this.speed = this.maxSpeed;
          this.move(dt);
        }
      }
    }
    
    if (this.checkOffScreen()) {
      this.state = 'passed';
    }
  }
  
  move(dt) {
    const distance = this.speed * dt;
    switch(this.direction) {
      case 'N': this.y += distance; break;
      case 'S': this.y -= distance; break;
      case 'E': this.x -= distance; break;
      case 'W': this.x += distance; break;
    }
  }
  
  getDistanceToStopLine() {
    switch(this.direction) {
      case 'N':
        return Math.max(0, this.stopLine - (this.y + this.height));
      case 'S':
        return Math.max(0, this.y - this.stopLine);
      case 'E':
        return Math.max(0, this.x - this.stopLine);
      case 'W':
        return Math.max(0, this.stopLine - (this.x + this.width));
    }
  }
  
  getVehicleAhead(otherVehicles) {
    let closestVehicle = null;
    let minDistance = Infinity;
    
    for (const other of otherVehicles) {
      if (other.id === this.id || other.direction !== this.direction) continue;
      
      let distance = 0;
      let isAhead = false;
      
      switch(this.direction) {
        case 'N':
          isAhead = other.y > this.y;
          distance = other.y - (this.y + this.height);
          break;
        case 'S':
          isAhead = other.y < this.y;
          distance = this.y - (other.y + other.height);
          break;
        case 'E':
          isAhead = other.x < this.x;
          distance = this.x - (other.x + other.width);
          break;
        case 'W':
          isAhead = other.x > this.x;
          distance = other.x - (this.x + this.width);
          break;
      }
      
      if (isAhead && distance >= -2 && distance < minDistance) {
        minDistance = distance;
        closestVehicle = other;
      }
    }
    
    return closestVehicle ? { vehicle: closestVehicle, distance: minDistance } : null;
  }
  
  checkPassedIntersection() {
    switch(this.direction) {
      case 'N': return this.y > INTERSECTION.bottom + 10;
      case 'S': return this.y + this.height < INTERSECTION.top - 10;
      case 'E': return this.x + this.width < INTERSECTION.left - 10;
      case 'W': return this.x > INTERSECTION.right + 10;
    }
  }
  
  checkOffScreen() {
    return this.x < -100 || this.x > canvas.width + 100 || 
           this.y < -100 || this.y > canvas.height + 100;
  }
  
  draw() {
    ctx.save();
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(100, 150, 200, 0.6)';
    const padding = 5;
    ctx.fillRect(
      this.x + padding, 
      this.y + padding, 
      this.width - padding * 2, 
      this.height - padding * 2
    );
    
    ctx.fillStyle = this.state === 'stopped' || this.state === 'stopping' ? '#ff0000' : '#ffff00';
    if (this.direction === 'N' || this.direction === 'S') {
      const lightY = this.direction === 'N' ? this.y + this.height - 8 : this.y + 3;
      ctx.fillRect(this.x + 5, lightY, 6, 5);
      ctx.fillRect(this.x + this.width - 11, lightY, 6, 5);
    } else {
      const lightX = this.direction === 'W' ? this.x + this.width - 8 : this.x + 3;
      ctx.fillRect(lightX, this.y + 5, 5, 6);
      ctx.fillRect(lightX, this.y + this.height - 11, 5, 6);
    }
    
    ctx.restore();
  }
}

function drawRoads() {
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = '#374151';
  ctx.fillRect(CENTER_X - ROAD_WIDTH, 0, ROAD_WIDTH * 2, canvas.height);
  
  ctx.fillStyle = '#374151';
  ctx.fillRect(0, CENTER_Y - ROAD_WIDTH, canvas.width, ROAD_WIDTH * 2);
  
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(INTERSECTION.left, INTERSECTION.top, ROAD_WIDTH * 2, ROAD_WIDTH * 2);
  
  drawLaneMarkings();
  drawStopLines();
}

function drawLaneMarkings() {
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3;
  ctx.setLineDash([20, 15]);
  
  ctx.beginPath();
  ctx.moveTo(CENTER_X, 0);
  ctx.lineTo(CENTER_X, INTERSECTION.top);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(CENTER_X, INTERSECTION.bottom);
  ctx.lineTo(CENTER_X, canvas.height);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(0, CENTER_Y);
  ctx.lineTo(INTERSECTION.left, CENTER_Y);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(INTERSECTION.right, CENTER_Y);
  ctx.lineTo(canvas.width, CENTER_Y);
  ctx.stroke();
  
  ctx.strokeStyle = '#f3f4f6';
  ctx.lineWidth = 4;
  ctx.setLineDash([]);
  
  ctx.beginPath();
  ctx.moveTo(CENTER_X - ROAD_WIDTH, 0);
  ctx.lineTo(CENTER_X - ROAD_WIDTH, canvas.height);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(CENTER_X + ROAD_WIDTH, 0);
  ctx.lineTo(CENTER_X + ROAD_WIDTH, canvas.height);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(0, CENTER_Y - ROAD_WIDTH);
  ctx.lineTo(canvas.width, CENTER_Y - ROAD_WIDTH);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(0, CENTER_Y + ROAD_WIDTH);
  ctx.lineTo(canvas.width, CENTER_Y + ROAD_WIDTH);
  ctx.stroke();
}

function drawStopLines() {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.setLineDash([]);
  
  ctx.beginPath();
  ctx.moveTo(INTERSECTION.left, INTERSECTION.top);
  ctx.lineTo(CENTER_X, INTERSECTION.top);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(CENTER_X, INTERSECTION.bottom);
  ctx.lineTo(INTERSECTION.right, INTERSECTION.bottom);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(INTERSECTION.right, INTERSECTION.top);
  ctx.lineTo(INTERSECTION.right, CENTER_Y);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(INTERSECTION.left, CENTER_Y);
  ctx.lineTo(INTERSECTION.left, INTERSECTION.bottom);
  ctx.stroke();
}

function drawTrafficLights(lights) {
  drawLight(CENTER_X - ROAD_WIDTH - 35, CENTER_Y - ROAD_WIDTH - 90, lights.NS);
  drawLight(CENTER_X + ROAD_WIDTH + 35, CENTER_Y + ROAD_WIDTH + 90, lights.NS);
  drawLight(CENTER_X + ROAD_WIDTH + 90, CENTER_Y - ROAD_WIDTH - 35, lights.EW);
  drawLight(CENTER_X - ROAD_WIDTH - 90, CENTER_Y + ROAD_WIDTH + 35, lights.EW);
}

function drawLight(x, y, state) {
  const lightSize = 16;
  const spacing = 28;
  
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x - 14, y - 14, 28, 90);
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 14, y - 14, 28, 90);
  
  ctx.fillStyle = state === 'red' ? '#ef4444' : '#3f3f46';
  ctx.beginPath();
  ctx.arc(x, y, lightSize / 2, 0, Math.PI * 2);
  ctx.fill();
  if (state === 'red') {
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  
  ctx.fillStyle = state === 'yellow' ? '#fbbf24' : '#3f3f46';
  ctx.beginPath();
  ctx.arc(x, y + spacing, lightSize / 2, 0, Math.PI * 2);
  ctx.fill();
  if (state === 'yellow') {
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  
  ctx.fillStyle = state === 'green' ? '#22c55e' : '#3f3f46';
  ctx.beginPath();
  ctx.arc(x, y + spacing * 2, lightSize / 2, 0, Math.PI * 2);
  ctx.fill();
  if (state === 'green') {
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function spawnVehicles() {
  if (dataIndex < TRAFFIC_DATA.length && simTime >= nextSpawnTime) {
    const data = TRAFFIC_DATA[dataIndex];
    
    // Araçları sırayla spawn et - ekran dışından başlayarak
    for (let i = 0; i < data.count; i++) {
      setTimeout(() => {
        const vehicle = new Vehicle(data.direction);
        vehicles.push(vehicle);
      }, i * 500); // Her araç 0.5 saniye arayla spawn olur
    }
    
    dataIndex++;
    if (dataIndex < TRAFFIC_DATA.length) {
      nextSpawnTime = TRAFFIC_DATA[dataIndex].time;
    }
  }
}

function render(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  
  if (isRunning) {
    simTime += dt;
    spawnVehicles();
    
    // Işık durumunu hesapla (akıllı veya klasik)
    const lights = smartMode ? updateSmartLights(dt) : getClassicLightState(simTime);
    
    vehicles.forEach(v => v.update(dt, lights, vehicles));
    
    vehicles = vehicles.filter(v => {
      if (v.state === 'passed') {
        passedVehicles++;
        return false;
      }
      return true;
    });
    
    drawRoads();
    drawTrafficLights(lights);
    vehicles.forEach(v => v.draw());
    
    updateStats();
  }
  
  requestAnimationFrame(render);
}

function updateStats() {
  const density = analyzeTrafficDensity();
  document.getElementById('activeCount').textContent = vehicles.length;
  document.getElementById('passedCount').textContent = passedVehicles;
  document.getElementById('simTime').textContent = Math.floor(simTime) + 's';
  document.getElementById('nsCount').textContent = density.nsWaiting;
  document.getElementById('ewCount').textContent = density.ewWaiting;
}

// Event listeners
document.getElementById('startBtn').addEventListener('click', () => {
  isRunning = !isRunning;
  document.getElementById('startBtn').textContent = isRunning ? '⏸ Duraklat' : '▶ Başlat';
  if (isRunning) lastTime = 0;
});

document.getElementById('resetBtn').addEventListener('click', () => {
  isRunning = false;
  simTime = 0;
  lastTime = 0;
  dataIndex = 0;
  nextSpawnTime = TRAFFIC_DATA[0].time;
  vehicles = [];
  passedVehicles = 0;
  vehicleIdCounter = 0;
  SMART_LIGHT.currentGreen = 'NS';
  SMART_LIGHT.timeInCurrentState = 0;
  SMART_LIGHT.isYellow = false;
  SMART_LIGHT.yellowStartTime = 0;
  document.getElementById('startBtn').textContent = '▶ Başlat';
  updateStats();
  drawRoads();
  drawTrafficLights({ NS: 'red', EW: 'red' });
});

document.getElementById('smartMode').addEventListener('change', (e) => {
  smartMode = e.target.checked;
  if (smartMode) {
    // Akıllı moda geçildiğinde sıfırla
    SMART_LIGHT.currentGreen = 'NS';
    SMART_LIGHT.timeInCurrentState = 0;
    SMART_LIGHT.isYellow = false;
    SMART_LIGHT.yellowStartTime = 0;
  }
});

// Manuel araç ekleme (opsiyonel - HTML'de varsa çalışır)
const dirButtons = document.querySelectorAll('.dir-btn');
if (dirButtons.length > 0) {
  dirButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const direction = btn.getAttribute('data-dir');
      const countInput = document.getElementById('vehicleCount');
      const count = countInput ? parseInt(countInput.value) || 1 : 1;
      
      // Araçları ekle
      for (let i = 0; i < count; i++) {
        const vehicle = new Vehicle(direction);
        const spacing = 60;
        switch(direction) {
          case 'N': vehicle.y -= i * spacing; break;
          case 'S': vehicle.y += i * spacing; break;
          case 'E': vehicle.x += i * spacing; break;
          case 'W': vehicle.x -= i * spacing; break;
        }
        vehicles.push(vehicle);
      }
      
      // Görsel feedback
      btn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        btn.style.transform = '';
      }, 100);
      
      updateStats();
    });
  });
}

// Araç sayısı değiştiğinde göstergeyi güncelle
const vehicleCountInput = document.getElementById('vehicleCount');
const countDisplay = document.querySelector('.count-display');
if (vehicleCountInput && countDisplay) {
  vehicleCountInput.addEventListener('input', (e) => {
    const count = parseInt(e.target.value) || 1;
    countDisplay.textContent = count + ' araç';
  });
}

// İlk çizim
drawRoads();
drawTrafficLights({ NS: 'red', EW: 'red' });
render(0);