class Touching {
    constructor() {
        this.spikes = null;
        this.ready = false;

        // Store the promise so we can track it in Game.js
        this.loadPromise = fetch('spikeHitboxes.json')
            .then(response => response.json())
            .then(data => {
                this.spikes = {};
                
                for (const key in data) {
                    const rleString = data[key]; 
                    
                    this.spikes[key] = this.decodeBinaryRLE(rleString);
                }
                
                this.ready = true;
            })
            .catch(error => console.error('Error loading or decoding spikes:', error));
    }

    decodeBinaryRLE(encodedString) {
        if (!encodedString) return [];

        const [startBitStr, countsStr] = encodedString.split('|');
        let currentBit = parseInt(startBitStr, 10);
        const counts = countsStr.split(' ').map(Number);

        let decodedData = [];
        for (let count of counts) {
            for (let i = 0; i < count; i++) {
                decodedData.push(currentBit);
            }
            currentBit = currentBit === 0 ? 1 : 0;
        }
        return decodedData;
    }

    is_pixel_on_spike(x, y, physics) {
        if (!this.ready) return false;

        const worldX = x;
        const worldY = y < 0 ? -y : y; 
        const tx = (worldX / 60) | 0; // Bitwise floor
        const ty = (worldY / 60) | 0;

        const localX = worldX % 60;
        const localY = worldY % 60;
        const offX = localX < 30 ? -1 : 1;
        const offY = localY < 30 ? -1 : 1;

        // Check 4 tiles manually (Home tile first)
        for (let i = 0; i < 4; i++) {
            let currTx, currTy;
            if (i === 0) { currTx = tx; currTy = ty; }
            else if (i === 1) { currTx = tx + offX; currTy = ty; }
            else if (i === 2) { currTx = tx; currTy = ty + offY; }
            else { currTx = tx + offX; currTy = ty + offY; }

            // Bounds check
            if (currTx < 0 || currTx >= physics.LSX || currTy < 0 || currTy >= physics.LSY) continue;

            const idx = currTx + currTy * physics.LSX;
            const tile = physics.MAP[idx];
            
            // Only check if it's a spike (mask 2)
            if (!physics.MASK[tile].includes(2)) continue;

            const spikeData = this.spikes[tile];
            if (!spikeData) continue;

            // Distance Cull: Hitbox resolution is 200, Scale is 2. 
            // Max reach from center is 100px (50 world units).
            const dx = worldX - (currTx * 60 + 30);
            const dy = (currTy * 60 + 30) - worldY;

            if (dx < -50 || dx > 50 || dy < -50 || dy > 50) continue;

            // Replace sin/cos with hardcoded 90 deg logic if rotation is an int
            const rot = physics.MAP_R[idx];
            let ix, iy;

            if (Number.isInteger(rot)) {
                if (rot === 0) {
                    ix = (-dy * 2) + 100;
                    iy = (dx * 2) + 100;
                } else if (rot === 1) {
                    ix = (dx * 2) + 100;
                    iy = (dy * 2) + 100;
                } else if (rot === 2) {
                    ix = (dy * 2) + 100;
                    iy = (-dx * 2) + 100;
                } else {
                    ix = (-dx * 2) + 100;
                    iy = (-dy * 2) + 100;
                }
            } else {
                const radians = (rot * 90 - 90) * Math.PI / 180;
                const cos = Math.cos(radians);
                const sin = Math.sin(radians);

                const srcX = (dx * cos + dy * sin) * 2 + 100;
                const srcY = (-dx * sin + dy * cos) * 2 + 100;

                ix = Math.floor(srcX);
                iy = Math.floor(srcY);
            }

            const fix = ix | 0;
            const fiy = iy | 0;

            if (fix >= 0 && fix < 200 && fiy >= 0 && fiy < 200) {
                // Using 40000 (200*200) as literal for speed
                const charIndex = (40000 - ((fiy + 1) * 200)) + fix;
                if (spikeData[charIndex] === 1) return true;
            }
        }

        return false;
    }

    is_pixel_on_player(px, py, playerState) {
        const spikes = this.spikes;
        if (!spikes) return false;

        const HITBOX_RES = 200;
        const HALF = 100; // HITBOX_RES / 2
        const SCALE = 2;

        const dx = px - playerState.PLAYER_X;
        const dy = py + playerState.PLAYER_Y;

        const radians = playerState.direction * 0.017453292519943295; // PI / 180
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);

        const srcX = (dx * cos + dy * sin) * SCALE + HALF;
        const srcY = (-dx * sin + dy * cos) * SCALE + HALF;

        // Bitwise floor is faster than Math.floor for positives
        const ix = srcX | 0;
        const iy = srcY | 0;

        if (ix < 0 || ix >= HITBOX_RES || iy < 0 || iy >= HITBOX_RES) {
            return false;
        }

        const base = spikes.player.length - HITBOX_RES;
        const charIndex = base - iy * HITBOX_RES + ix;

        if (charIndex < 0) return false;

        let source;

        if (playerState.player_state === 2) {
            source = playerState.player_wall == null
                ? spikes.crouched
                : spikes.wallcrouched;
        } else {
            source = spikes.player;
        }

        return source[charIndex] === 1;
    }


    is_player_touching_spike(playerState, physics) {
        if (!this.ready || !this.spikes) return false;

        // 1. Define the player's bounding box using bitwise floors
        const px = playerState.PLAYER_X;
        const py = playerState.PLAYER_Y;
        const pLeft = (px - playerState.PSZ[4]) | 0;
        const pRight = (px + playerState.PSZ[2]) | 0;
        const pTop = (py - playerState.PSZ[3]) | 0;
        const pBottom = (py + playerState.PSZ[1]) | 0;

        for (let y = pTop; y <= pBottom; y += 2) {
            for (let x = pLeft; x <= pRight; x += 2) {
                if (this.is_pixel_on_player(x, -y, playerState)) { 
                    if (this.is_pixel_on_spike(x, -y, physics)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }
}


// use this to encode binary for spikes:
// const encodeBinaryRLE = (data) => {
//     if (!data || data.length === 0) return "";

//     let result = [];
//     let currentVal = data[0];
//     let currentCount = 0;

//     for (let i = 0; i < data.length; i++) {
//         if (data[i] === currentVal) {
//             currentCount++;
//         } else {
//             result.push(currentCount);
//             currentVal = data[i];
//             currentCount = 1;
//         }
//     }
//     result.push(currentCount);

//     return `${data[0]}|${result.join(' ')}`; 
// };