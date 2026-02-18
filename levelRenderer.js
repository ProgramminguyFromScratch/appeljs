class LevelRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tileCache = new Map();
        this.tiles = [];
        this.playerNormal = null;
        this.playerCrouch = null;
        this.background = null;
        this.MASK = [];
        this.needsHue = [];
        this.visibleTiles = [];
        this.backgroundVariants = new Map();
        this.assetsLoaded = false;
        this.tileSize = 60;
    }

    static getDataFromCode(code) {
        try {
            // Exact parsing logic from your provided file
            const data = code.substring(7).split("Z");
            const LSX = data[0];
            const mapDataEnd = data.indexOf("");
            const MAP_data = data.slice(1, mapDataEnd);
            const remainingData = data.slice(mapDataEnd + 1);
            const mapRDataEnd = remainingData.indexOf("");
            const MAP_R_data = remainingData.slice(0, mapRDataEnd);

            const MAP = [];
            for (let i = 0; i < MAP_data.length; i += 2) {
                const value = parseInt(parseFloat(MAP_data[i]));
                const count = parseInt(parseFloat(MAP_data[i + 1]));
                for (let j = 0; j < count; j++) MAP.push(value);
            }

            const MAP_R = [];
            for (let i = 0; i < MAP_R_data.length; i += 2) {
                let value = MAP_R_data[i];
                const count = parseInt(parseFloat(MAP_R_data[i + 1]));
                value = (value === 'Infinity' || value.includes('e')) ? 1 : parseFloat(value);
                for (let j = 0; j < count; j++) MAP_R.push(value);
            }

            const finalData = remainingData.slice(mapRDataEnd + 1);

            return {
                map: MAP,
                rotations: MAP_R,
                size_x: parseInt(LSX),
                hue: finalData[finalData.length - 2],
                hue2: finalData[finalData.length - 1]
            };
        } catch (e) {
            console.error("[getDataFromCode] Error:", e);
            return null;
        }
    }

    async loadAssets(onProgress) {        
        // Helper to handle individual image loading with progress tracking
        const loadImage = (src) => {
            return new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                    if (onProgress) onProgress();
                    resolve(img);
                };
                img.onerror = () => {
                    console.warn(`Failed to load: ${src}`);
                    if (onProgress) onProgress(); // Count errors as progress so we don't hang
                    resolve(null);
                };
                img.src = src;
            });
        };

        // Load tiles 1-172
        const tilePromises = [];
        for (let i = 1; i <= 172; i++) {
            tilePromises.push(loadImage(`https://cdn.jsdelivr.net/gh/ProgramminguyFromScratch/appeljs/tiles/${i}.svg`));
        }
        
        // Wait for tiles, but we don't need to hold up the logic since we track progress
        // We use Promise.all just to assign the array at the end
        this.tiles = await Promise.all(tilePromises);

        // Load Player Sprites
        this.playerNormal = await loadImage('https://cdn.jsdelivr.net/gh/ProgramminguyFromScratch/appeljs/player_assets/stand.png');
        this.playerCrouch = await loadImage('https://cdn.jsdelivr.net/gh/ProgramminguyFromScratch/appeljs/player_assets/crouch.png');

        // Load Background
        await new Promise(resolve => {
            const img = new Image();
			img.crossOrigin = "anonymous";   // ADD THIS

            img.onload = () => { 
                this.background = img; 
                if (onProgress) onProgress();
                resolve(); 
            };
            img.onerror = () => {
                const fallback = document.createElement('canvas');
                fallback.width = 480; fallback.height = 360;
                const fctx = fallback.getContext('2d');
                fctx.fillStyle = '#4A90E2'; 
                fctx.fillRect(0, 0, 480, 360);
                this.background = fallback;
                if (onProgress) onProgress();
                resolve();
            };
            img.src = 'https://cdn.jsdelivr.net/gh/ProgramminguyFromScratch/appeljs/bg.svg';
        });

        this.visibleTiles = Array.from({length: 86}, (_, i) => i);
        this.needsHue = [..."01111110010010001101100000000001100000000111000001100000000000000001000001001111111001"]
            .flatMap((c, i) => c === "1" ? [i] : []);
        this.assetsLoaded = true;
    }


    
    renderPlayer(playerPos, camera) {
        if (!this.playerNormal || !this.playerCrouch) return;

        const screenX = playerPos.x - camera.x;
        const screenY = (this.canvas.height - playerPos.y) - camera.y;

        const margin = 50; 
        if (
            screenX < -margin || 
            screenX > this.canvas.width + margin ||
            screenY < -margin || 
            screenY > this.canvas.height + margin
        ) {
            return;
        }

        this.ctx.save();
        
        this.ctx.translate(screenX, screenY);

        const angle = playerPos.angle || 0; 
        this.ctx.rotate(angle * Math.PI / 180);

        if (playerPos.dir === -1) {
            this.ctx.scale(-1, 1);
        }

        if (playerPos.crouched) {
            const yOffset = playerPos.onWall ? -16 : -6;
            this.ctx.drawImage(this.playerCrouch, -12, yOffset, 24, 22);
        } else {
            this.ctx.drawImage(this.playerNormal, -12, -16, 24, 32);
        }

        this.ctx.restore();
    }


	rgbToHsv(r, g, b) {
		r /= 255;
		g /= 255;
		b /= 255;
		const max = Math.max(r, g, b),
			min = Math.min(r, g, b),
			d = max - min;
		let h = 0;
		if (d !== 0) {
			if (max === r) h = ((g - b) / d) % 6;
			else if (max === g) h = (b - r) / d + 2;
			else h = (r - g) / d + 4;
		}
		h = ((h * 60) + 360) % 360;
		const s = max === 0 ? 0 : d / max;
		return [h, s, max];
	}

	hsvToRgb(h, s, v) {
		h /= 60;
		const c = v * s;
		const x = c * (1 - Math.abs(h % 2 - 1));
		const m = v - c;
		const [r, g, b] =
		h < 1 ? [c, x, 0] :
			h < 2 ? [x, c, 0] :
			h < 3 ? [0, c, x] :
			h < 4 ? [0, x, c] :
			h < 5 ? [x, 0, c] : [c, 0, x];
		return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
	}

    applyColorEffect(source, hueShift) {
        const key = `${source.src || "canvas"}_${hueShift}`;
        if (this.tileCache.has(key)) return this.tileCache.get(key);

        const canvas = document.createElement('canvas');
        canvas.width = source.width || 60;
        canvas.height = source.height || 60;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            if (hueShift >= 1000) {
                const gray = data[i];
                data[i] = gray;
                data[i + 1] = gray;
                data[i + 2] = gray;
            } else {
                const [h, s, v] = this.rgbToHsv(data[i], data[i+1], data[i+2]);
                let hNorm = (h / 360 + (hueShift % 200) / 200) % 1.0;
                const [r, g, b] = this.hsvToRgb(hNorm * 360, s, v);
                [data[i], data[i+1], data[i+2]] = [r, g, b];
            }
        }
        ctx.putImageData(imageData, 0, 0);
        this.tileCache.set(key, canvas);
        return canvas;
    }

    fixHue(hueShift) {
        let realhue;
        const hueShiftStr = String(hueShift);
        if (hueShift === 'Infinity' || hueShiftStr.includes("e") || hueShiftStr.includes("E")) realhue = 1000;
        else if (hueShiftStr === "" || hueShiftStr === " ") realhue = 0;
        else if (hueShiftStr.includes("c") || hueShiftStr.includes("C")) realhue = parseInt(hueShiftStr.replace(/c/gi, "-"));
        else realhue = parseInt(hueShiftStr) % 200;
        return realhue;
    }

    betterModBcJsIsWeird(n, m) {
        return ((n % m) + m) % m;
    }

    render(levelData, camera) {
        if (!this.assetsLoaded) return;

        const hue = this.fixHue(levelData.hue);
        const hue2 = this.fixHue(levelData.hue2);

        const bgKey = `bg_${hue2}`;
        let bg = this.backgroundVariants.get(bgKey);
        bg = this.applyColorEffect(this.background, hue2);
        this.backgroundVariants.set(bgKey, bg);
        this.ctx.drawImage(bg, this.betterModBcJsIsWeird((camera.x * -0.5), 80) - 80, this.betterModBcJsIsWeird((camera.y * -0.5), 80) - 80, 564, 444);



        let startCol = Math.floor(camera.x / 60) + 1;
        let startRow = -1 - Math.floor(camera.y / 60) + 1;

        for (let isForeground = 0; isForeground <= 1; isForeground++){
            for (let y = 0; y < 7; y++) {
                for (let x = 0; x < 9; x++) {

                    const col = startCol + x;
                    const row = startRow + y;

                    const idx = (row - 1) * levelData.size_x + col - 1;

                    const tileIndex = levelData.map[idx] - 1 + isForeground * 86;
                    const rotation = levelData.rotations[idx] % 4;
                    let tile = this.tiles[tileIndex];
                    if (!tile) continue;

                    if (hue !== 0 && this.needsHue.includes(tileIndex % 86)) {
                        tile = this.applyColorEffect(tile, hue);
                    }

                    let tileX = col * 60 - 30;
                    let tileY = this.canvas.height - (row * 60 - 30);

                    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

                    this.ctx.translate(tileX - camera.x, tileY - camera.y);

                    if (rotation !== 1) {
                        this.ctx.rotate((rotation - 1) * Math.PI / 2);
                    }

                    this.ctx.drawImage(tile,-tile.width / 2, -tile.height / 2);


                    // this.ctx.fillStyle = "red";
                    // this.ctx.font = "12px Arial";
                    // this.ctx.textAlign = "center";
                    // this.ctx.textBaseline = "middle";
                    // this.ctx.fillText(rotation.toString(), 0, 0);

                    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

                }
            }
        }
        
    }
}


const loadImage = (src) => {
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = "anonymous";   // ADD THIS
        img.onload = () => {
            if (onProgress) onProgress();
            resolve(img);
        };
        img.onerror = () => {
            console.warn(`Failed to load: ${src}`);
            if (onProgress) onProgress();
            resolve(null);
        };
        img.src = src;
    });
};


