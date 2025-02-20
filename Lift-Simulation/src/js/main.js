class LiftSystem {
    constructor() {
        this.floors = 0;
        this.lifts = [];
        this.requests = new Map();
        this.assignedRequests = new Map();
        this.initialize();
    }

    initialize() {
        const startButton = document.getElementById('start-simulation');
        startButton.addEventListener('click', () => this.startSimulation());
    }

    startSimulation() {
        const floorsInput = document.getElementById('floors');
        const liftsInput = document.getElementById('lifts');
        
        const floors = parseInt(floorsInput.value);
        const numLifts = parseInt(liftsInput.value);
        
        // Input validation
        if (isNaN(floors)) {
            alert('Please enter a valid number of floors');
            return;
        }
        
        if (isNaN(numLifts)) {
            alert('Please enter a valid number of lifts');
            return;
        }
        
        this.floors = floors;
        this.requests.clear();
        this.lifts = [];
        
        this.createBuilding();
        this.initializeLifts(numLifts);
    }

    createBuilding() {
        const building = document.getElementById('building');
        building.innerHTML = '';
        const totalHeight = this.floors * 100;
        building.style.height = `${totalHeight}px`;
        
        for (let i = this.floors - 1; i >= 0; i--) {
            const floor = document.createElement('div');
            floor.className = 'floor';
            floor.style.bottom = `${i * 100}px`;
            
            const floorSection = document.createElement('div');
            floorSection.className = 'floor-section';
            
            const floorNumber = document.createElement('div');
            floorNumber.className = 'floor-number';
            floorNumber.textContent = `Floor ${i}`;
            floorSection.appendChild(floorNumber);
            
            const buttons = document.createElement('div');
            buttons.className = 'floor-buttons';
            
            if (i < this.floors - 1) {
                const upButton = this.createButton('▲', i, 'up');
                buttons.appendChild(upButton);
            }
            
            if (i > 0) {
                const downButton = this.createButton('▼', i, 'down');
                buttons.appendChild(downButton);
            }
            
            floorSection.appendChild(buttons);
            floor.appendChild(floorSection);

            const numLifts = parseInt(document.getElementById('lifts').value);
            for (let j = 0; j < numLifts; j++) {
                const shaft = document.createElement('div');
                shaft.className = 'lift-shaft';
                shaft.id = `shaft-${j}-floor-${i}`;
                floor.appendChild(shaft);
            }
            
            building.appendChild(floor);
        }
    }

    createButton(symbol, floor, direction) {
        const button = document.createElement('button');
        button.className = 'floor-button';
        button.textContent = symbol;
        button.dataset.floor = floor;
        button.dataset.direction = direction;
        button.addEventListener('click', (e) => this.handleLiftRequest(floor, direction, e.target));
        return button;
    }

    initializeLifts(numLifts) {
        for (let i = 0; i < numLifts; i++) {
            const shaft = document.getElementById(`shaft-${i}-floor-0`);
            if (!shaft) continue;

            const lift = {
                id: i,
                currentFloor: 0,
                targetFloor: null,
                direction: null,
                status: 'idle',
                element: this.createLiftElement()
            };
            
            lift.element.style.transform = 'translateY(0)';
            shaft.appendChild(lift.element);
            this.lifts.push(lift);
        }
    }

    createLiftElement() {
        const lift = document.createElement('div');
        lift.className = 'lift';
        lift.dataset.status = 'idle';
        
        const leftDoor = document.createElement('div');
        leftDoor.className = 'lift-door left';
        
        const rightDoor = document.createElement('div');
        rightDoor.className = 'lift-door right';
        
        lift.appendChild(leftDoor);
        lift.appendChild(rightDoor);
        
        return lift;
    }

    handleLiftRequest(floor, direction, clickedButton) {
        if (this.assignedRequests.has(`${floor}-${direction}`)) {
            return;
        }

        if (this.requests.has(floor) && this.requests.get(floor).has(direction)) {
            return;
        }

        if (!this.requests.has(floor)) {
            this.requests.set(floor, new Set());
        }
        this.requests.get(floor).add(direction);
        
        const buttonDirection = clickedButton.textContent === '▲' ? 'up' : 'down';
        if (buttonDirection === direction) {
            clickedButton.classList.add('active');
            clickedButton.disabled = true;
        }
        
        this.processRequests();
    }

    async processRequests() {
        if (this.requests.size === 0) return;

        const idleLifts = this.lifts.filter(lift => lift.status === 'idle');
        if (idleLifts.length === 0) return;

        for (const [floor, directions] of this.requests) {
            for (const direction of directions) {
                const requestKey = `${floor}-${direction}`;
                
                if (this.assignedRequests.has(requestKey)) {
                    continue;
                }

                const nearestLift = this.findNearestAvailableLift(floor, direction);
                if (nearestLift) {
                    this.assignedRequests.set(requestKey, nearestLift.id);
                    await this.dispatchLift(nearestLift, floor, direction);
                    this.assignedRequests.delete(requestKey);
                }
            }
        }
    }

    findNearestAvailableLift(targetFloor, direction) {
        let bestLift = null;
        let minScore = Infinity;

        for (const lift of this.lifts) {
            if (lift.status !== 'idle') continue;

            let score = Math.abs(lift.currentFloor - targetFloor);
            
            if (lift.direction === direction) {
                score -= 0.5;
            }

            if (score < minScore) {
                minScore = score;
                bestLift = lift;
            }
        }

        return bestLift;
    }

    async dispatchLift(lift, targetFloor, direction) {
        lift.status = 'moving';
        lift.element.dataset.status = 'moving';
        lift.direction = direction;
        lift.targetFloor = targetFloor;

        const directions = this.requests.get(targetFloor);
        directions.delete(direction);
        if (directions.size === 0) {
            this.requests.delete(targetFloor);
            
            const buttons = document.querySelectorAll('.floor-button');
            buttons.forEach(button => {
                if (parseInt(button.dataset.floor) === targetFloor && 
                    button.dataset.direction === direction) {
                    button.classList.remove('active');
                    button.disabled = false;
                }
            });
        }

        await this.moveLift(lift, targetFloor);
        
        lift.element.dataset.status = 'busy';
        await this.operateDoors(lift);

        lift.currentFloor = targetFloor;
        lift.status = 'idle';
        lift.element.dataset.status = 'idle';
        lift.direction = null;
        lift.targetFloor = null;
    }

    async moveLift(lift, targetFloor) {
        const distance = Math.abs(lift.currentFloor - targetFloor);
        const duration = distance * 2; // 2 seconds per floor
        
        lift.element.style.transition = `transform ${duration}s linear`;
        lift.element.style.transform = `translateY(${-(targetFloor * 100)}px)`;
        
        return new Promise(resolve => {
            setTimeout(resolve, duration * 1000);
        });
    }

    async operateDoors(lift) {
        lift.element.classList.add('door-open');
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        lift.element.classList.remove('door-open');
        await new Promise(resolve => setTimeout(resolve, 2500));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new LiftSystem();
});