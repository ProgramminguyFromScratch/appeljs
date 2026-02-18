class AppelPhysics {
    constructor(mapData, mapRotations, LSX) {
        this.MAP = Array.isArray(mapData) ? mapData : Array.from(mapData);
        this.MAP_R = Array.isArray(mapRotations) ? mapRotations : Array.from(mapRotations);

        this.touching = (typeof Touching !== 'undefined') ? new Touching() : null;

        let maskStrings = [
            '          ', '          ', '5555   1h', '5555   1h',
            '5005   1h', '5000   1h', '5050   xh', '5..5   3h',
            '       2 ', '.00.   3 ', '5555   1h', '    02 4 ',
            '111100 2 ', '5055   1h', '5000   1 ', '****   5 ',
            '100100 2 ', '5555   1h', '5555   1h', '    04 4 ',
            '5555   1h', '5555   1h', '    00 2 ', '    80 6 ',
            '    81 6 ', '       5 ', '       5 ', '          ',
            '          ', '          ', '          ', '    06 4 ',
            '    82 4h', '5555   1h', '0660   6 ', '0660     ',
            '0660     ', '0660     ', '0660     ', '0660     ',
            '          ', '          ', '5665   6h', '5555    h',
            '5555   6h', '    08 4 ', '0600   6 ', '0600     ',
            '0600     ', '0600     ', '5775   6h', '5775   6h',
            '         ', '         ', '         ', '         ',
            '         ', '         ', '    09 4 ', '    84 4 ',
            '    60 7 ', '    10 4 ', '    11 4 ', '       5 ',
            '         ', '         ', '         ', '         ',
            '5555   1h', '    12 5 ', '    00 5 ', '    00 2 ',
            '6600   6 ', '100181 6 ', '....   3h', '    13 4 ',
            '    00 5 ', '.      3h', '   .   3h', '1111   2h',
            '1111   5h', '5115   2h', '5111   2h', '.00.   3h',
            '111100 2 ', '****00 5 ', '5555   1h'
        ];

        maskStrings = maskStrings.map(item => {
        return item.replaceAll(".", "2"); // Replace all occurrences of "." with "2" so that it can still convert to an int
        });

        this.MASK = maskStrings.map(mask =>
            [...mask.slice(0, 4)].map(c =>
                c >= '0' && c <= '9' ? parseInt(c) : 0
            )
        );

        this.PSZ = [0, 17, 13, 17, 13];
        this.LSX = LSX;
        this.toverlap = 0;
        this.mask_char = 0;
        this.overlap = 0;
        this.RESOLVE = [0, 0, 1, 0, -1, -1, 0, 1, 0, -1, -1, 1, -1, -1, 1, 1, 1];
        this._temp_coords = [0, 0];
    }

    get_block_at(x, y) {
        const idx = Math.floor(x / 60) + Math.floor(y / 60) * this.LSX;

        const tile = this.MAP[idx];
        const mask = this.MASK[tile];

        let mid;

        if (((x % 60) + 60) % 60 < 30) {
            mid = (((y % 60) + 60) % 60 < 30) ? 1 : 2;
        } else {
            mid = (((y % 60) + 60) % 60 < 30) ? 0 : 3;
        }

        return mask[Math.floor((((mid - this.MAP_R[idx]) % 4) + 4) % 4)];
    }

    
    is_solid_at(x, y, dir) {
        this.mask_char = this.get_block_at(x, y);

        if (this.mask_char < 5) {
            return;
        }

        // Scratch-style modulo
        const mod30 = (v) => ((v % 30) + 30) % 30;

        let temp;

        if (dir === 1) {
            temp = mod30(x);
        } else if (dir > 0) {
            temp = 30 - mod30(y);
        } else if (dir === -1) {
            temp = 30 - mod30(x);
        } else {
            temp = mod30(y);
        }

        if (temp > this.overlap) {
            this.overlap = temp;
        }
    }

    
    touching_wall_dx(playerState, dir) {
        if (playerState.player_state === 1 || playerState.is_falling < 3) {
            return;
        }

        const px = playerState.PLAYER_X;
        const py = playerState.PLAYER_Y;

        this.overlap = 0;
        this.is_solid_at(px + dir * -30, py + 8, dir);
        this.is_solid_at(px + dir * -30, py - 8, dir);

        if (this.overlap === 0) {
            this.overlap = 0;

            this.is_solid_at(px + dir * 4, py + 4, dir);
            if (this.overlap > 0) {

                this.overlap = 0;
                this.is_solid_at(px + dir * 4, py - 4, dir);

                if (this.overlap > 0 && Math.abs(playerState.PLAYER_SX) > 3) {

                    if ((dir !== playerState.flipped) || playerState.player_state === 3) {
                        playerState.player_state = 1;
                        this.set_flipped(playerState, dir);
                    }

                    playerState.player_wall = dir;
                }
            }
        }
    }


    full_overlap(x, y, dir, dxy2) {
        this._temp_coords[0] = x;
        this._temp_coords[1] = y;
        this.toverlap = 0;

        for (let i = 0; i < 4; i++) {
            this.overlap = 0;

            const tx = this._temp_coords[0];
            const ty = this._temp_coords[1];

            // Check solid tiles
            this.is_solid_at(tx, ty, dir);
            if (dir & 1) {  // odd: vertical check
                this.is_solid_at(tx, ty + dxy2, dir);
            } else {        // even: horizontal check
                this.is_solid_at(tx + dxy2, ty, dir);
            }

            // Stop if no overlap
            if (this.overlap === 0) {
                return;
            }

            // Slight extra push as in Python
            this.overlap += 0.01;
            this.toverlap += this.overlap;

            // Move temp coordinates according to direction
            if (dir > 0) {
                if (dir === 1) {
                    this._temp_coords[0] -= this.overlap;
                } else {
                    this._temp_coords[1] += this.overlap;
                }
            } else {
                if (dir === -1) {
                    this._temp_coords[0] += this.overlap;
                } else {
                    this._temp_coords[1] -= this.overlap;
                }
            }
        }
    }


    set_flipped_safe(playerState, dir) {
        this.set_flipped(playerState, dir);

        let safe = null;
        let safed = 64;

        this.full_overlap(playerState.PLAYER_X - playerState.PSZ[4], playerState.PLAYER_Y + playerState.PSZ[1], 0, playerState.PSZ[4] + playerState.PSZ[2]);

        if (this.toverlap > 0 && this.toverlap < safed) {
            safe = 0;
            safed = this.toverlap;
        }        

        this.full_overlap(playerState.PLAYER_X - playerState.PSZ[4], playerState.PLAYER_Y - playerState.PSZ[3], 2, playerState.PSZ[4] + playerState.PSZ[2]);

        if (this.toverlap > 0 && this.toverlap < safed) {
            safe = 2;
            safed = this.toverlap;
        }

        this.full_overlap(playerState.PLAYER_X - playerState.PSZ[4], playerState.PLAYER_Y - playerState.PSZ[3], -1, playerState.PSZ[1] + playerState.PSZ[3]);

        if (this.toverlap > 0 && this.toverlap < safed) {
            safe = -1;
            safed = this.toverlap;
        } 

        this.full_overlap(playerState.PLAYER_X + playerState.PSZ[2], playerState.PLAYER_Y - playerState.PSZ[3], 1, playerState.PSZ[1] + playerState.PSZ[3]);

        if (this.toverlap > 0 && this.toverlap < safed) {
            safe = 1;
            safed = this.toverlap;
        } 

        if (safe !== null) {
            if (safe > 0) {
                if (safe > 1) {
                    playerState.PLAYER_Y += safed;
                } else {
                    playerState.PLAYER_X -= safed;
                }
            } else {
                if (safe > -1) {
                    playerState.PLAYER_Y -= safed;
                } else {
                    playerState.PLAYER_X += safed;
                }
            }

            this.resolve_collisions(false, playerState);
        }
    }

    
    make_upright(playerState) {
        if (playerState.flipped === 0) {
            return;
        }

        playerState.player_state = 1;
        this.set_flipped_safe(playerState, 0);
        this.overlap = 0;
    }

    check_square(x, y, playerState) {
        const left_x = x - playerState.PSZ[4];
        const right_x = x + playerState.PSZ[2];
        const top_y = y - playerState.PSZ[3];
        const bottom_y = y + playerState.PSZ[1];

        // Check top corners first
        if (this.get_block_at(left_x, top_y) >= 5 || 
            this.get_block_at(right_x, top_y) >= 5) {
            return;
        }

        // Check bottom edge with overlap
        this.overlap = 0;
        this.is_solid_at(left_x, bottom_y, 0);
        if (this.overlap !== 0) return;

        this.is_solid_at(right_x, bottom_y, 0);
        if (this.overlap !== 0) return;

        // Check middle points
        if (this.get_block_at(left_x, y) >= 5 || 
            this.get_block_at(right_x, y) >= 5) {
            return;
        }

        // No collision detected
        this.mask_char = -1;
    }

    
    resolve(x, y, deep, playerState) {
        const resolve = this.RESOLVE;

        for (let i2 = 1; i2 <= deep; i2++) {
            for (let i3 = 1; i3 < 16; i3 += 2) {
                playerState.PLAYER_X = x + resolve[i3] * i2;
                playerState.PLAYER_Y = y + resolve[i3 + 1] * i2;

                this.check_square(playerState.PLAYER_X, playerState.PLAYER_Y, playerState);
                if (this.mask_char === -1) {
                    return;
                }
            }
        }

        // No valid position found: reset to original and mark death
        playerState.PLAYER_X = x;
        playerState.PLAYER_Y = y;
        playerState.PLAYER_DEATH = true;
    }

    resolve_collisions(deep, playerState) {
        this.check_square(playerState.PLAYER_X, playerState.PLAYER_Y, playerState);
        if (this.mask_char === -1) {
            return;
        }

        this.resolve(
            playerState.PLAYER_X,
            playerState.PLAYER_Y,
            deep ? 10 : 4,  // deep search if true, else 4
            playerState
        );
    }

    move_player_x(playerState) {
        let sx = playerState.PLAYER_SX;
        const rem_x = playerState.PLAYER_X;

        const dir = sx > 0 ? 1 : -1;
        let px = playerState.PLAYER_X;
        const py = playerState.PLAYER_Y;

        // Update position with hitbox offsets
        if (sx > 0) {
            px += sx + playerState.PSZ[2];
        } else {
            px += sx - playerState.PSZ[4];
        }
        playerState.PLAYER_X = px;

        // Collision checks
        this.overlap = 0;
        this.is_solid_at(px, py + playerState.PSZ[1], dir);
        this.active_block(dir, px, py + playerState.PSZ[1], playerState);
        this.is_solid_at(px, py, dir);
        this.is_solid_at(px, py - playerState.PSZ[3], dir);
        this.active_block(dir, px, py - playerState.PSZ[3], playerState);

        if (this.overlap > 0) {
            const abs_sx = Math.abs(sx);

            // Large overlap: resolve collisions
            if (this.overlap > abs_sx + 4) {
                const temp = px;
                playerState.PLAYER_X = rem_x + sx;
                this.resolve_collisions(false, playerState);

                if (playerState.PLAYER_DEATH) {
                    playerState.PLAYER_X = temp;
                    playerState.PLAYER_DEATH = true;
                } else {
                    return;
                }
            }

            const overlapAdjust = 0.01 + this.overlap;
            if (sx > 0) {
                playerState.PLAYER_X -= overlapAdjust;
                this.touching_wall_dx(playerState, 1);
            } else {
                playerState.PLAYER_X += overlapAdjust;
                this.touching_wall_dx(playerState, -1);
            }

            this.overlap = 0;
            px = playerState.PLAYER_X;
            this.is_solid_at(px, py + playerState.PSZ[1], dir);
            this.is_solid_at(px, py, dir);
            this.is_solid_at(px, py - playerState.PSZ[3], dir);

            if (this.overlap > 0) {
                playerState.PLAYER_DEATH = true;
            }

            playerState.PLAYER_SX *= 0.5;
        }

        playerState.PLAYER_X += sx > 0 ? -playerState.PSZ[2] : playerState.PSZ[4];

        if (playerState.PLAYER_X < 14) {
            playerState.PLAYER_X = 14;
            playerState.PLAYER_SX = 0;
        }
    }

    touching_wall_dy(playerState, up, dy) {
        playerState.PLAYER_SY = 0;

        if (dy === 1 && up) {
            playerState.PLAYER_SY = 4;
            if (playerState.friction_dy > 0) {
                playerState.PLAYER_SY += playerState.friction_dy;
            }
            playerState.is_falling = 0;
            playerState.player_wall = 0;
            this.set_flipped(playerState, 0);
        } else {
            if (dy === -1 && playerState.friction_dy < 0) {
                playerState.PLAYER_SY += playerState.friction_dy;
            }
        }
    }

    move_player_y(playerState, up) {
        let dy = playerState.PLAYER_SY;
        const px = playerState.PLAYER_X;
        let py = playerState.PLAYER_Y;

        const dir = dy > 0 ? 0 : 2;

        // Apply hitbox offsets for movement
        if (dy > 0) {
            py += dy + playerState.PSZ[1];
        } else {
            py += dy - playerState.PSZ[3];
        }
        playerState.PLAYER_Y = py;

        // Collision checks
        this.overlap = 0;
        playerState.friction = 0;
        playerState.friction_dx = 0;
        playerState.friction_dy = 0;
        this.is_solid_at(px + playerState.PSZ[2], py, dir);
        this.active_block(dir, px + playerState.PSZ[2], py, playerState);
        this.is_solid_at(px - playerState.PSZ[4], py, dir);
        this.active_block(dir, px - playerState.PSZ[4], py, playerState);

        if (this.overlap > 0) {
            const overlapAdjust = 0.01 + this.overlap;

            if (dy > 0) {
                playerState.PLAYER_Y -= overlapAdjust;
                this.touching_wall_dy(playerState, up, 1);

                if (playerState.player_state === 1 || playerState.player_state === 3) {
                    playerState.player_state = 0;
                }
            } else {
                playerState.PLAYER_Y += overlapAdjust;
                this.touching_wall_dy(playerState, up, -1);

                playerState.is_falling = 0;
                playerState.is_jumping = 0;

                if (playerState.player_wall !== 2) {
                    playerState.player_wall = null;
                }

                if (playerState.player_state === 3) {
                    playerState.player_state = 0;
                }
            }
        }

        // Remove hitbox offset after movement
        playerState.PLAYER_Y -= dy > 0 ? playerState.PSZ[1] : -playerState.PSZ[3];
    }

    
    set_flipped(playerState, flipped) {
        let temp = (flipped & 3) + 1;  // bitwise AND instead of modulo

        const isCrouch = playerState.player_state === 2;
        const isOnWall = playerState.player_wall !== null;

        // Set PSZ values in sequence
        playerState.PSZ[temp] = (playerState.player_wall === null && isCrouch) ? 7 : 17;
        temp = (temp & 3) + 1;
        playerState.PSZ[temp] = 13;
        temp = (temp & 3) + 1;
        playerState.PSZ[temp] = (isOnWall && isCrouch) ? 7 : 17;
        temp = (temp & 3) + 1;
        playerState.PSZ[temp] = 13;

        playerState.flipped = flipped;
    }

    can_get_up(playerState) {
        this.overlap = 0;
        const px = playerState.PLAYER_X;
        const py = playerState.PLAYER_Y;

        if (playerState.flipped === 0) {
            if (playerState.player_wall === 0) {
                let checkY = (py - playerState.PSZ[3]) - 8;
                this.is_solid_at(px - playerState.PSZ[4], checkY, 0);
                this.is_solid_at(px + playerState.PSZ[2], checkY, 0);
            } else {
                let checkY = py + playerState.PSZ[1] + 8;
                this.is_solid_at(px - playerState.PSZ[4], checkY, 0);
                this.is_solid_at(px + playerState.PSZ[2], checkY, 0);
            }
        } else if (playerState.flipped === 1) {
            let checkX = px - playerState.PSZ[4] - 8;
            this.is_solid_at(checkX, py + playerState.PSZ[1], 1);
            this.is_solid_at(checkX, py - playerState.PSZ[3], 1);
        } else if (playerState.flipped === 3) {
            let checkX = px + playerState.PSZ[2] + 8;
            this.is_solid_at(checkX, py + playerState.PSZ[1], -1);
            this.is_solid_at(checkX, py - playerState.PSZ[3], -1);
        }
    }


    position_now(playerState) {
        if (playerState.player_state === 3) {
            playerState.direction += 22.5 * playerState.flipped;
            playerState.direction = ((playerState.direction % 360) + 360) % 360;
            if (playerState.direction > 180) playerState.direction -= 360;
            return;
        }

        if (playerState.player_state === 1) {
            const targetDirection = playerState.flipped * 90;
            let temp = ((targetDirection - playerState.direction + 180) % 360) - 180;

            if (Math.abs(temp) < 22.5) {
                playerState.direction = targetDirection;
                playerState.player_state = 0;
            } else {
                const step = (temp >= 0 && !(temp === -180 && playerState.direction === 0)) ? 30 : -30;
                playerState.direction += step;
                playerState.direction = ((playerState.direction % 360) + 360) % 360;
                if (playerState.direction > 180) playerState.direction -= 360;
            }
            return;
        }

        playerState.direction = playerState.flipped * 90;
        if (playerState.direction > 180) playerState.direction -= 360;
    }


    confirm_still_touching_wall(playerState) {
        const px = playerState.PLAYER_X;
        const py = playerState.PLAYER_Y;
        const wall = playerState.player_wall;

        this.overlap = 0;

        if (wall === 0) {
            // Floor check
            this.is_solid_at(px, py + playerState.PSZ[1] + 1, 0);
        } else if (wall === 1) {
            // Right wall check
            const checkX = px + playerState.PSZ[2] + 1;
            this.is_solid_at(checkX, py, 0);
            this.active_block(wall, checkX, py, playerState);
            this.is_solid_at(checkX, py - playerState.PSZ[3], 0);
            this.active_block(wall, checkX, py - playerState.PSZ[3], playerState);
        } else if (wall === -1) {
            // Left wall check
            this.is_solid_at(px - playerState.PSZ[4] - 1, py, 0);
            this.active_block(wall, px - playerState.PSZ[4] - 1, py, playerState);
        }

        if (this.overlap === 0) {
            if (playerState.player_state === 2) {
                // Adjust position if crouching and no longer touching wall
                if (wall === 1) {
                    playerState.PLAYER_X += 10;
                } else if (wall === -1) {
                    playerState.PLAYER_X -= 10;
                } else if (wall === 0) {
                    playerState.PLAYER_Y += 10;
                }
            }
            playerState.player_wall = null;
            this.set_flipped(playerState, playerState.flipped);
        }
        
    }

    handle_player_left_right(playerState, inputKeys) {
        // Determine max speed based on crouch or normal state
        let maxSpeed = playerState.player_state === 2 ? 1.2 : 2.5;

        const left = (inputKeys & 2) !== 0;
        const right = (inputKeys & 1) !== 0;

        if (!(playerState.player_state === 3 && playerState.is_falling < 25)) {
            // Adjust max speed for sliding on walls
            if (playerState.player_state === 3 && playerState.is_falling < 35) {
                maxSpeed *= (playerState.is_falling - 25) * 0.1;
            }

            const playerWall = playerState.player_wall;
            if (playerWall !== null) {
                if (playerWall !== 0) {
                    if (left && !(playerState.last_tick_keys & 2)) {
                        playerState.PLAYER_SX -= maxSpeed;
                        playerState.PLAYER_DIR = -1;
                    }
                    if (right && !(playerState.last_tick_keys & 1)) {
                        playerState.PLAYER_SX += maxSpeed;
                        playerState.PLAYER_DIR = 1;
                    }
                }
            } else {
                if (left) {
                    playerState.PLAYER_SX -= maxSpeed;
                    playerState.PLAYER_DIR = -1;
                }
                if (right) {
                    playerState.PLAYER_SX += maxSpeed;
                    playerState.PLAYER_DIR = 1;
                }
            }

            let sx = playerState.PLAYER_SX;

            if (playerState.player_state === 3 && playerState.is_falling < 30) {
                playerState.PLAYER_SX += playerState.friction_dx - sx * 0.02 * (playerState.is_falling - 20);
            } else {
                const absSx = Math.abs(playerState.friction_dx - sx);
                if (absSx < 1) {
                    playerState.PLAYER_SX = playerState.friction_dx;
                } else {
                    if (left || right || absSx > 2) {
                        playerState.PLAYER_SX += (playerState.friction_dx - sx) * 0.2
                    } else {
                        playerState.PLAYER_SX = playerState.friction_dx
                    }
                }
            }
        }

        this.move_player_x(playerState);
        playerState.last_tick_keys = inputKeys;
    }

    start_wall_jump(playerState) {
        playerState.is_jumping = 101;
        playerState.player_state = 3;

        const playerWall = playerState.player_wall;

        // Flip opposite to the wall
        this.set_flipped(playerState, -playerWall);

        playerState.PLAYER_SY = 20;
        playerState.PLAYER_SX = -10 * playerWall;
        playerState.player_wall = null;
        playerState.is_falling = 10;
        playerState.KEY_UP = 2;
    }


    process_jump(playerState) {
        const KEY_UP = playerState.KEY_UP;

        if (KEY_UP === 1) {
            const playerWall = playerState.player_wall;

            // Wall jump if touching a wall
            if (playerWall !== null && Math.abs(playerWall) === 1) {
                this.start_wall_jump(playerState);
            } else {
                let is_jumping = playerState.is_jumping;
                if (is_jumping !== 100) {
                    const is_falling = playerState.is_falling;
                    const flipped = playerState.flipped;

                    // Only allow jump if falling small amount or sliding on wall
                    if (is_falling < 3 || (flipped === 1 && is_falling < 5)) {
                        this.overlap = 0;
                        const px = playerState.PLAYER_X;
                        const py = playerState.PLAYER_Y;
                        const check_y = py + 15;

                        this.is_solid_at(px - playerState.PSZ[4], check_y, -99);
                        this.is_solid_at(px + playerState.PSZ[2], check_y, -99);

                        if (this.overlap === 0 && playerState.PLAYER_SY < 16) {
                            playerState.KEY_UP = 2;
                            playerState.is_jumping = is_jumping + 1;
                            playerState.PLAYER_SY = 16;
                        }
                    }
                }
            }
        }

        // Ensure initial jump SY is set
        let is_jumping = playerState.is_jumping;
        if (is_jumping > 0 && is_jumping < 5) {
            if (playerState.PLAYER_SY < 16) {
                playerState.PLAYER_SY = 16;
            }
            playerState.is_jumping = is_jumping + 1;
            playerState.KEY_UP = 2;
        }
    }


    
    handle_player_up_down(playerState, keyMask) {
        const up = (keyMask & 8) !== 0;
        const down = (keyMask & 4) !== 0;

        // Update vertical velocity (gravity)
        playerState.PLAYER_SY -= 1.7;
        if (playerState.PLAYER_SY < -30) {
            playerState.PLAYER_SY = -30;
        }

        // Wall friction
        const playerWall = playerState.player_wall;
        if (Math.abs(playerWall) === 1 && (playerState.PLAYER_SY < 0 || playerState.friction != 0)) {
            if (playerState.friction != 0) {
                playerState.PLAYER_SY += 1.7
            }
            playerState.PLAYER_SY += (playerState.friction_dy - playerState.PLAYER_SY) * 0.3;
        }

        // Handle jump input
        if (up) {
            if (playerState.KEY_UP < 1) {
                playerState.KEY_UP = 1;
            }
        } else {
            playerState.KEY_UP = 0;
        }

        if (playerState.KEY_UP > 0) {
            this.process_jump(playerState);
        } else {
            const is_jumping = playerState.is_jumping;
            if (is_jumping > 0 && is_jumping < 100) {
                playerState.is_jumping = 100;
            }
            if (playerState.PLAYER_SY > 0 && playerState.is_falling > 1 && playerState.player_state === 0) {
                playerState.PLAYER_SY = playerState.PLAYER_SY - 1;
            }
        }

        // Handle crouch
        const playerStateVal = playerState.player_state;
        if (down) {
            if (playerStateVal !== 1 && playerStateVal !== 3) {
                playerState.player_state = 2;
                this.set_flipped(playerState, playerState.flipped);
                this.resolve_collisions(false, playerState);
            }
        } else if (playerStateVal === 2) {
            this.can_get_up(playerState);
            if (this.overlap === 0) {
                playerState.player_state = 0;
                this.set_flipped(playerState, playerState.flipped);
                this.resolve_collisions(false, playerState);
            }
        }

        playerState.is_falling += 1;
        this.move_player_y(playerState, up);
    }

    check_dangers(playerState) {
        if (!this.touching){return}

        const isInSpikeTile = 
        this.get_block_at(playerState.PLAYER_X + playerState.PSZ[2] - 1, playerState.PLAYER_Y) === 2 
        || this.get_block_at(playerState.PLAYER_X - (playerState.PSZ[4] - 1), playerState.PLAYER_Y) === 2 
        || this.get_block_at(playerState.PLAYER_X, playerState.PLAYER_Y + playerState.PSZ[1] - 1) === 2
        || this.get_block_at(playerState.PLAYER_X, playerState.PLAYER_Y - (playerState.PSZ[3] - 1)) === 2;


        if (playerState.wasInSpikeTileLastFrame) {
            playerState.wasInSpikeTileLastFrame = false;
            if (this.touching.is_player_touching_spike(playerState, this)) {
                playerState.PLAYER_DEATH = true;
            }
        } else {
            playerState.wasInSpikeTileLastFrame = isInSpikeTile;
        }
    }

    tick(playerState, inputKeys) {
        let keyMask;
        if (typeof inputKeys === 'string') {
            keyMask =
                (inputKeys.includes('D') ? 1 : 0) |
                (inputKeys.includes('A') ? 2 : 0) |
                (inputKeys.includes('S') ? 4 : 0) |
                (inputKeys.includes('W') ? 8 : 0);
        } else {
            keyMask = inputKeys;
        }

        this.resolve_collisions(false, playerState);

        this.check_dangers(playerState);

        this.handle_player_up_down(playerState, keyMask);
        this.handle_player_left_right(playerState, keyMask);

        const playerWall = playerState.player_wall;
        if (playerWall !== null) {
            if (playerWall === 0) {
                playerState.is_falling = 10;
            } else {
                playerState.is_falling = 0;
            }
            this.confirm_still_touching_wall(playerState);
        }

        const playerStateVal = playerState.player_state;
        if (playerStateVal !== 1 && playerStateVal !== 3) {
            if (playerState.flipped !== 0 && playerState.player_wall === null) {
                this.make_upright(playerState);
            }
        }

        this.position_now(playerState);

        return playerState;
    }

    is_flag_at(x, y) {
        const ix = Math.floor(x);
        const iy = Math.floor(y);

        const tx = Math.floor(ix / 60);
        const ty = Math.floor(iy / 60);

        const idx = tx + ty * this.LSX;
        return this.MAP[idx] === 63;
    }

    active_block(dir, tileX, tileY, playerState) {
        if (this.mask_char === 7) {
            const tileIdx = Math.floor(tileX / 60) + Math.floor(tileY / 60) * this.LSX;
            console.log(dir, playerState.playerWall);
            if (((this.MAP_R[tileIdx] + 1 % 4) + 4) % 4 === ((dir % 4) + 4) % 4) {
                let temp;
                if (this.MAP[tileIdx] === 50) {
                    temp = 5;
                } else {
                    temp = -5; 
                }
                if (dir === 2) {
                    playerState.friction_dx = temp;
                    return
                }
                if (dir === 1) {
                    playerState.friction_dy = temp;
                    playerState.friction = 1;
                    return
                }
                if (dir === 0) {
                    playerState.friction_dx = -temp;
                    return
                }  
                if (dir === -1) {
                    playerState.friction_dy = -temp;
                    playerState.friction = 1;
                    return
                }                
            }
        }
    }

    createDefaultPlayerState(x = 128.0, y = 280.0) {
        const spawnIDX = this.MAP.indexOf(76);
        let newX, newY
        if (spawnIDX > 0) {
            newX = (((spawnIDX) % this.LSX) * 60) + 30;
            newY = Math.floor((spawnIDX) / this.LSX) * 60 + 17;
        } else {
            newY = y;
            newX = x
            while (this.get_block_at(x, newY - 30) > 4) {
                newY += 30;
                console.log(newY)
            }
        }

        return {
            PLAYER_X: newX,
            PLAYER_Y: newY,
            PLAYER_SX: 0.0,
            PLAYER_SY: 0.0,
            PLAYER_DEATH: false,
            PSZ: [0, 17, 13, 17, 13],
            is_jumping: 0,
            is_falling: 999,
            KEY_UP: 0,
            flipped: 0,
            player_state: 0,  // 0=normal, 1=spin, 2=crouch, 3=wall spin
            player_wall: null,  // null=no wall, 1=right wall, -1=left wall, 0=ground, 2=ceiling
            direction: 90,
            PLAYER_DIR: 1,
            last_tick_keys: 0,
            wasInSpikeTileLastFrame: false,
            friction_dx: 0,
            friction_dy: 0,
            friction: 0,
        };
    }

}



// Key encoding functions
const _KEY_LOOKUP = {'D': 1, 'A': 2, 'S': 4, 'W': 8};

function keyCode(keys) {
    if (typeof keys === 'string') {
        let sum = 0;
        for (const k of keys) {
            sum += _KEY_LOOKUP[k] || 0;
        }
        return sum.toString();
    } else {
        return keys.toString();
    }
}

function generateReplayCode(inputs, level = 11, username = "bruteforcer") {
    try {
        const outputParts = [];
        let prevKeys = "";
        
        for (let i = 0; i < inputs.length; i++) {
            const keys = inputs[i];
            if (i === 0 || keys !== prevKeys) {
                outputParts.push(`Ǉ${i+1}Ǉ${keyCode(keys)}`);
                prevKeys = keys;
            }
        }
        
        const output = `${username}ǇǇ${level + 1}Ǉ1${outputParts.join('')}Ǉ${inputs.length + 1}Ǉ0`;
        return `${output.length + 12345678}${output}`;
    } catch (e) {
        return "Nothing was found";
    }
}

/**
 * Optimized replay decoding with better error handling
 * @param {string|number} replayCode 
 * @returns {string[]|string}
 */
function decodeReplayCode(replayCode) {
    try {        
        // Extract data and split by the special character
        const data = replayCode.slice(8).split('Ǉ');
        
        const inputCount = parseInt(data[data.length - 2]) - 1;
        if (isNaN(inputCount) || inputCount < 0) {console.error("Error decoding replay");};

        // Initialize array with empty strings
        const inputs = new Array(inputCount).fill("");
        
        // Pre-compute key combinations
        const keyCombos = {};
        const keyMap = [
            ["D", 1], ["A", 2], ["S", 4], ["W", 8]
        ];

        for (let i = 0; i < 16; i++) {
            let keys = "";
            for (const [char, bit] of keyMap) {
                if (i & bit) keys += char;
            }
            keyCombos[i] = keys;
        }
        
        // Process changes more efficiently
        // Loop from index 4 to the second to last element, jumping by 2
        for (let i = 4; i < data.length - 2; i += 2) {
            const start = parseInt(data[i]) - 1;
            const keyValue = parseInt(data[i + 1]);
            const keys = keyCombos[keyValue] || "";
            
            // Find next change or end
            let nextStart = inputCount;
            if (i + 2 < data.length - 2) {
                nextStart = parseInt(data[i + 2]) - 1;
            }
            
            // Fill range
            const end = Math.min(nextStart, inputCount);
            for (let j = start; j < end; j++) {
                inputs[j] = keys;
            }
        }
        
        return inputs;
    } catch (error) {
        return "Error decoding replay";
    }
}